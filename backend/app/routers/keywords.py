from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Keyword
from app.schemas import (
    AutoTagIntentRequest,
    AutoTagIntentResponse,
    ClusterApplyRequest,
    ClusterApplyResponse,
    ClusterSuggestionRequest,
    ClusterSuggestionResponse,
    KeywordCreate,
    KeywordOut,
    KeywordUpdate,
)
from app.services.clustering_service import (
    auto_tag_keywords_intent,
    apply_keyword_clusters,
    suggest_keyword_clusters,
)
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
    if payload.is_primary:
        db.query(Keyword).filter(Keyword.page_id == payload.page_id, Keyword.is_primary.is_(True)).update({"is_primary": False})
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
    updates = payload.model_dump(exclude_unset=True)
    target_page_id = updates.get("page_id", keyword.page_id)
    if updates.get("is_primary"):
        db.query(Keyword).filter(
            Keyword.page_id == target_page_id,
            Keyword.id != keyword.id,
            Keyword.is_primary.is_(True)
        ).update({"is_primary": False})
    for field, value in updates.items():
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


@router.post("/auto-tag-intent", response_model=AutoTagIntentResponse)
def auto_tag_intent(payload: AutoTagIntentRequest, db: Session = Depends(get_db)):
    return auto_tag_keywords_intent(
        db=db,
        project_id=payload.project_id,
        niche_id=payload.niche_id,
        keyword_ids=payload.keyword_ids,
    )


@router.post("/suggest-clusters", response_model=ClusterSuggestionResponse)
def suggest_clusters(payload: ClusterSuggestionRequest, db: Session = Depends(get_db)):
    return suggest_keyword_clusters(
        db=db,
        project_id=payload.project_id,
        niche_id=payload.niche_id,
        unassigned_only=payload.unassigned_only,
    )


@router.post("/apply-clusters", response_model=ClusterApplyResponse)
def apply_clusters(payload: ClusterApplyRequest, db: Session = Depends(get_db)):
    return apply_keyword_clusters(
        db=db,
        project_id=payload.project_id,
        clusters=payload.clusters,
    )