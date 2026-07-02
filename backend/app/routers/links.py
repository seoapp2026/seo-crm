from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import InternalLink
from app.schemas import InternalLinkCreate, InternalLinkOut, InternalLinkUpdate

router = APIRouter(prefix="/links", tags=["links"])


@router.get("", response_model=list[InternalLinkOut])
def list_links(project_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(InternalLink)
    if project_id is not None:
        q = q.filter(InternalLink.project_id == project_id)
    return q.order_by(InternalLink.created_at.desc()).all()


@router.post("", response_model=InternalLinkOut, status_code=201)
def create_link(payload: InternalLinkCreate, db: Session = Depends(get_db)):
    if payload.from_page_id == payload.to_page_id:
        raise HTTPException(status_code=400, detail="Origen y destino deben ser distintos")
    link = InternalLink(**payload.model_dump())
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.patch("/{link_id}", response_model=InternalLinkOut)
def update_link(link_id: int, payload: InternalLinkUpdate, db: Session = Depends(get_db)):
    link = db.get(InternalLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Enlace no encontrado")
    data = payload.model_dump(exclude_unset=True)
    from_id = data.get("from_page_id", link.from_page_id)
    to_id = data.get("to_page_id", link.to_page_id)
    if from_id == to_id:
        raise HTTPException(status_code=400, detail="Origen y destino deben ser distintos")
    for field, value in data.items():
        setattr(link, field, value)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/{link_id}", status_code=204)
def delete_link(link_id: int, db: Session = Depends(get_db)):
    link = db.get(InternalLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Enlace no encontrado")
    db.delete(link)
    db.commit()