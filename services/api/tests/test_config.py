from app.core.config import settings


def test_defaults() -> None:
    assert settings.project_name == "Mshwar API"
    assert settings.version == "0.1.0"
    assert settings.api_v1_prefix == "/api/v1"
