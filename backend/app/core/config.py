from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Мемолюция"
    app_url: str = "http://localhost:5173"
    api_url: str = "http://localhost:8000"
    environment: str = "development"
    debug: bool = True

    database_url: str = "sqlite+aiosqlite:///./memolution.db"
    redis_url: str = "redis://localhost:6379/0"
    enable_redis: bool = False

    jwt_secret: str = Field(default="", min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 24 * 30

    telegram_bot_token: str = ""
    telegram_client_id: str = ""
    telegram_client_secret: str = ""
    telegram_redirect_uri: str = ""
    enable_dev_auth: bool = True
    dev_seed_on_startup: bool = False

    admin_login: str = Field(default="", min_length=1)
    admin_password: str = Field(default="", min_length=8)

    upload_dir: str = "./uploads"
    max_upload_mb: int = 50
    allowed_media_types: str = "image/jpeg,image/png,image/webp,image/gif,video/mp4"

    s3_enabled: bool = False
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_bucket: str = "memolution-media"
    s3_public_url: str = ""

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    rate_limit_window_seconds: int = 60
    rate_limit_max_requests: int = 180

    model_config = SettingsConfigDict(
        env_file=(Path(__file__).resolve().parents[3] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def allowed_media_type_set(self) -> set[str]:
        return {item.strip() for item in self.allowed_media_types.split(",") if item.strip()}


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if not s.jwt_secret or len(s.jwt_secret) < 32:
        import warnings
        warnings.warn(
            "JWT_SECRET is not set or too short! "
            "Generate a strong secret: python3 -c 'import secrets; print(secrets.token_hex(32))'"
        )
    return s

settings = get_settings()
