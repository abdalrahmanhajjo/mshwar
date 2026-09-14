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
    session_cookie_name: str = "mshwar_session"
    session_ttl_seconds: int = 60 * 60 * 24 * 7  # 7 days; refresh extends when < half remains
    password_reset_ttl_seconds: int = 30 * 60  # 30 minutes; single-use; revoked on consume
    password_reset_min_ms: int = 80
    forgot_ip_limit: int = 20
    forgot_email_limit: int = 5
    rate_limit_window_seconds: int = 3600
    mailer_backend: str = "console"  # console | notification
    public_web_origin: str = "http://localhost:3000"
    email_verification_ttl_seconds: int = 24 * 60 * 60
    verify_ip_limit: int = 20
    verify_email_limit: int = 3

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
    catalogue_embedding_provider: str = "stub"
    catalogue_routing_provider: str = "auto"
    routing_time_bucket_minutes: int = 15
    routing_cache_ttl_seconds: int = 6 * 60 * 60
    routing_plan_budget_usd: float = 0.5
    weather_provider: str = "stub"
    weather_cache_ttl_seconds: int = 60 * 60
    weather_precip_mm_threshold: float = 5.0
    weather_precip_mm_sensitive_threshold: float = 2.0
    weather_wind_kmh_threshold: float = 45.0
    weather_wind_kmh_sensitive_threshold: float = 30.0
    weather_temp_max_c_threshold: float = 38.0
    weather_temp_min_c_threshold: float = 4.0
    openai_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("OPENAI_API_KEY", "openai_api_key"),
    )
    planner_llm_provider: str = Field(
        default="stub",
        validation_alias=AliasChoices("PLANNER_LLM_PROVIDER", "planner_llm_provider"),
    )
    planner_llm_max_attempts: int = Field(
        default=2,
        validation_alias=AliasChoices("PLANNER_LLM_MAX_ATTEMPTS", "planner_llm_max_attempts"),
    )
    planner_llm_timeout_seconds: float = Field(
        default=8.0,
        validation_alias=AliasChoices("PLANNER_LLM_TIMEOUT_SECONDS", "planner_llm_timeout_seconds"),
    )
    planner_circuit_threshold: int = Field(
        default=3,
        validation_alias=AliasChoices("PLANNER_CIRCUIT_THRESHOLD", "planner_circuit_threshold"),
    )
    planner_circuit_reset_seconds: float = Field(
        default=60.0,
        validation_alias=AliasChoices("PLANNER_CIRCUIT_RESET_SECONDS", "planner_circuit_reset_seconds"),
    )
    planner_fault_inject: str = Field(
        default="",
        validation_alias=AliasChoices("PLANNER_FAULT_INJECT", "planner_fault_inject"),
    )
    open_meteo_api_key: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    payment_provider: str = Field(
        default="stripe_test",
        validation_alias=AliasChoices("PAYMENT_PROVIDER", "payment_provider"),
    )
    payments_fault: str = Field(
        default="",
        validation_alias=AliasChoices("PAYMENTS_FAULT", "payments_fault"),
    )
    idempotency_ttl_hours: int = Field(
        default=24,
        validation_alias=AliasChoices("IDEMPOTENCY_TTL_HOURS", "idempotency_ttl_hours"),
    )
    imagekit_api_key: str = ""
    imagekit_url: str = ""
    private_storage_dir: str = "/tmp/mshwar-private"
    signed_url_ttl_seconds: int = 15 * 60
    staff_invite_ttl_seconds: int = 7 * 24 * 60 * 60
    search_reindex_provider: str = Field(
        default="stub",
        validation_alias=AliasChoices("SEARCH_REINDEX_PROVIDER", "search_reindex_provider"),
    )
    data_quality_scheduler_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices("DATA_QUALITY_SCHEDULER_ENABLED", "data_quality_scheduler_enabled"),
    )
    data_quality_stale_days: int = Field(
        default=14,
        validation_alias=AliasChoices("DATA_QUALITY_STALE_DAYS", "data_quality_stale_days"),
    )

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
