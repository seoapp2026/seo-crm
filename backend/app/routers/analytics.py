from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnalyticsData
from app.schemas_phase2 import AnalyticsDataOut

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/data", response_model=list[AnalyticsDataOut])
def list_analytics_data(
    project_id: int | None = Query(None),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    q = db.query(AnalyticsData)
    if project_id is not None:
        q = q.filter(AnalyticsData.project_id == project_id)
    if from_date:
        q = q.filter(AnalyticsData.date >= from_date)
    if to_date:
        q = q.filter(AnalyticsData.date <= to_date)
    return q.order_by(AnalyticsData.date.desc()).limit(5000).all()