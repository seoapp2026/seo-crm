import os

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.constants import API_PREFIX


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Core (Phase 1) ──────────────────────────────────────────────────────
    database_url: str = "sqlite:///./seo_crm.db"
    openai_api_key: str = ""
    cors_origins: str = "http://localhost:5173"
    secret_key: str = "change-me-in-production"
    app_env: str = "development"
    serve_frontend: bool = True
    frontend_url: str = ""

    # ── Server (Railway sets PORT automatically) ────────────────────────────
    port: int = 8000
    static_dir: str = ""

    # ── Google OAuth (Phase 2) ────────────────────────────────────────────────
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    # ── Google service targets (Phase 2) ────────────────────────────────────
    gsc_site_url: str = ""
    ga4_property_id: str = ""
    google_ads_developer_token: str = ""
    google_ads_customer_id: str = ""

    # ── Background sync schedules — cron (Phase 2) ──────────────────────────
    sync_gsc_cron: str = "0 6 * * *"
    sync_ga4_cron: str = "0 7 * * *"
    sync_ads_cron: str = "0 8 * * 1"

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    @property
    def docs_enabled(self) -> bool:
        flag = os.getenv("ENABLE_API_DOCS", "").lower()
        if flag in ("1", "true", "yes"):
            return True
        if flag in ("0", "false", "no"):
            return False
        return self.app_env != "production"

    @field_validator("serve_frontend", mode="before")
    @classmethod
    def parse_serve_frontend(cls, v):
        if isinstance(v, str):
            return v.lower() in ("1", "true", "yes")
        return bool(v) if v is not None else True

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        if self.frontend_url:
            origins.append(self.frontend_url.rstrip("/"))
        railway_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN")
        if railway_domain:
            origins.append(f"https://{railway_domain}")
        return list(dict.fromkeys(origins))

    @property
    def resolved_static_dir(self) -> str:
        if self.static_dir:
            return self.static_dir
        return os.getenv("STATIC_DIR", "../frontend/dist")

    @property
    def docs_url(self) -> str | None:
        return f"{API_PREFIX}/docs" if self.docs_enabled else None

    @property
    def openapi_url(self) -> str | None:
        return f"{API_PREFIX}/openapi.json" if self.docs_enabled else None


settings = Settings()