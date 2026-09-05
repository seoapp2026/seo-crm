import json

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models import ContentDraft, DraftStatus, Keyword, Niche, Page, PageType


PROMPTS: dict[PageType, str] = {
    PageType.TSG: (
        "Eres un redactor SEO experto. Genera un borrador de GUÍA INFORMACIONAL (TSG) en español. "
        "Incluye: META TITLE, META DESCRIPTION, H1, cuerpo con H2/H3, y sección FAQ (3-5 preguntas). "
        "Tono claro y útil. No inventes datos de tráfico ni métricas."
    ),
    PageType.TSR: (
        "Eres un redactor SEO experto. Genera un borrador de COMPARATIVA COMERCIAL (TSR) en español. "
        "Incluye: META TITLE, META DESCRIPTION, H1, tabla o lista comparativa, pros/contras, "
        "recomendación final, y FAQ. Tono orientado a conversión pero honesto."
    ),
    PageType.TSA: (
        "Eres un redactor SEO experto. Genera un borrador de RESEÑA DE PRODUCTO (TSA) en español. "
        "Incluye: META TITLE, META DESCRIPTION, H1, características, ventajas, desventajas, "
        "veredicto, y FAQ. Tono de reseña detallada."
    ),
}

# W4: commercial facts may only come from the product data present in context.
COMMERCIAL_FACTS_RULE = (
    " Los datos comerciales (precio, valoración, disponibilidad) deben tomarse "
    "únicamente de los datos de producto incluidos en el contexto; nunca los inventes."
)


def _build_user_prompt(page: Page, niche: Niche, keywords: list[Keyword]) -> str:
    kw_lines = "\n".join(f"- {k.term} ({k.intent.value})" for k in keywords) or "- (sin keywords asignadas)"
    return (
        f"PÁGINA: {page.title}\n"
        f"TIPO: {page.type.value}\n"
        f"OBJETIVO: {page.objective or 'No especificado'}\n"
        f"NICHO: {niche.name} — {niche.topic or ''}\n"
        f"KEYWORDS:\n{kw_lines}\n\n"
        "Responde en español. Formato legible con etiquetas claras."
    )


async def generate_draft(db: Session, page_id: int, model: str) -> tuple[ContentDraft, str]:
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY no configurada en el servidor")

    page = db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Página no encontrada")

    niche = db.get(Niche, page.niche_id)
    if not niche:
        raise HTTPException(status_code=404, detail="Nicho no encontrado")

    from sqlalchemy import select

    keywords = list(db.scalars(select(Keyword).where(Keyword.page_id == page_id)))
    system_prompt = PROMPTS[page.type] + COMMERCIAL_FACTS_RULE
    user_prompt = _build_user_prompt(page, niche, keywords)

    payload = {
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
            content=json.dumps(payload, ensure_ascii=False),
        )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Error OpenAI: {response.text}")

    data = response.json()
    rendered = data["choices"][0]["message"]["content"]

    draft = ContentDraft(
        page_id=page_id,
        draft_body=rendered,
        meta_title=None,
        meta_description=None,
        model_used=model,
        status=DraftStatus.borrador,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft, rendered


