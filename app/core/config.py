"""Application configuration module.

This module contains configuration settings for different environments
(local, dev, prod) and handles environment-specific URL configurations.
Follows modern Python configuration patterns with pydantic-settings.
"""

from enum import StrEnum
from pathlib import Path
import secrets
import zoneinfo

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Env(StrEnum):
    """Environment enumeration for different deployment stages.

    Defines the available deployment environments with their
    corresponding configuration requirements.
    """

    LOCAL = "local"
    DEV = "dev"
    PROD = "prod"


# Environment-specific URL configurations
# local/dev: Local Docker environment (same settings, different login button)
# prod: EC2 + Vercel deployment environment
_ENV_URLS: dict[Env, dict[str, str | None]] = {
    Env.LOCAL: {
        # Local environment: Local Docker (dev login button visible)
        "COOKIE_DOMAIN": "localhost",
        "API_BASE_URL": "http://localhost:8000",
        "FRONTEND_URL": "http://localhost:3000",
        "KAKAO_REDIRECT_URI": "http://localhost:3000/auth/kakao/callback",
    },
    Env.DEV: {
        # Dev environment: Local Docker (dev login button hidden, for Kakao testing)
        "COOKIE_DOMAIN": "localhost",
        "API_BASE_URL": "http://localhost:8000",
        "FRONTEND_URL": "http://localhost:3000",
        "KAKAO_REDIRECT_URI": "http://localhost:3000/auth/kakao/callback",
    },
    Env.PROD: {
        # Prod environment: EC2 backend (DuckDNS HTTPS) + Vercel frontend
        "COOKIE_DOMAIN": None,  # Cross-domain cookies (Vercel <-> EC2)
        "API_BASE_URL": "https://ai-02-06.duckdns.org",
        "FRONTEND_URL": "https://ai-02-06.vercel.app",
        "KAKAO_REDIRECT_URI": "https://ai-02-06.vercel.app/auth/kakao/callback",
    },
}

# Default values for development
_DEFAULT_SECRET_KEY = f"dev-only-secret-key-{secrets.token_hex(16)}"
_DEFAULT_DB_PASSWORD = "change_me_in_production"
_DEFAULT_KAKAO_CLIENT_ID = "mock_kakao_client_id"
_DEFAULT_KAKAO_CLIENT_SECRET = "mock_kakao_client_secret"


class Config(BaseSettings):
    """Application configuration class.

    This class handles all configuration settings for the application,
    including database, JWT, OAuth, and environment-specific settings.
    Uses modern pydantic-settings for robust configuration management.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",
    )

    # Environment settings
    ENV: Env = Env.LOCAL
    SECRET_KEY: str = _DEFAULT_SECRET_KEY
    TIMEZONE: zoneinfo.ZoneInfo = Field(default_factory=lambda: zoneinfo.ZoneInfo("Asia/Seoul"))
    TEMPLATE_DIR: str = str(Path(__file__).resolve().parent.parent / "templates")

    # Database settings (not auto-configured by ENV - sensitive information)
    DB_HOST: str = "postgres"
    DB_PORT: int = 5432
    DB_USER: str = "doseph_admin"
    DB_PASSWORD: str = _DEFAULT_DB_PASSWORD
    DB_NAME: str = "doseph_db"
    DB_SSL: bool = False  # 관리형 PG(Neon 등) TLS 연결 시 True — asyncpg ssl="require" 주입 (로컬/DEV 는 False)
    DB_CONNECT_TIMEOUT: int = 10  # asyncpg pool 새 connection 생성 한도 — 5초는 OCR 폴링/RQ 부하 시 일시 timeout 유발
    DB_CONNECTION_POOL_MAXSIZE: int = 20  # SSE long-poll + RQ + 스케줄러 동시 보유로 10 은 한계 — 20 으로 상향

    # Redis (RAG 임베딩·LLM RQ job 큐 + 세션 캐시)
    REDIS_URL: str = "redis://redis:6379/0"

    # URL settings (auto-configured based on ENV)
    COOKIE_DOMAIN: str | None = None
    API_BASE_URL: str | None = None
    FRONTEND_URL: str | None = None

    # JWT settings
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 14 * 24 * 60  # 14 days
    JWT_LEEWAY: int = 5

    # External API settings
    OPENAI_API_KEY: str | None = None
    DATA_GO_KR_API_KEY: str | None = None

    # 식약처 회수·판매중지 API (Phase 7) ────────────────────────────────
    # base URL 의 service number 는 04 고정, list/detail method 는 03
    # (식약처가 메서드 버전 갱신 시 코드 수정 없이 env 만 교체)
    DATA_GO_KR_RECALL_BASE_URL: str = "http://apis.data.go.kr/1471000/MdcinRtrvlSleStpgeInfoService04"
    DATA_GO_KR_RECALL_LIST_METHOD: str = "getMdcinRtrvlSleStpgeList03"
    DATA_GO_KR_RECALL_DETAIL_METHOD: str = "getMdcinRtrvlSleStpgeItem03"
    # None 이면 DATA_GO_KR_API_KEY 폴백
    DATA_GO_KR_RECALL_API_KEY: str | None = None
    # 의약외품(치약·칫솔 등) 차단 토글
    RECALL_FILTER_NON_DRUG: bool = True

    # Kakao OAuth settings
    KAKAO_CLIENT_ID: str = _DEFAULT_KAKAO_CLIENT_ID
    KAKAO_CLIENT_SECRET: str = _DEFAULT_KAKAO_CLIENT_SECRET
    KAKAO_REDIRECT_URI: str | None = None

    @model_validator(mode="after")
    def apply_env_defaults(self) -> "Config":
        """Apply environment-specific default values.

        Returns:
            Config: The updated configuration instance.
        """
        env_urls = _ENV_URLS.get(self.ENV, _ENV_URLS[Env.LOCAL])

        if self.COOKIE_DOMAIN is None:
            self.COOKIE_DOMAIN = env_urls["COOKIE_DOMAIN"]
        if self.API_BASE_URL is None:
            self.API_BASE_URL = env_urls["API_BASE_URL"]
        if self.FRONTEND_URL is None:
            self.FRONTEND_URL = env_urls["FRONTEND_URL"]
        if self.KAKAO_REDIRECT_URI is None:
            self.KAKAO_REDIRECT_URI = env_urls["KAKAO_REDIRECT_URI"]

        return self

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Config":
        """Validate that production secrets are properly configured.

        Raises:
            ValueError: If required production secrets are not set.

        Returns:
            Config: The validated configuration instance.
        """
        if self.ENV == Env.PROD:
            errors = []

            if self.SECRET_KEY == _DEFAULT_SECRET_KEY or self.SECRET_KEY.startswith("dev-only-"):
                errors.append("SECRET_KEY must be set in production environment")

            if self.DB_PASSWORD == _DEFAULT_DB_PASSWORD:
                errors.append("DB_PASSWORD must be set in production environment")

            if self.KAKAO_CLIENT_ID == _DEFAULT_KAKAO_CLIENT_ID:
                errors.append("KAKAO_CLIENT_ID must be set in production environment")

            if self.KAKAO_CLIENT_SECRET == _DEFAULT_KAKAO_CLIENT_SECRET:
                errors.append("KAKAO_CLIENT_SECRET must be set in production environment")

            if errors:
                error_message = f"Production configuration errors: {'; '.join(errors)}"
                raise ValueError(error_message)

        return self


# Global configuration instance
config = Config()
