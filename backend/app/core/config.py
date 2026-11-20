from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:3000"]
    local_dev_mode: bool = False
    local_dev_token: str | None = None
    local_database_path: str = "./data/evident.sqlite3"
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    supabase_service_role_key: str | None = None
    redis_url: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash"
    gemini_fallback_model: str | None = "gemini-3.5-flash-lite"
    tavily_api_key: str | None = None
    max_text_chars: int = 20000
    max_url_chars: int = 2048
    max_upload_bytes: int = 524288000

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env", "../.env"), env_file_encoding="utf-8", extra="ignore")


settings = Settings()
