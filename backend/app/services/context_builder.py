import json
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import AiPrompt, Competitor, InternalLink, Keyword, Niche, Page, Project
from app.schemas_phase2 import AssistantRunRequest, ContextPreviewRequest, ContextPreviewResponse
from app.services.performance import build_performance_summary


def build_assistant_context(
    db: Session,
    payload: AssistantRunRequest | ContextPreviewRequest,
) -> tuple[AiPrompt, str, str, dict[str, Any]]:
    """
    Builds the full system prompt, user prompt, and resolved entity snapshot
    for an AI prompt execution or context preview.
    """
    prompt: AiPrompt | None = None
    if payload.prompt_id:
        prompt = db.get(AiPrompt, payload.prompt_id)
    elif payload.prompt_slug:
        prompt = db.query(AiPrompt).filter(AiPrompt.slug == payload.prompt_slug).first()
    elif payload.assistant:
        slug_val = payload.assistant.value if hasattr(payload.assistant, "value") else str(payload.assistant)
        prompt = db.query(AiPrompt).filter(AiPrompt.slug == slug_val).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt o asistente no encontrado")

    resolved_entities: dict[str, Any] = {
        "prompt_id": prompt.id,
        "prompt_slug": prompt.slug,
        "prompt_name": prompt.name,
    }

    context_blocks: list[str] = []

    # 1. Project Context
    project = db.get(Project, payload.project_id)
    if project:
        resolved_entities["project_name"] = project.name
        context_blocks.append(f"PROYECTO: {project.name}" + (f" — {project.description}" if project.description else ""))

    # 2. Niche Context
    niche_id = payload.niche_id
    page_obj: Page | None = None
    if payload.page_id:
        page_obj = db.get(Page, payload.page_id)
        if page_obj and not niche_id:
            niche_id = page_obj.niche_id

    if niche_id:
        niche = db.get(Niche, niche_id)
        if niche:
            monetization_val = niche.monetization.value if hasattr(niche.monetization, "value") else str(niche.monetization)
            resolved_entities["niche_name"] = niche.name
            resolved_entities["niche_topic"] = niche.topic
            resolved_entities["monetization"] = monetization_val
            topic_str = f" — {niche.topic}" if niche.topic else ""
            context_blocks.append(f"NICHO: {niche.name}{topic_str} (Monetización: {monetization_val})")
            if niche.layout_template_text:
                resolved_entities["layout_template"] = niche.layout_template_text
                context_blocks.append(f"REGLAS DE MAQUETACIÓN DEL NICHO:\n{niche.layout_template_text}")

    # 3. Page Context & Silo Hierarchy
    if page_obj:
        page_type_val = page_obj.type.value if hasattr(page_obj.type, "value") else str(page_obj.type)
        page_state_val = page_obj.state.value if hasattr(page_obj.state, "value") else str(page_obj.state)
        resolved_entities["page_title"] = page_obj.title
        resolved_entities["page_type"] = page_type_val
        resolved_entities["page_state"] = page_state_val
        page_lines = [
            f"PÁGINA: {page_obj.title} (Tipo: {page_type_val}, Estado: {page_state_val})",
        ]
        if page_obj.h1:
            resolved_entities["h1"] = page_obj.h1
            page_lines.append(f"H1 EXPLÍCITO: {page_obj.h1}")
        if page_obj.seo_title or page_obj.seo_description:
            resolved_entities["seo_title"] = page_obj.seo_title
            resolved_entities["seo_description"] = page_obj.seo_description
            page_lines.append(f"RANK MATH / META: Título: {page_obj.seo_title or page_obj.title} | Descripción: {page_obj.seo_description or '—'}")
        if page_obj.breadcrumb_label:
            resolved_entities["breadcrumb_label"] = page_obj.breadcrumb_label
            page_lines.append(f"BREADCRUMB: {page_obj.breadcrumb_label}")
        if page_obj.wp_category:
            resolved_entities["wp_category"] = page_obj.wp_category
            page_lines.append(f"CATEGORÍA WP: {page_obj.wp_category}")
        if page_obj.objective:
            page_lines.append(f"OBJETIVO: {page_obj.objective}")
        if page_obj.outline_json and page_obj.outline_json != "[]":
            page_lines.append(f"ESTRUCTURA OUTLINE (H2/H3): {page_obj.outline_json}")

        # Silo hierarchy
        if page_obj.parent_page_id:
            parent = db.get(Page, page_obj.parent_page_id)
            if parent:
                resolved_entities["parent_page"] = parent.title
                page_lines.append(f"JERARQUÍA SILO: Subpágina de «{parent.title}»")
        else:
            page_lines.append("JERARQUÍA SILO: Página Pilar (Raíz)")

        context_blocks.append("\n".join(page_lines))

        # 4. Keywords
        kws = db.query(Keyword).filter(Keyword.page_id == page_obj.id).all()
        if kws:
            primary_kw = next((k for k in kws if k.is_primary), None)
            secondary_kws = [k for k in kws if not k.is_primary]
            kw_lines = []
            if primary_kw:
                resolved_entities["focus_keyword"] = primary_kw.term
                kw_lines.append(f"★ KEYWORD PRINCIPAL (Focus): {primary_kw.term} ({primary_kw.intent.value})")
            if secondary_kws:
                resolved_entities["secondary_keywords"] = [k.term for k in secondary_kws]
                kw_lines.append("KEYWORDS SECUNDARIAS: " + ", ".join(f"{k.term} ({k.intent.value})" for k in secondary_kws))
            context_blocks.append("\n".join(kw_lines))

        # 5. Internal Links
        out_links = db.query(InternalLink).filter(InternalLink.from_page_id == page_obj.id).all()
        if out_links:
            target_pages = [db.get(Page, l.to_page_id) for l in out_links]
            link_titles = [p.title for p in target_pages if p]
            if link_titles:
                resolved_entities["internal_links_out"] = link_titles
                context_blocks.append("ENLACES INTERNOS A INCLUIR: " + ", ".join(link_titles))

    # 6. Competitor Context
    if payload.competitor_id:
        comp = db.get(Competitor, payload.competitor_id)
        if comp:
            resolved_entities["competitor_domain"] = comp.domain
            context_blocks.append(f"COMPETIDOR DE REFERENCIA: {comp.domain}" + (f" — {comp.notes}" if comp.notes else ""))

    # 7. Performance Metrics (GSC / GA4)
    slug_str = prompt.slug.lower()
    used_metrics = (
        slug_str in ("content_generator", "continuous_optimizer")
        or "gsc" in prompt.system_prompt.lower()
        or "métricas" in prompt.system_prompt.lower()
    )
    if used_metrics:
        summary = build_performance_summary(db, payload.project_id)
        if payload.page_id:
            perf = next((p for p in summary.pages if p.page_id == payload.page_id), None)
            if perf:
                resolved_entities["metrics"] = {
                    "clicks_28d": perf.clicks_28d,
                    "impressions_28d": perf.impressions_28d,
                    "position_28d": perf.position_28d,
                    "sessions_28d": perf.sessions_28d,
                    "trend_pct": perf.trend_pct,
                }
                context_blocks.append(
                    f"MÉTRICAS REALES (28 DÍAS): clicks={perf.clicks_28d}, impresiones={perf.impressions_28d}, "
                    f"posición media={perf.position_28d:.1f}, sesiones={perf.sessions_28d}, tendencia={perf.trend_pct:+.1f}%"
                )

    # 8. Extra user instructions
    if payload.extra_context and payload.extra_context.strip():
        resolved_entities["extra_instructions"] = payload.extra_context.strip()
        context_blocks.append(f"INSTRUCCIONES EXTRA DEL USUARIO:\n{payload.extra_context.strip()}")

    user_prompt = "\n\n".join(context_blocks) if context_blocks else "Analiza el proyecto según tu rol."
    system_prompt = prompt.system_prompt

    return prompt, system_prompt, user_prompt, resolved_entities


def get_context_preview(db: Session, payload: ContextPreviewRequest) -> ContextPreviewResponse:
    prompt, system_prompt, user_prompt, resolved = build_assistant_context(db, payload)
    model = payload.model or prompt.model_default
    full_text = f"""=== PROMPT DE SISTEMA ===
{system_prompt}

=== PROMPT DE USUARIO Y CONTEXTO RESOLVIDO ===
{user_prompt}"""

    word_count = len(full_text.split())
    estimated_tokens = max(1, len(full_text) // 4)

    return ContextPreviewResponse(
        prompt_id=prompt.id,
        prompt_name=prompt.name,
        prompt_slug=prompt.slug,
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        full_prompt_text=full_text,
        word_count=word_count,
        estimated_tokens=estimated_tokens,
        resolved_entities=resolved,
    )
