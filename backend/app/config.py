from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Gemini — used for NL rule parsing and PDF/VLM extraction
    google_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash"
    use_llm_parser: bool = True
    use_vlm_parser: bool = True

    # CORS: "*" for all origins, or comma-separated URLs
    cors_origins: str = (
        "https://opptra-frontend.onrender.com,"
        "http://localhost:5173,"
        "http://127.0.0.1:5173"
    )


settings = Settings()
