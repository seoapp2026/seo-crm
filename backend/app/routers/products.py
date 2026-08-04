from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, Project
from app.schemas_phase2 import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(project_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Product)
    if project_id is not None:
        q = q.filter(Product.project_id == project_id)
    return q.order_by(Product.updated_at.desc()).all()


@router.post("", response_model=ProductOut, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    if not db.get(Project, payload.project_id):
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="El nombre del producto es obligatorio")
    row = Product(**payload.model_dump())
    row.name = payload.name.strip()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    row = db.get(Product, product_id)
    if not row:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    row = db.get(Product, product_id)
    if not row:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    db.delete(row)
    db.commit()
