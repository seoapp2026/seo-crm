import json

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AiPrompt, AssistantSlug, Competitor, Keyword, Niche, Page
from app.schemas_phase2 import AssistantRunRequest, AssistantRunResponse
from app.services.performance import build_performance_summary


async def run_assistant(db: Session, payload: AssistantRunRequest) -> AssistantRunResponse:
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY no configurada")

    prompt = db.query(AiPrompt).filter(AiPrompt.slug == payload.assistant).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Asistente no encontrado")

    model = payload.model or prompt.model_default
    used_metrics = payload.assistant in (
        AssistantSlug.content_generator,
        AssistantSlug.continuous_optimizer,
    )

    context_parts = []
    if payload.niche_id:
        niche = db.get(Niche, payload.niche_id)
        if niche:
            context_parts.append(f"NICHO: {niche.name} — {niche.topic or ''}")
    if payload.page_id:
        page = db.get(Page, payload.page_id)
        if page:
            kws = db.query(Keyword).filter(Keyword.page_id == page.id).all()
            context_parts.append(f"PÁGINA: {page.title} ({page.type.value})")
            context_parts.append(f"OBJETIVO: {page.objective or '—'}")
            context_parts.append("KEYWORDS: " + ", ".join(k.term for k in kws))
    if payload.competitor_id:
        comp = db.get(Competitor, payload.competitor_id)
        if comp:
            context_parts.append(f"COMPETIDOR: {comp.domain} — {comp.notes or ''}")
    if used_metrics:
        summary = build_performance_summary(db, payload.project_id)
        if payload.page_id:
            perf = next((p for p in summary.pages if p.page_id == payload.page_id), None)
            if perf:
                context_parts.append(
                    f"MÉTRICAS 28d: clicks={perf.clicks_28d}, impresiones={perf.impressions_28d}, "
                    f"posición={perf.position_28d}, sesiones={perf.sessions_28d}, tendencia={perf.trend_pct}%"
                )
    if payload.extra_context:
        context_parts.append(f"CONTEXTO EXTRA: {payload.extra_context}")

    user_prompt = "\n".join(context_parts) or "Analiza el proyecto según tu rol."

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": prompt.system_prompt},
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
        assistant=payload.assistant,
        rendered=rendered,
        model_used=model,
        used_metrics=used_metrics and bool(context_parts),
    )