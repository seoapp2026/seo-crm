import os
from urllib.parse import urlparse

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
    app_public_url: str = ""
    app_auth_password: str = ""
    auth_allowed_emails: str = ""

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
    # MCC / Manager ID when OAuth user accesses client account via manager
    google_ads_login_customer_id: str = ""

    # ── Background sync schedules — cron (Phase 2) ──────────────────────────
    sync_gsc_cron: str = "0 6 * * *"
    sync_ga4_cron: str = "0 7 * * *"
    sync_ads_cron: str = "0 8 * * 1"

    # ── Option 2: DataForSEO research ───────────────────────────────────────
    dataforseo_login: str = ""
    dataforseo_password: str = ""
    # If true, runner uses fixture data (no live API spend). Auto-true when no credentials.
    dataforseo_force_stub: bool = False
    dataforseo_soft_monthly_eur: float = 50.0
    dataforseo_hard_monthly_eur: float = 100.0  # 0 = disabled
    dataforseo_max_competitors: int = 3
    dataforseo_max_seed_keywords: int = 20
    dataforseo_max_keywords_stored: int = 100
    dataforseo_max_serp_queries: int = 10
    dataforseo_max_serp_results: int = 10
    dataforseo_max_backlinks_per_domain: int = 50
    dataforseo_max_referring_domains: int = 50
    dataforseo_max_link_gaps: int = 100
    dataforseo_max_concurrent_global: int = 2

    # ── Official Product Providers (Amazon PA-API & eBay Browse API) ───────
    amazon_paapi_access_key: str = ""
    amazon_paapi_secret_key: str = ""
    amazon_paapi_partner_tag: str = ""
    amazon_marketplace: str = "www.amazon.es"

    ebay_app_id: str = ""
    ebay_cert_id: str = ""
    ebay_campaign_id: str = ""
    ebay_marketplace: str = "EBAY-ES"

    product_providers_force_stub: bool = False

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

    @property
    def frontend_base_url(self) -> str:
        """Public app URL for post-OAuth redirects (must match GOOGLE_REDIRECT_URI host)."""
        if self.app_public_url:
            return self.app_public_url.rstrip("/")
        if self.google_redirect_uri:
            parsed = urlparse(self.google_redirect_uri)
            if parsed.scheme and parsed.netloc:
                return f"{parsed.scheme}://{parsed.netloc}"
        for origin in self.cors_origin_list:
            if origin.startswith("https://"):
                return origin.rstrip("/")
        if self.cors_origin_list:
            return self.cors_origin_list[0].rstrip("/")
        return "http://localhost:5173"

    @property
    def auth_allowed_emails_list(self) -> list[str]:
        return [e.strip().lower() for e in self.auth_allowed_emails.split(",") if e.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        if self.app_public_url:
            origins.append(self.app_public_url.rstrip("/"))
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