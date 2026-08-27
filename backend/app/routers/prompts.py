import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AiPrompt
from app.schemas_phase2 import (
    AiPromptCreate,
    AiPromptOut,
    AiPromptReorderItem,
    AiPromptUpdate,
)

router = APIRouter(prefix="/ai/prompts", tags=["ai-prompts"])


def _generate_unique_slug(db: Session, base_slug: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", base_slug.strip().lower())
    if not cleaned:
        cleaned = "prompt"
    slug = cleaned
    counter = 1
    while db.query(AiPrompt).filter(AiPrompt.slug == slug).first() is not None:
        slug = f"{cleaned}_{counter}"
        counter += 1
    return slug


@router.get("", response_model=list[AiPromptOut])
def list_prompts(
    project_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(AiPrompt)
    if project_id is not None:
        query = query.filter((AiPrompt.project_id == project_id) | (AiPrompt.project_id.is_(None)))
    return query.order_by(AiPrompt.sort_order.asc(), AiPrompt.id.asc()).all()


@router.post("", response_model=AiPromptOut, status_code=201)
def create_prompt(payload: AiPromptCreate, db: Session = Depends(get_db)):
    slug = payload.slug.strip().lower()
    if not slug:
        raise HTTPException(status_code=400, detail="El slug no puede estar vacío")
    
    existing = db.query(AiPrompt).filter(AiPrompt.slug == slug).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe un prompt con el slug '{slug}'")

    sort_order = payload.sort_order
    if sort_order == 0:
        max_order = db.query(AiPrompt.sort_order).order_by(AiPrompt.sort_order.desc()).first()
        if max_order and max_order[0] is not None:
            sort_order = max_order[0] + 10

    prompt = AiPrompt(
        slug=slug,
        name=payload.name.strip(),
        description=payload.description.strip(),
        system_prompt=payload.system_prompt,
        model_default=payload.model_default or "gpt-4o-mini",
        sort_order=sort_order,
        is_system=payload.is_system,
        project_id=payload.project_id,
    )
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return prompt


@router.get("/{prompt_id}", response_model=AiPromptOut)
def get_prompt(prompt_id: int, db: Session = Depends(get_db)):
    row = db.get(AiPrompt, prompt_id)
    if not row:
        raise HTTPException(status_code=404, detail="Prompt no encontrado")
    return row


@router.patch("/{prompt_id}", response_model=AiPromptOut)
def update_prompt(prompt_id: int, payload: AiPromptUpdate, db: Session = Depends(get_db)):
    row = db.get(AiPrompt, prompt_id)
    if not row:
        raise HTTPException(status_code=404, detail="Prompt no encontrado")
    
    updates = payload.model_dump(exclude_unset=True)
    if "slug" in updates and updates["slug"]:
        new_slug = updates["slug"].strip().lower()
        if new_slug != row.slug:
            existing = db.query(AiPrompt).filter(AiPrompt.slug == new_slug).first()
            if existing and existing.id != row.id:
                raise HTTPException(status_code=400, detail=f"Ya existe un prompt con el slug '{new_slug}'")
            updates["slug"] = new_slug

    for field, value in updates.items():
        setattr(row, field, value)
    
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{prompt_id}", status_code=204)
def delete_prompt(
    prompt_id: int,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    row = db.get(AiPrompt, prompt_id)
    if not row:
        raise HTTPException(status_code=404, detail="Prompt no encontrado")
    
    if row.is_system and not force:
        raise HTTPException(
            status_code=400,
            detail="Este es un prompt base del sistema. Usa force=true para confirmar su eliminación.",
        )
    
    db.delete(row)
    db.commit()
    return None


@router.post("/{prompt_id}/duplicate", response_model=AiPromptOut, status_code=201)
def duplicate_prompt(prompt_id: int, db: Session = Depends(get_db)):
    source = db.get(AiPrompt, prompt_id)
    if not source:
        raise HTTPException(status_code=404, detail="Prompt origen no encontrado")
    
    new_slug = _generate_unique_slug(db, f"{source.slug}_copia")
    new_name = f"{source.name} (Copia)"
    
    copy = AiPrompt(
        slug=new_slug,
        name=new_name,
        description=source.description,
        system_prompt=source.system_prompt,
        model_default=source.model_default,
        sort_order=source.sort_order + 1,
        is_system=False,
        project_id=source.project_id,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return copy


@router.post("/reorder", response_model=list[AiPromptOut])
def reorder_prompts(items: list[AiPromptReorderItem], db: Session = Depends(get_db)):
    for item in items:
        row = db.get(AiPrompt, item.id)
        if row:
            row.sort_order = item.sort_order
    db.commit()
    return db.query(AiPrompt).order_by(AiPrompt.sort_order.asc(), AiPrompt.id.asc()).all()