from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Page
from app.schemas import PageCreate, PageOut, PageUpdate
from app.schemas_phase2 import PageBulkUpdateRequest, PageBulkUpdateResponse
from app.services.cascade_delete import purge_page

router = APIRouter(prefix="/pages", tags=["pages"])


def _to_page_out(page: Page, db: Session) -> PageOut:
    data = PageOut.model_validate(page)
    if page.parent_page_id:
        parent = db.get(Page, page.parent_page_id)
        if parent:
            data.parent_title = parent.title
    return data


@router.get("", response_model=list[PageOut])
def list_pages(project_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Page)
    if project_id is not None:
        q = q.filter(Page.project_id == project_id)
    pages = q.order_by(Page.created_at.desc()).all()
    return [_to_page_out(p, db) for p in pages]


@router.post("", response_model=PageOut, status_code=201)
def create_page(payload: PageCreate, db: Session = Depends(get_db)):
    page = Page(**payload.model_dump())
    db.add(page)
    db.commit()
    db.refresh(page)
    return _to_page_out(page, db)


@router.patch("/{page_id}", response_model=PageOut)
def update_page(page_id: int, payload: PageUpdate, db: Session = Depends(get_db)):
    page = db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Página no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(page, field, value)
    db.commit()
    db.refresh(page)
    return _to_page_out(page, db)


@router.delete("/{page_id}", status_code=204)
def delete_page(page_id: int, db: Session = Depends(get_db)):
    page = db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Página no encontrada")
    try:
        purge_page(db, page)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="No se pudo eliminar la página: quedan datos relacionados.",
        ) from exc


@router.post("/bulk-update", response_model=PageBulkUpdateResponse)
def bulk_update_pages(
    payload: PageBulkUpdateRequest,
    db: Session = Depends(get_db),
):
    updated_ids: list[int] = []
    for item in payload.pages:
        page = db.get(Page, item.id)
        if not page or page.project_id != payload.project_id:
            continue
        data = item.model_dump(exclude={"id"}, exclude_unset=True)
        for field, value in data.items():
            if value is not None:
                if field == "type" and hasattr(value, "value"):
                    setattr(page, field, value.value)
                else:
                    setattr(page, field, value)
        updated_ids.append(page.id)

    db.commit()
    return PageBulkUpdateResponse(
        updated_count=len(updated_ids),
        updated_ids=updated_ids,
    )