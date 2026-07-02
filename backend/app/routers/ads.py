from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AdsKeyword
from app.schemas_phase2 import AdsKeywordOut

router = APIRouter(prefix="/ads", tags=["ads"])


@router.get("/keywords", response_model=list[AdsKeywordOut])
def list_ads_keywords(project_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(AdsKeyword)
    if project_id is not None:
        q = q.filter(AdsKeyword.project_id == project_id)
    return q.order_by(AdsKeyword.volume.desc()).all()