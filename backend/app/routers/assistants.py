from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas_phase2 import AssistantRunRequest, AssistantRunResponse
from app.services.assistant_runner import run_assistant

router = APIRouter(prefix="/ai/assistants", tags=["ai-assistants"])


@router.post("/run", response_model=AssistantRunResponse)
async def run(payload: AssistantRunRequest, db: Session = Depends(get_db)):
    return await run_assistant(db, payload)