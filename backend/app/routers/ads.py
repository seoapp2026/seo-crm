from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AdsKeyword
from app.schemas_phase2 import AdsKeywordOut
from app.services.pagination import DEFAULT_LIMIT, DEFAULT_SKIP, MAX_LIMIT, fetch_page, set_page_headers

router = APIRouter(prefix="/ads", tags=["ads"])


@router.get("/keywords", response_model=list[AdsKeywordOut])
def list_ads_keywords(
    response: Response,
    project_id: int | None = Query(None),
    skip: int = Query(DEFAULT_SKIP, ge=0),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    db: Session = Depends(get_db),
):
    q = db.query(AdsKeyword)
    if project_id is not None:
        q = q.filter(AdsKeyword.project_id == project_id)
    q = q.order_by(AdsKeyword.volume.desc())
    items, total = fetch_page(q, skip, limit)
    set_page_headers(response, total, skip, limit)
    return items
