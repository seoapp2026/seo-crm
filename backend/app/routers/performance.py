from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas_phase2 import PerformanceSummaryOut
from app.services.performance import build_performance_summary

router = APIRouter(prefix="/performance", tags=["performance"])


@router.get("/summary", response_model=PerformanceSummaryOut)
def performance_summary(project_id: int | None = Query(None), db: Session = Depends(get_db)):
    return build_performance_summary(db, project_id)