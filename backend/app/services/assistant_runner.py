import json
import re

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models import ContentDraft, DraftStatus
from app.schemas_phase2 import AssistantRunRequest, AssistantRunResponse
from app.services.context_builder import build_assistant_context

# Best-effort extraction of the meta labels the content-generator prompts ask for
# ("META TITLE" / "META DESCRIPTION", plus Titulo/DESCRIPCION variants).
_META_TITLE_RE = re.compile(
    r"^\s*(?:#{1,4}\s*)?(?:\*\*)?"
    r"(?:META[\s\-]+T[IÍ]TULO(?:[\s\-]+SEO)?|T[IÍ]TULO[\s\-]+(?:META|SEO)|META[\s\-]+TITLE"
    r"|T[IÍ]TULO(?=\s*[:.\-])|TITLE(?=\s*[:.\-]))"
    r"(?:\*\*)?\s*[:.\-]?\s*(.+?)\s*$",
    re.IGNORECASE | re.MULTILINE,
)
_META_DESCRIPTION_RE = re.compile(
    r"^\s*(?:#{1,4}\s*)?(?:\*\*)?"
    r"(?:META[\s\-]+DESCRIPCI[ÓO]N|DESCRIPCI[ÓO]N[\s\-]+META|META[\s\-]+DESCRIPTION"
    r"|DESCRIPCI[ÓO]N(?=\s*[:.\-])|DESCRIPTION(?=\s*[:.\-]))"
    r"(?:\*\*)?\s*[:.\-]?\s*(.+?)\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def _extract_meta(pattern: re.Pattern[str], text: str) -> str | None:
    match = pattern.search(text)
    if not match:
        return None
    value = match.group(1).strip().strip("*").strip()
    return value or None


async def run_assistant(db: Session, payload: AssistantRunRequest) -> AssistantRunResponse:
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY no configurada")

    prompt, system_prompt, user_prompt, resolved_entities = build_assistant_context(db, payload)
    model = payload.model or prompt.model_default
    used_metrics = "metrics" in resolved_entities

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            content=json.dumps(body, ensure_ascii=False),
        )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Error OpenAI: {response.text}")

    rendered = response.json()["choices"][0]["message"]["content"]

    # Persist a "texto" draft tied to the page when one is targeted
    # (content_drafts.page_id is NOT NULL, so runs without a page are not saved).
    draft_id: int | None = None
    if payload.page_id:
        draft = ContentDraft(
            page_id=payload.page_id,
            draft_body=rendered,
            draft_kind="texto",
            meta_title=_extract_meta(_META_TITLE_RE, rendered),
            meta_description=_extract_meta(_META_DESCRIPTION_RE, rendered),
            source_prompt_id=prompt.id,
            context_used_json=json.dumps(resolved_entities, ensure_ascii=False),
            model_used=model,
            status=DraftStatus.borrador,
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
        draft_id = draft.id

    return AssistantRunResponse(
        assistant=prompt.slug,
        prompt_id=prompt.id,
        prompt_name=prompt.name,
        rendered=rendered,
        model_used=model,
        used_metrics=used_metrics,
        context_used=resolved_entities,
        draft_id=draft_id,
    )
