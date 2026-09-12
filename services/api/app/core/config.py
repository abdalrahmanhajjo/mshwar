from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    project_name: str = "Mshwar API"
    version: str = "0.1.0"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/mshwar"
    redis_url: str = "redis://localhost:6379/0"
    api_v1_prefix: str = "/api/v1"
    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 8

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
