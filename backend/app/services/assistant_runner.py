import json

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.schemas_phase2 import AssistantRunRequest, AssistantRunResponse
from app.services.context_builder import build_assistant_context


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
    return AssistantRunResponse(
        assistant=prompt.slug,
        prompt_id=prompt.id,
        prompt_name=prompt.name,
        rendered=rendered,
        model_used=model,
        used_metrics=used_metrics,
        context_used=resolved_entities,
    )