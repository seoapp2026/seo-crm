from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ContentDraft
from app.schemas import (
    ContentDraftOut,
    GenerateContentRequest,
    GenerateContentResponse,
    MaquetarRequest,
    MaquetarResponse,
)
from app.services.ai_generator import generate_draft
from app.services.maquetador_service import run_maquetador

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/generate", response_model=GenerateContentResponse)
async def generate_content(payload: GenerateContentRequest, db: Session = Depends(get_db)):
    draft, rendered = await generate_draft(db, payload.page_id, payload.model)
    return GenerateContentResponse(
        draft=ContentDraftOut.model_validate(draft),
        rendered=rendered,
    )


@router.post("/maquetar", response_model=MaquetarResponse)
async def maquetar_content(payload: MaquetarRequest, db: Session = Depends(get_db)):
    draft, html, updated, message = await run_maquetador(
        db=db,
        page_id=payload.page_id,
        draft_id=payload.draft_id,
        custom_layout_template=payload.custom_layout_template,
        model=payload.model,
        save_to_page=payload.save_to_page,
        replace_existing=payload.replace_existing,
    )
    return MaquetarResponse(
        draft=ContentDraftOut.model_validate(draft),
        content_html=html,
        page_updated=updated,
        message=message,
    )


@router.get("/drafts", response_model=list[ContentDraftOut])
def list_drafts(
    page_id: int | None = Query(None),
    draft_kind: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(ContentDraft)
    if page_id is not None:
        q = q.filter(ContentDraft.page_id == page_id)
    if draft_kind is not None:
        q = q.filter(ContentDraft.draft_kind == draft_kind)
    drafts = q.order_by(ContentDraft.created_at.desc()).all()
    return [ContentDraftOut.model_validate(d) for d in drafts]