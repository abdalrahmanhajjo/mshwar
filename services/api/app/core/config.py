from functools import lru_cache
from typing import Any

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        populate_by_name=True,
    )

    project_name: str = "Mshwar API"
    version: str = "0.1.0"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/mshwar",
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 8

    # Connection pool
    pool_size: int = 20
    max_overflow: int = 10
    pool_recycle: int = 1800
    pool_pre_ping: bool = True
    connect_timeout: int = 10
    statement_timeout_ms: int = 30000

    # Logging
    log_level: str = "DEBUG"
    log_format: str = "json"

    # External services
    google_maps_api_key: str = ""
    open_meteo_api_key: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    imagekit_api_key: str = ""
    imagekit_url: str = ""

    # Monitoring
    sentry_dsn: str = ""
    sentry_environment: str = "development"
    posthog_api_key: str = ""

    # App
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_staging(self) -> bool:
        return self.environment == "staging"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    def model_post_init(self, __context: Any, /) -> None:
        self._validate_credentials()

    def _validate_credentials(self) -> None:
        if self.is_production:
            if self.database_url.startswith("postgresql+asyncpg://postgres:postgres"):
                raise ValueError("Production DATABASE_URL must not use default credentials")
            if self.secret_key == "change-me-in-production":
                raise ValueError("Production SECRET_KEY must be set")
            if not self.google_maps_api_key:
                raise ValueError("Production GOOGLE_MAPS_API_KEY must be set")

    @property
    def database_url_public(self) -> str:
        """Return database URL with credentials stripped for logging."""
        if self.is_production and "@" in self.database_url:
            scheme, rest = self.database_url.split("://", 1)
            _, rest = rest.split("@", 1)
            return f"{scheme}://***:***@{rest}"
        return self.database_url

    @property
    def sentry_dsn_public(self) -> str:
        """Return Sentry DSN with key stripped for logging."""
        if self.sentry_dsn and self.is_production and "@" in self.sentry_dsn:
            scheme, rest = self.sentry_dsn.split("://", 1)
            _, rest = rest.split("@", 1)
            return f"{scheme}://***@{rest}"
        return self.sentry_dsn


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
