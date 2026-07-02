from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AiPrompt
from app.schemas_phase2 import AiPromptOut, AiPromptUpdate

router = APIRouter(prefix="/ai/prompts", tags=["ai-prompts"])


@router.get("", response_model=list[AiPromptOut])
def list_prompts(db: Session = Depends(get_db)):
    return db.query(AiPrompt).order_by(AiPrompt.id).all()


@router.patch("/{prompt_id}", response_model=AiPromptOut)
def update_prompt(prompt_id: int, payload: AiPromptUpdate, db: Session = Depends(get_db)):
    row = db.get(AiPrompt, prompt_id)
    if not row:
        raise HTTPException(status_code=404, detail="Prompt no encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row