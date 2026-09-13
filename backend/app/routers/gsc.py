from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GscData, Page
from app.schemas_phase2 import GscDataOut
from app.services.canonical_matching import find_gsc_rows
from app.services.pagination import DEFAULT_SKIP, fetch_page, set_page_headers

router = APIRouter(prefix="/gsc", tags=["gsc"])


@router.get("/data", response_model=list[GscDataOut])
def list_gsc_data(
    response: Response,
    project_id: int | None = Query(None),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    skip: int = Query(DEFAULT_SKIP, ge=0),
    limit: int = Query(5000, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    q = db.query(GscData)
    if project_id is not None:
        q = q.filter(GscData.project_id == project_id)
    if from_date:
        q = q.filter(GscData.date >= from_date)
    if to_date:
        q = q.filter(GscData.date <= to_date)
    q = q.order_by(GscData.date.desc(), GscData.clicks.desc())
    items, total = fetch_page(q, skip, limit)
    set_page_headers(response, total, skip, limit)
    return items


@router.get("/by-page", response_model=list[GscDataOut])
def gsc_by_page(
    page_id: int = Query(...),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    page = db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Página no encontrada")
    return find_gsc_rows(db, page, from_date=from_date, to_date=to_date)
