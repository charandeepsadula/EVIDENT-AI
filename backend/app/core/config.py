from typing import Any
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://evident-ai-frontend-elsx.onrender.com",
    ]
    cors_origin_regex: str | None = r"^https://.*\.onrender\.com$"
    local_dev_mode: bool = False
    local_dev_token: str | None = None
    local_database_path: str = "./data/evident.sqlite3"
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    supabase_service_role_key: str | None = None
    redis_url: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_fallback_model: str | None = "gemini-2.5-flash-lite"
    tavily_api_key: str | None = None
    max_text_chars: int = 20000
    max_url_chars: int = 2048
    max_upload_bytes: int = 524288000

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    @property
    def is_supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_publishable_key)

    @model_validator(mode="after")
    def auto_enable_local_mode(self) -> "Settings":
        # When Supabase is not configured, automatically use Local Workspace mode
        if not self.is_supabase_configured:
            self.local_dev_mode = True
        return self


settings = Settings()
