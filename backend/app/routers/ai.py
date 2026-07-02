from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ContentDraftOut, GenerateContentRequest, GenerateContentResponse
from app.services.ai_generator import generate_draft

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/generate", response_model=GenerateContentResponse)
async def generate_content(payload: GenerateContentRequest, db: Session = Depends(get_db)):
    draft, rendered = await generate_draft(db, payload.page_id, payload.model)
    return GenerateContentResponse(
        draft=ContentDraftOut.model_validate(draft),
        rendered=rendered,
    )