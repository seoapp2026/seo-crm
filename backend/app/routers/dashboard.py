from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Keyword, Niche, NicheState, Page, PageState, Project, Url
from app.schemas import DashboardStats, NicheStateCount, PageOut
from app.services.seo_insights import cannibalized_terms, orphan_pages

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(project_id: int | None = Query(None), db: Session = Depends(get_db)):
    def scoped(model):
        q = db.query(model)
        if project_id is not None and hasattr(model, "project_id"):
            q = q.filter(model.project_id == project_id)
        return q

    niches_q = scoped(Niche)
    pages_q = scoped(Page)
    keywords_q = scoped(Keyword)
    urls_q = scoped(Url)

    niches = niches_q.all()
    pages = pages_q.order_by(Page.created_at.desc()).all()

    niche_by_state: dict[str, int] = {}
    for state in NicheState:
        niche_by_state[state.value] = sum(1 for n in niches if n.state == state)

    orphans = orphan_pages(db, project_id)
    cannibalized = sorted(cannibalized_terms(db, project_id))

    return DashboardStats(
        projects=db.query(Project).count() if project_id is None else 1,
        niches=len(niches),
        pages=len(pages),
        keywords=keywords_q.count(),
        urls=urls_q.count(),
        published_pages=sum(1 for p in pages if p.state == PageState.publicado),
        draft_pages=sum(1 for p in pages if p.state in (PageState.borrador, PageState.en_revision)),
        scaling_niches=sum(1 for n in niches if n.state == NicheState.escalando),
        niche_by_state=[NicheStateCount(state=k, count=v) for k, v in niche_by_state.items()],
        recent_pages=[PageOut.model_validate(p) for p in pages[:5]],
        orphan_pages=[PageOut.model_validate(p) for p in orphans],
        cannibalized_terms=cannibalized,
    )