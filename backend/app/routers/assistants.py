from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas_phase2 import (
    AssistantRunRequest,
    AssistantRunResponse,
    ContextPreviewRequest,
    ContextPreviewResponse,
)
from app.services.assistant_runner import run_assistant
from app.services.context_builder import get_context_preview

router = APIRouter(prefix="/ai/assistants", tags=["ai-assistants"])


@router.post("/run", response_model=AssistantRunResponse)
async def run(payload: AssistantRunRequest, db: Session = Depends(get_db)):
    return await run_assistant(db, payload)


@router.post("/preview-context", response_model=ContextPreviewResponse)
def preview_context(payload: ContextPreviewRequest, db: Session = Depends(get_db)):
    return get_context_preview(db, payload)