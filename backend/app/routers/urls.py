from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Url
from app.schemas import UrlCreate, UrlOut, UrlUpdate

router = APIRouter(prefix="/urls", tags=["urls"])


@router.get("", response_model=list[UrlOut])
def list_urls(project_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Url)
    if project_id is not None:
        q = q.filter(Url.project_id == project_id)
    return q.order_by(Url.created_at.desc()).all()


@router.post("", response_model=UrlOut, status_code=201)
def create_url(payload: UrlCreate, db: Session = Depends(get_db)):
    url = Url(**payload.model_dump())
    db.add(url)
    db.commit()
    db.refresh(url)
    return url


@router.patch("/{url_id}", response_model=UrlOut)
def update_url(url_id: int, payload: UrlUpdate, db: Session = Depends(get_db)):
    url = db.get(Url, url_id)
    if not url:
        raise HTTPException(status_code=404, detail="URL no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(url, field, value)
    db.commit()
    db.refresh(url)
    return url


@router.delete("/{url_id}", status_code=204)
def delete_url(url_id: int, db: Session = Depends(get_db)):
    url = db.get(Url, url_id)
    if not url:
        raise HTTPException(status_code=404, detail="URL no encontrada")
    db.delete(url)
    db.commit()