from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Niche, Page, Project, Url
from app.schemas_phase2 import WpExportBundleOut, WpExportItemOut

router = APIRouter(prefix="/wordpress", tags=["wordpress"])


@router.get("/export", response_model=WpExportBundleOut)
def export_wordpress(project_id: int = Query(...), db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    pages = db.query(Page).filter(Page.project_id == project_id).order_by(Page.created_at).all()
    items: list[WpExportItemOut] = []

    for page in pages:
        url = db.query(Url).filter(Url.page_id == page.id).first()
        niche = db.get(Niche, page.niche_id)
        slug = url.slug if url else f"/{page.title.lower().replace(' ', '-')}"
        items.append(
            WpExportItemOut(
                page_id=page.id,
                title=page.title,
                slug=slug,
                meta_title=page.title,
                meta_description=page.objective or "",
                content_type=page.type.value,
                h1=page.title,
                status=page.state.value,
                niche_name=niche.name if niche else "",
            )
        )

    return WpExportBundleOut(
        project_name=project.name,
        exported_at=datetime.now(timezone.utc),
        pages=items,
    )