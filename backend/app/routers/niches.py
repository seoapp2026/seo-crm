from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Niche
from app.schemas import NicheCreate, NicheOut, NicheUpdate
from app.services.cascade_delete import purge_niche
from app.services.pagination import DEFAULT_LIMIT, DEFAULT_SKIP, MAX_LIMIT, fetch_page, set_page_headers

router = APIRouter(prefix="/niches", tags=["niches"])


@router.get("", response_model=list[NicheOut])
def list_niches(
    response: Response,
    project_id: int | None = Query(None),
    skip: int = Query(DEFAULT_SKIP, ge=0),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    db: Session = Depends(get_db),
):
    q = db.query(Niche)
    if project_id is not None:
        q = q.filter(Niche.project_id == project_id)
    q = q.order_by(Niche.created_at.desc())
    items, total = fetch_page(q, skip, limit)
    set_page_headers(response, total, skip, limit)
    return items


@router.post("", response_model=NicheOut, status_code=201)
def create_niche(payload: NicheCreate, db: Session = Depends(get_db)):
    niche = Niche(**payload.model_dump())
    db.add(niche)
    db.commit()
    db.refresh(niche)
    return niche


@router.patch("/{niche_id}", response_model=NicheOut)
def update_niche(niche_id: int, payload: NicheUpdate, db: Session = Depends(get_db)):
    niche = db.get(Niche, niche_id)
    if not niche:
        raise HTTPException(status_code=404, detail="Nicho no encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(niche, field, value)
    db.commit()
    db.refresh(niche)
    return niche


@router.delete("/{niche_id}", status_code=204)
def delete_niche(niche_id: int, db: Session = Depends(get_db)):
    niche = db.get(Niche, niche_id)
    if not niche:
        raise HTTPException(status_code=404, detail="Nicho no encontrado")
    try:
        purge_niche(db, niche)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="No se pudo eliminar el nicho: quedan datos relacionados.",
        ) from exc