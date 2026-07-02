from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Page
from app.schemas import PageCreate, PageOut, PageUpdate

router = APIRouter(prefix="/pages", tags=["pages"])


@router.get("", response_model=list[PageOut])
def list_pages(project_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Page)
    if project_id is not None:
        q = q.filter(Page.project_id == project_id)
    return q.order_by(Page.created_at.desc()).all()


@router.post("", response_model=PageOut, status_code=201)
def create_page(payload: PageCreate, db: Session = Depends(get_db)):
    page = Page(**payload.model_dump())
    db.add(page)
    db.commit()
    db.refresh(page)
    return page


@router.patch("/{page_id}", response_model=PageOut)
def update_page(page_id: int, payload: PageUpdate, db: Session = Depends(get_db)):
    page = db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Página no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(page, field, value)
    db.commit()
    db.refresh(page)
    return page


@router.delete("/{page_id}", status_code=204)
def delete_page(page_id: int, db: Session = Depends(get_db)):
    page = db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Página no encontrada")
    db.delete(page)
    db.commit()