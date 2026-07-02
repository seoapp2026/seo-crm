from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GscData
from app.schemas_phase2 import GscDataOut

router = APIRouter(prefix="/gsc", tags=["gsc"])


@router.get("/data", response_model=list[GscDataOut])
def list_gsc_data(
    project_id: int | None = Query(None),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    q = db.query(GscData)
    if project_id is not None:
        q = q.filter(GscData.project_id == project_id)
    if from_date:
        q = q.filter(GscData.date >= from_date)
    if to_date:
        q = q.filter(GscData.date <= to_date)
    return q.order_by(GscData.date.desc(), GscData.clicks.desc()).limit(5000).all()