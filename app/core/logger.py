"""Logging configuration module.

콘솔(stdout, 사람 형식) + 파일(JSON 구조화) 이중 출력.
- 콘솔: ``[ts] [LEVEL] [name:line] msg`` — docker logs / 개발자 직관용
- 파일: JSON line — machine-readable, jq / 분석 도구 호환

파일 위치는 ``LOG_DIR`` 환경변수로 결정(default ``/app/logs``). docker-compose
volume 마운트로 호스트에 영속화.

회전 정책:
- 시간(3시간) + 파일당 크기(10MB) 상한 **병행** 회전 (``SizeTimedRotatingFileHandler``)
- 백업 2 + 활성 1 = 3개 동시, 평상시 ~9h 보존

파일로깅 안전장치(메모리·저장공간·보안, CLAUDE.md §9):
- 메모리: 메시지 4000자 트렁케이트(``TruncateFilter``)
- 저장공간: 시간+크기 회전 + (배포측) docker json-file 캡
- 보안: 파일 0o640 / 디렉 0o750, JSON 개행 이스케이프(로그 인젝션 방어),
  호출자가 PII/token/huge payload 를 message 에 넣지 않을 책임
- 모듈별 logger(``getLogger(__name__)`` 호출자 측에서)
"""

import contextlib
from datetime import UTC, datetime
from io import TextIOWrapper
import json
import logging
import logging.handlers
import os
from pathlib import Path
import sys
from typing import override

_LOG_DIR_ENV = "LOG_DIR"
_DEFAULT_LOG_DIR = "/app/logs"
# 시간 기반 회전 — 3h x (활성 1 + 백업 2) = 9h 보존
_ROTATE_WHEN = "H"
_ROTATE_INTERVAL_HOURS = 3
_ROTATE_BACKUP_COUNT = 2
_CONSOLE_FORMAT = "[%(asctime)s] [%(levelname)s] [%(name)s:%(lineno)d] %(message)s"

# ── 파일로깅 안전 상한 (메모리·저장공간·보안) ─────────────────────────
_MAX_MSG_LEN = 4000  # 단일 메시지 문자 상한 — 초과분 트렁케이트(메모리·저장 폭주 방지)
_MAX_BYTES = 10 * 1024 * 1024  # 파일당 크기 상한 10MB — 시간회전과 병행(런어웨이 단일 파일 비대 방지)
_DIR_MODE = 0o750  # 로그 디렉토리 권한(owner rwx / group rx / other 없음)
_FILE_MODE = 0o640  # 로그 파일 권한(owner rw / group r / other 없음) — world-readable 금지


