from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnalyticsData, Page
from app.schemas_phase2 import AnalyticsDataOut
from app.services.canonical_matching import find_analytics_rows
from app.services.pagination import DEFAULT_SKIP, fetch_page, set_page_headers

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/data", response_model=list[AnalyticsDataOut])
def list_analytics_data(
    response: Response,
    project_id: int | None = Query(None),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    skip: int = Query(DEFAULT_SKIP, ge=0),
    limit: int = Query(5000, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    q = db.query(AnalyticsData)
    if project_id is not None:
        q = q.filter(AnalyticsData.project_id == project_id)
    if from_date:
        q = q.filter(AnalyticsData.date >= from_date)
    if to_date:
        q = q.filter(AnalyticsData.date <= to_date)
    q = q.order_by(AnalyticsData.date.desc())
    items, total = fetch_page(q, skip, limit)
    set_page_headers(response, total, skip, limit)
    return items


@router.get("/by-page", response_model=list[AnalyticsDataOut])
def analytics_by_page(
    page_id: int = Query(...),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    page = db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Página no encontrada")
    return find_analytics_rows(db, page, from_date=from_date, to_date=to_date)
