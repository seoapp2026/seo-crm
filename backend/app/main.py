from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.constants import API_PREFIX
from app.database import Base, engine
from app.routers import (
    ads,
    ai,
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
    projects,
    prompts,
    sync_jobs,
    urls,
    wordpress,
)
from app.seed import seed_if_empty
from app.seed_phase2 import seed_phase2
from app.services.sync_scheduler import start_scheduler

app = FastAPI(
    title="CRM SEO",
    version="0.3.0",
    docs_url=settings.docs_url,
    redoc_url=None,
    openapi_url=settings.openapi_url,
)

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
]

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
    Base.metadata.create_all(bind=engine)
    seed_if_empty()
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        seed_phase2(db)
    finally:
        db.close()
    start_scheduler()


@app.get(f"{API_PREFIX}/health")
def health():
    return {"status": "ok", "env": settings.app_env, "phase": 2}


def _mount_frontend():
    static_root = Path(settings.resolved_static_dir).resolve()
    if not static_root.is_dir():
        return

    assets_dir = static_root / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    api_segment = API_PREFIX.lstrip("/")

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