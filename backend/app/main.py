from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.constants import API_PREFIX
from app.middleware.app_auth import AppAuthMiddleware
from app.routers import auth as auth_router
from app.database import Base, engine
from app.routers import (
    ads,
    ai,
    audit,
    analytics,
    assistants,
    competitors,
    dashboard,
    gsc,
    integrations,
    keywords,
    links,
    niches,
    notes,
    pages,
    performance,
    products,
    projects,
    prompts,
    rank_math,
    research,
    sync_jobs,
    urls,
    wordpress,
)
from app.migrate import run_light_migrations
from app.seed import seed_if_empty
from app.seed_phase2 import seed_phase2
from app.services.sync_scheduler import start_scheduler

app = FastAPI(
    title="SEO CRM",
    version="0.3.0",
    docs_url=settings.docs_url,
    redoc_url=None,
    openapi_url=settings.openapi_url,
)

app.add_middleware(AppAuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

phase2_routers = [
    integrations.router,
    gsc.router,
    analytics.router,
    ads.router,
    competitors.router,
    prompts.router,
    assistants.router,
    performance.router,
    sync_jobs.router,
    wordpress.router,
    audit.router,
    rank_math.router,
    products.router,
    research.router,
]

app.include_router(auth_router.router, prefix=API_PREFIX)

for r in [
    projects.router,
    niches.router,
    pages.router,
    keywords.router,
    urls.router,
    links.router,
    notes.router,
    dashboard.router,
    ai.router,
    *phase2_routers,
]:
    app.include_router(r, prefix=API_PREFIX)


@app.on_event("startup")
def on_startup():
    import logging

    log = logging.getLogger("app.startup")
    Base.metadata.create_all(bind=engine)
    run_light_migrations()
    seed_if_empty()
    from app.database import SessionLocal
    from app.services.ads_config import log_ads_config_status

    db = SessionLocal()
    try:
        seed_phase2(db)
    finally:
        db.close()
    log_ads_config_status("Startup")
    start_scheduler()
    log.info("SEO CRM startup complete env=%s", settings.app_env)


@app.get(f"{API_PREFIX}/health")
def health():
    from app.services.ads_config import ads_config_status
    from app.services.research_runner import credentials_configured, should_use_stub

    return {
        "status": "ok",
        "env": settings.app_env,
        "phase": 2,
        "google_ads": ads_config_status(),
        "dataforseo": {
            "login_set": bool((settings.dataforseo_login or "").strip()),
            "password_set": bool((settings.dataforseo_password or "").strip()),
            "credentials_configured": credentials_configured(),
            "force_stub": bool(settings.dataforseo_force_stub),
            "using_stub": should_use_stub(),
            "soft_monthly_eur": settings.dataforseo_soft_monthly_eur,
            "hard_monthly_eur": settings.dataforseo_hard_monthly_eur,
        },
    }


def _mount_frontend():
    static_root = Path(settings.resolved_static_dir).resolve()
    if not static_root.is_dir():
        return

    assets_dir = static_root / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    api_segment = API_PREFIX.lstrip("/")
    home_page = static_root / "home.html"

    @app.get("/", include_in_schema=False)
    async def public_home():
        if home_page.is_file():
            return FileResponse(home_page)
        index = static_root / "index.html"
        if index.is_file():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        if full_path == api_segment or full_path.startswith(f"{api_segment}/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = static_root / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        index = static_root / "index.html"
        if index.is_file():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built")


_mount_frontend()