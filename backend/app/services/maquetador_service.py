import json
from typing import Any

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AiPrompt, ContentDraft, DraftStatus, Keyword, Niche, Page, Product


DEFAULT_DIVI_LAYOUT = """
ESTRUCTURA DE MAQUETACIÓN WORDPRESS / DIVI LIMPIA:
- <header class="entry-header"> con H1 y resumen destacado
- <div class="quick-summary-box"> con bullet points de conclusiones clave
- <div class="comparison-table-wrapper"> con tabla HTML comparativa responsiva
- <div class="product-cards-container"> tarjetas de productos con H3, características, pros/contras, y botón CTA
- <section class="content-sections"> desarrollo de secciones H2 y H3 informacionales
- <section class="faq-accordion"> preguntas y respuestas frecuentes preparadas para Schema FAQ
"""

MAQUETADOR_SYSTEM_PROMPT = (
    "Eres un maquetador web y redactor técnico SEO experto en WordPress y Divi. "
    "Tu objetivo es transformar el contenido de un artículo/página y sus metadatos SEO "
    "en código HTML maquetado, limpio, semántico y preparado para producción en WordPress. "
    "Reglas estrictas:\n"
    "1. Usa etiquetas semánticas (<article>, <header>, <section>, <table>, <h3>, <p>, <ul>, <li>).\n"
    "2. Incluye clases CSS limpias y estilizadas para cajas de pros/contras, tablas comparativas y llamadas a la acción (CTA).\n"
    "3. Sigue al pie de la letra la plantilla de maquetación del nicho.\n"
    "4. Respeta el H1, las palabras clave principales y secundarias, y la estructura de encabezados.\n"
    "5. Devuelve ÚNICAMENTE el bloque de código HTML limpio sin explicaciones ni markdown envolvente.\n"
    "6. Los datos comerciales de productos (precio, características, valoraciones) deben tomarse "
    "ÚNICAMENTE de los datos de producto aportados en el contexto; nunca los inventes."
)


def _render_fallback_html(page: Page, niche: Niche, keywords: list[Keyword], draft_text: str, template: str) -> str:
    h1_text = page.h1 or page.title
    primary_kw = next((k.term for k in keywords if k.is_primary), keywords[0].term if keywords else page.title)
    kw_badges = " ".join(f"<span class='badge'>{k.term}</span>" for k in keywords)

    return f"""<article class="et_pb_post_content page-layout">
  <header class="entry-header">
    <h1 class="entry-title">{h1_text}</h1>
    <p class="lead-summary">Guía completa y comparativa actualizada sobre <strong>{primary_kw}</strong>.</p>
    <div class="keyword-tags">{kw_badges}</div>
  </header>

  <div class="quick-summary-box" style="background:#f8fafc; border-left:4px solid #0284c7; padding:16px; margin:24px 0; border-radius:8px;">
    <h3>📌 Resumen rápido y recomendación</h3>
    <p>En este análisis exhaustivo de {niche.name}, seleccionamos las mejores opciones con base en calidad, rendimiento y precio.</p>
  </div>

  <section class="main-content">
    <h2>Análisis detallado</h2>
    <div class="draft-body">
      {draft_text or f"<p>Contenido principal para {page.title} enfocado en la intención {page.type.value}.</p>"}
    </div>
  </section>

  <section class="faq-section" style="margin-top:32px; padding:16px; background:#fafafa; border-radius:8px;">
    <h2>Preguntas Frecuentes sobre {h1_text}</h2>
    <div class="faq-item">
      <h3>¿Cuál es la mejor opción en relación calidad-precio?</h3>
      <p>La opción destacada según nuestra comparativa reúne el mejor equilibrio en durabilidad, garantía y precio competitivo.</p>
    </div>
  </section>
</article>"""


