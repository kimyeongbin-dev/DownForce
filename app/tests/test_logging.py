"""Tests for logging infrastructure (B0~B3).

- B0 안전: 메시지 truncate / 시간+크기 회전 / 제한권한 / 인젝션 이스케이프
- B1: 예외 핸들러 로깅 헬퍼(요청 컨텍스트 + 스택)
- B2: request_id 컨텍스트 주입(필터·JSON 필드)
- B3: env 기반 포맷(prod=JSON / local=사람형식) + funcName(위치) 필드
"""

import logging
import sys

import pytest

from app.core.logger import (
    _DIR_MODE,
    _FILE_MODE,
    _MAX_MSG_LEN,
    JsonFormatter,
    RequestIdFilter,
    SizeTimedRotatingFileHandler,
    TruncateFilter,
    _is_prod,
    _resolve_log_dir,
    log_handled_exception,
    request_id_var,
    setup_logger,
)


def _console_handler(logger: logging.Logger) -> logging.Handler:
    """콘솔(stdout) StreamHandler 만 골라낸다(FileHandler 서브클래스 제외)."""
    return next(
        h for h in logger.handlers if isinstance(h, logging.StreamHandler) and not isinstance(h, logging.FileHandler)
    )


def _record(msg: str, args: tuple = ()) -> logging.LogRecord:
    return logging.LogRecord("t", logging.INFO, __file__, 1, msg, args, None)


# ── 메모리: 메시지 트렁케이션 ──────────────────────────────────────────
def test_truncate_filter_caps_long_message() -> None:
    """상한 초과 메시지는 잘리고 truncated 표시가 붙는다."""
    rec = _record("x" * (_MAX_MSG_LEN + 500))
    TruncateFilter().filter(rec)
    out = rec.getMessage()

    assert len(out) <= _MAX_MSG_LEN + 40
    assert "truncated" in out


def test_truncate_filter_keeps_short_message() -> None:
    """상한 이하 메시지는 %-병합만 하고 그대로 둔다."""
    rec = _record("hello %s", ("world",))
    TruncateFilter().filter(rec)

    assert rec.getMessage() == "hello world"


# ── 보안: 로그 인젝션(개행) 이스케이프 ─────────────────────────────────
def test_json_formatter_escapes_newline() -> None:
    """개행/캐리지리턴이 리터럴로 안 들어가고 한 줄 JSON 유지."""
    out = JsonFormatter().format(_record("line1\nline2\rEND"))

    assert "\n" not in out
    assert "\r" not in out
    assert "line1" in out


# ── 저장공간: 시간 + 크기 병행 회전 ────────────────────────────────────
def test_size_handler_rolls_over_on_size(tmp_path) -> None:
    """크기 상한 초과 시 shouldRollover 가 1(회전)을 반환."""
    logf = tmp_path / "t.log"
    handler = SizeTimedRotatingFileHandler(str(logf), when="H", interval=3, backupCount=1, max_bytes=200)
    handler.setFormatter(logging.Formatter("%(message)s"))
    handler.emit(_record("small"))

    assert handler.shouldRollover(_record("y" * 500)) == 1
    handler.close()


# ── 보안: 제한적 파일/디렉토리 권한 (POSIX) ────────────────────────────
@pytest.mark.skipif(sys.platform == "win32", reason="POSIX 권한 전용")
def test_log_dir_has_restrictive_mode(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("LOG_DIR", str(tmp_path / "logs"))
    log_dir = _resolve_log_dir()

    assert (log_dir.stat().st_mode & 0o777) == _DIR_MODE


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX 권한 전용")
def test_log_file_has_restrictive_mode(tmp_path) -> None:
    logf = tmp_path / "t.log"
    handler = SizeTimedRotatingFileHandler(str(logf), when="H", interval=3, backupCount=1)
    handler.emit(_record("hi"))
    handler.close()

    assert (logf.stat().st_mode & 0o777) == _FILE_MODE


# ── B1: 예외 핸들러 로깅 헬퍼 ──────────────────────────────────────────
def test_log_handled_exception_records_context_and_stack(caplog) -> None:
    """핸들러가 잡은 예외를 요청 컨텍스트(kind/method/path) + 스택과 함께 ERROR 기록."""
    logger = logging.getLogger("test.handled")

    def _boom() -> None:
        raise ValueError("boom")

    try:
        _boom()
    except ValueError as exc:
        with caplog.at_level(logging.ERROR, logger="test.handled"):
            log_handled_exception(logger, exc, method="GET", path="/api/x", kind="orm")

    record = caplog.records[-1]
    message = record.getMessage()
    assert record.levelno == logging.ERROR
    assert "orm" in message
    assert "GET" in message
    assert "/api/x" in message
    assert "ValueError" in message
    assert record.exc_info is not None  # 스택 포함


# ── B2: request_id 컨텍스트 ────────────────────────────────────────────
def test_request_id_filter_injects_contextvar() -> None:
    """RequestIdFilter 가 현재 contextvar 의 request_id 를 record 에 붙인다."""
    token = request_id_var.set("req-123")
    try:
        record = _record("hi")
        RequestIdFilter().filter(record)
        assert record.request_id == "req-123"
    finally:
        request_id_var.reset(token)


def test_json_formatter_includes_request_id() -> None:
    """JSON 출력에 request_id 필드가 포함된다."""
    token = request_id_var.set("req-xyz")
    try:
        out = JsonFormatter().format(_record("hi"))
        assert "req-xyz" in out
    finally:
        request_id_var.reset(token)


# ── B3: 포맷 정책(env) + funcName(위치) ────────────────────────────────
def test_is_prod_reads_env(monkeypatch) -> None:
    monkeypatch.setenv("ENV", "prod")
    assert _is_prod() is True
    monkeypatch.setenv("ENV", "local")
    assert _is_prod() is False


def test_json_formatter_includes_func() -> None:
    """위치 추적용 func 필드가 JSON 에 포함된다."""
    assert '"func"' in JsonFormatter().format(_record("hi"))


def test_setup_logger_prod_uses_json(tmp_path, monkeypatch) -> None:
    """prod 는 콘솔(stdout)도 JSON 포맷(수집기 파싱)."""
    monkeypatch.setenv("ENV", "prod")
    monkeypatch.setenv("LOG_DIR", str(tmp_path / "logs"))
    logger = setup_logger("test.fmt.prod")

    assert isinstance(_console_handler(logger).formatter, JsonFormatter)


def test_setup_logger_local_uses_human(tmp_path, monkeypatch) -> None:
    """local 은 콘솔 사람형식(직접 읽기 쉬움)."""
    monkeypatch.setenv("ENV", "local")
    monkeypatch.setenv("LOG_DIR", str(tmp_path / "logs"))
    logger = setup_logger("test.fmt.local")

    formatter = _console_handler(logger).formatter
    assert not isinstance(formatter, JsonFormatter)
    assert isinstance(formatter, logging.Formatter)
