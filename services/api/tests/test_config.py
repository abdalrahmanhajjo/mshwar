import pytest

from app.core.config import Settings, settings

_PROD_SECRET = "rotated-secret"
_DEFAULT_SECRET = "change-me-in-production"


def _settings(**overrides: object) -> Settings:
    payload: dict[str, object] = {
        "environment": "production",
        "database_url": "postgresql+asyncpg://app:secret@db:5432/mshwar",
        "google_maps_api_key": "maps-key",
    }
    payload["secret_key"] = _PROD_SECRET
    payload.update(overrides)
    return Settings(**payload)  # type: ignore[arg-type]


def test_defaults() -> None:
    assert settings.project_name == "Mshwar API"
    assert settings.version == "0.1.0"
    assert settings.api_v1_prefix == "/api/v1"
    assert settings.is_development is True
    assert settings.is_staging is False
    assert settings.is_production is False
    assert settings.database_url_public == settings.database_url
    assert settings.sentry_dsn_public == settings.sentry_dsn


def test_environment_flags() -> None:
    staging = Settings(environment="staging")
    assert staging.is_staging is True
    assert staging.is_production is False
    assert staging.is_development is False


def test_production_rejects_default_database_url() -> None:
    with pytest.raises(ValueError, match="DATABASE_URL"):
        _settings(database_url="postgresql+asyncpg://postgres:postgres@localhost:5432/mshwar")


def test_production_rejects_default_secret() -> None:
    with pytest.raises(ValueError, match="SECRET_KEY"):
        overrides: dict[str, object] = {}
        overrides["secret_key"] = _DEFAULT_SECRET
        _settings(**overrides)


def test_production_rejects_missing_maps_key() -> None:
    with pytest.raises(ValueError, match="GOOGLE_MAPS_API_KEY"):
        _settings(google_maps_api_key="")


def test_production_redacts_credentials() -> None:
    prod = _settings(sentry_dsn="https://key@o0.ingest.sentry.io/1")
    assert prod.database_url_public == "postgresql+asyncpg://***:***@db:5432/mshwar"
    assert prod.sentry_dsn_public == "https://***@o0.ingest.sentry.io/1"
