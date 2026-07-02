from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Competitor
from app.schemas_phase2 import CompetitorCreate, CompetitorOut, CompetitorUpdate

router = APIRouter(prefix="/competitors", tags=["competitors"])


@router.get("", response_model=list[CompetitorOut])
def list_competitors(project_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Competitor)
    if project_id is not None:
        q = q.filter(Competitor.project_id == project_id)
    return q.order_by(Competitor.created_at.desc()).all()


@router.post("", response_model=CompetitorOut, status_code=201)
def create_competitor(payload: CompetitorCreate, db: Session = Depends(get_db)):
    row = Competitor(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{competitor_id}", response_model=CompetitorOut)
def update_competitor(competitor_id: int, payload: CompetitorUpdate, db: Session = Depends(get_db)):
    row = db.get(Competitor, competitor_id)
    if not row:
        raise HTTPException(status_code=404, detail="Competidor no encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{competitor_id}", status_code=204)
def delete_competitor(competitor_id: int, db: Session = Depends(get_db)):
    row = db.get(Competitor, competitor_id)
    if not row:
        raise HTTPException(status_code=404, detail="Competidor no encontrado")
    db.delete(row)
    db.commit()