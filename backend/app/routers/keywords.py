from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Keyword
from app.schemas import KeywordCreate, KeywordOut, KeywordUpdate
from app.services.seo_insights import cannibalized_page_titles, keyword_cannibalized

router = APIRouter(prefix="/keywords", tags=["keywords"])


def _to_out(kw: Keyword, db: Session) -> KeywordOut:
    data = KeywordOut.model_validate(kw)
    data.cannibalized = keyword_cannibalized(db, kw.term, kw.project_id)
    if data.cannibalized:
        data.cannibalized_on = cannibalized_page_titles(db, kw.term, kw.project_id)
    return data


@router.get("", response_model=list[KeywordOut])
def list_keywords(project_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Keyword)
    if project_id is not None:
        q = q.filter(Keyword.project_id == project_id)
    keywords = q.order_by(Keyword.created_at.desc()).all()
    return [_to_out(kw, db) for kw in keywords]


@router.post("", response_model=KeywordOut, status_code=201)
def create_keyword(payload: KeywordCreate, db: Session = Depends(get_db)):
    keyword = Keyword(**payload.model_dump())
    db.add(keyword)
    db.commit()
    db.refresh(keyword)
    return _to_out(keyword, db)


@router.patch("/{keyword_id}", response_model=KeywordOut)
def update_keyword(keyword_id: int, payload: KeywordUpdate, db: Session = Depends(get_db)):
    keyword = db.get(Keyword, keyword_id)
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(keyword, field, value)
    db.commit()
    db.refresh(keyword)
    return _to_out(keyword, db)


@router.delete("/{keyword_id}", status_code=204)
def delete_keyword(keyword_id: int, db: Session = Depends(get_db)):
    keyword = db.get(Keyword, keyword_id)
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword no encontrada")
    db.delete(keyword)
    db.commit()