class JsonFormatter(logging.Formatter):
    """JSON line formatter — 한 record 당 한 줄 JSON 출력.

    필드: ts (UTC ISO 8601), level, logger, msg, module, line, exception (있을 때).
    ``logger.exception()`` 호출 시 stack trace 가 ``exception`` 에 포함된다.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "module": record.module,
            "line": record.lineno,
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


# ── 메시지 트렁케이션 필터 (재사용) ───────────────────────────────────
# 흐름: 긴 메시지 감지 -> 상한 초과분 잘라 record 재기록 -> 모든 핸들러 공통 적용
# 핸들러에 부착하면 자식 logger 전파 record 에도 적용됨(logger 부착은 전파 미적용).
class TruncateFilter(logging.Filter):
    """단일 로그 메시지를 ``_MAX_MSG_LEN`` 으로 잘라 메모리/저장 폭주를 막는다.

    ``%``-args 를 미리 병합해 ``record.msg`` 에 넣고 ``args`` 를 비운다
    (핸들러마다 재병합 방지, lazy 포맷 결과를 1회만 계산).
    """

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if len(message) > _MAX_MSG_LEN:
            dropped = len(message) - _MAX_MSG_LEN
            message = f"{message[:_MAX_MSG_LEN]}…[truncated {dropped} chars]"
        record.msg = message
        record.args = None
        return True


# ── 시간 + 크기 병행 회전 핸들러 (재사용) ──────────────────────────────
# 흐름: 시간 회전(부모) 판단 -> 미해당 시 크기 상한 판단 -> 초과면 회전
#       + 생성 파일은 제한적 권한(_FILE_MODE)으로 오픈(보안).
class SizeTimedRotatingFileHandler(logging.handlers.TimedRotatingFileHandler):
    """TimedRotating(시간)에 크기 상한을 더한 회전 핸들러.

    회전 주기 내 런어웨이 로그가 단일 파일을 비대하게 만드는 것을 방지한다.
    """

    def __init__(self, *args: object, max_bytes: int = _MAX_BYTES, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]
        self._max_bytes = max_bytes

    @override
    def _open(self) -> TextIOWrapper:
        stream = super()._open()
        with contextlib.suppress(OSError):
            Path(self.baseFilename).chmod(_FILE_MODE)  # world 접근 차단(보안)
        return stream

    @override
    def shouldRollover(self, record: logging.LogRecord) -> int:
        if super().shouldRollover(record):
            return 1
        if self._max_bytes > 0:
            if self.stream is None:
                self.stream = self._open()
            message = f"{self.format(record)}{self.terminator}"
            self.stream.seek(0, os.SEEK_END)
            if self.stream.tell() + len(message.encode("utf-8")) >= self._max_bytes:
                return 1
        return 0


def _resolve_log_dir() -> Path:
    """``LOG_DIR`` env 우선, 미설정 시 ``/app/logs``. 디렉토리 idempotent 생성 + 권한 제한."""
    log_dir = Path(os.environ.get(_LOG_DIR_ENV, _DEFAULT_LOG_DIR))
    log_dir.mkdir(parents=True, exist_ok=True)
    with contextlib.suppress(OSError):  # world 접근 차단(보안). Windows 는 무시됨(무해).
        log_dir.chmod(_DIR_MODE)
    return log_dir


# ── 로거 셋업 (콘솔 + 회전 파일 핸들러) ────────────────────────────────
# 흐름: 기존 핸들러 있으면 재사용 -> 트렁케이션 필터 -> 콘솔 핸들러 부착
#       -> 파일 핸들러(권한제한·시간+크기 회전) 부착 -> 실패 시 콘솔만 폴백
def setup_logger(
    name: str = "app",
    level: int = logging.INFO,
) -> logging.Logger:
    """Set up a logger with console + rotating-file handlers.

    Args:
        name: Logger name for identification. 같은 이름으로 두 번 호출되면
            기존 logger 를 그대로 반환 (handler 중복 방지).
        level: Logging level (default: INFO).

    Returns:
        logging.Logger: Configured logger instance.
    """
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(level)
    logger.propagate = False  # 루트 logger 로 중복 전달 방지

    console_formatter = logging.Formatter(_CONSOLE_FORMAT)
    json_formatter = JsonFormatter()
    # 트렁케이션은 핸들러에 부착(자식 logger 전파 record 에도 적용되도록).
    truncate_filter = TruncateFilter()

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(console_formatter)
    console_handler.addFilter(truncate_filter)
    logger.addHandler(console_handler)

    try:
        log_dir = _resolve_log_dir()
        file_handler = SizeTimedRotatingFileHandler(
            log_dir / f"{name}.log",
            when=_ROTATE_WHEN,
            interval=_ROTATE_INTERVAL_HOURS,
            backupCount=_ROTATE_BACKUP_COUNT,
            encoding="utf-8",
            utc=True,
        )
        file_handler.addFilter(truncate_filter)
        # 백업 파일 이름에 ISO 타임스탬프 suffix (예: app.log.2026-05-01_15)
        file_handler.suffix = "%Y-%m-%d_%H"
        file_handler.setFormatter(json_formatter)
        logger.addHandler(file_handler)
    except OSError:
        # 파일 시스템 권한 문제 등으로 파일 핸들러 생성 실패 시 콘솔만 유지.
        # 정확한 원인은 콘솔 logger 가 직접 emit (logger 자기 자신에 의존하지 않음).
        logger.warning("Failed to attach TimedRotatingFileHandler — console only", exc_info=True)

    return logger


# Global loggers for the application.
# FastAPI 프로세스가 ai_worker.* 모듈도 import 하므로 (예: RAG 응답 생성기)
# 그 namespace 도 INFO 핸들러를 미리 등록한다 — 그렇지 않으면 ai_worker.*
# INFO 가 root logger 의 default WARNING 에 걸려 누락된다.
default_logger = setup_logger()
_ai_worker_logger = setup_logger("ai_worker")