async def run_maquetador(
    db: Session,
    page_id: int,
    draft_id: int | None = None,
    custom_layout_template: str | None = None,
    model: str = "gpt-4o",
    save_to_page: bool = True,
    replace_existing: bool = False,
) -> tuple[ContentDraft, str, bool, str | None]:
    page = db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Página no encontrada")

    niche = db.get(Niche, page.niche_id)
    if not niche:
        raise HTTPException(status_code=404, detail="Nicho no encontrado")

    keywords = list(db.scalars(select(Keyword).where(Keyword.page_id == page_id)))

    # Determine source text
    source_draft: ContentDraft | None = None
    if draft_id:
        source_draft = db.get(ContentDraft, draft_id)
    else:
        # Pick latest draft
        source_draft = (
            db.query(ContentDraft)
            .filter(ContentDraft.page_id == page_id)
            .order_by(ContentDraft.created_at.desc())
            .first()
        )

    draft_text = source_draft.draft_body if source_draft and source_draft.draft_body else (page.objective or "")

    # Determine layout template
    layout_template = custom_layout_template or niche.layout_template_text or DEFAULT_DIVI_LAYOUT

    primary_kw = next((k.term for k in keywords if k.is_primary), None)
    secondary_kws = [k.term for k in keywords if not k.is_primary]

    # Linked product facts for this project (W4): commercial data comes only from here.
    products = list(db.query(Product).filter(Product.project_id == page.project_id).all())
    product_lines = [
        f"- {p.name}"
        + (f" | Marca: {p.brand}" if p.brand else "")
        + (f" | Precio: {p.price} {p.currency}" if p.price is not None else "")
        + (f" | Características: {p.features}" if p.features else "")
        + (f" | Valoración: {p.rating}" if p.rating else "")
        for p in products
    ]
    products_block = "DATOS DE PRODUCTOS (fuente única de datos comerciales):\n" + "\n".join(product_lines)

    context_snapshot = {
        "page_id": page.id,
        "page_title": page.title,
        "h1": page.h1,
        "seo_title": page.seo_title,
        "seo_description": page.seo_description,
        "breadcrumb_label": page.breadcrumb_label,
        "wp_category": page.wp_category,
        "focus_keyword": primary_kw,
        "secondary_keywords": secondary_kws,
        "layout_template": layout_template,
        "products": [p.name for p in products] if products else None,
    }

    user_prompt = (
        f"DATOS DE LA PÁGINA:\n"
        f"- Título: {page.title}\n"
        f"- H1 Explícito: {page.h1 or page.title}\n"
        f"- Tipo: {page.type.value}\n"
        f"- Nicho: {niche.name} ({niche.topic or ''})\n"
        f"- Categoría WP: {page.wp_category or niche.name}\n"
        f"- Keyword Principal: {primary_kw or 'No definida'}\n"
        f"- Keywords Secundarias: {', '.join(secondary_kws) if secondary_kws else 'Ninguna'}\n"
        f"- Outline / Esquema: {page.outline_json or '[]'}\n\n"
        f"PLANTILLA / REGLAS DE MAQUETACIÓN APLICABLES:\n{layout_template}\n\n"
        + (products_block + "\n\n" if product_lines else "")
        + f"TEXTO / BORRADOR FUENTE:\n{draft_text or 'Crea la estructura completa maquetada según la temática y keywords.'}\n\n"
        "Genera el código HTML maquetado final para WordPress/Divi."
    )

    content_html = ""

    if settings.openai_api_key:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": MAQUETADOR_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.5,
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    content=json.dumps(payload, ensure_ascii=False),
                )
            if response.status_code == 200:
                data = response.json()
                content_html = data["choices"][0]["message"]["content"]
                if content_html.startswith("```html"):
                    content_html = content_html[7:]
                if content_html.startswith("```"):
                    content_html = content_html[3:]
                if content_html.endswith("```"):
                    content_html = content_html[:-3]
                content_html = content_html.strip()
            else:
                content_html = _render_fallback_html(page, niche, keywords, draft_text, layout_template)
        except Exception:
            content_html = _render_fallback_html(page, niche, keywords, draft_text, layout_template)
    else:
        content_html = _render_fallback_html(page, niche, keywords, draft_text, layout_template)

    maquetador_prompt = db.query(AiPrompt).filter(AiPrompt.slug == "maquetador").first()

    draft = ContentDraft(
        page_id=page.id,
        draft_body=draft_text,
        content_html=content_html,
        draft_kind="maquetado",
        source_prompt_id=maquetador_prompt.id if maquetador_prompt else None,
        context_used_json=json.dumps(context_snapshot, ensure_ascii=False),
        model_used=model,
        status=DraftStatus.borrador,
    )
    db.add(draft)

    page_updated = False
    message: str | None = None
    if save_to_page:
        if page.content_html and not replace_existing:
            message = (
                "La página ya tenía contenido maquetado: se guardó el borrador "
                "pero NO se sobrescribió el HTML existente."
            )
        else:
            page.content_html = content_html
            if page.content_status == "borrador":
                page.content_status = "revisado"
            page_updated = True

    db.commit()
    db.refresh(draft)
    if save_to_page:
        db.refresh(page)

    return draft, content_html, page_updated, message
