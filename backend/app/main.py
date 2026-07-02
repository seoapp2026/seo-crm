from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.routers import ai, dashboard, keywords, links, niches, notes, pages, projects, urls
from app.seed import seed_if_empty

app = FastAPI(title="CRM SEO", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api")
app.include_router(niches.router, prefix="/api")
app.include_router(pages.router, prefix="/api")
app.include_router(keywords.router, prefix="/api")
app.include_router(urls.router, prefix="/api")
app.include_router(links.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(ai.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    seed_if_empty()


@app.get("/api/health")
def health():
    return {"status": "ok", "env": settings.app_env}


def _mount_frontend():
    static_root = Path(settings.resolved_static_dir).resolve()
    if not static_root.is_dir():
        return

    assets_dir = static_root / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = static_root / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        index = static_root / "index.html"
        if index.is_file():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built")


_mount_frontend()