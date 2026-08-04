"""Populate research job snapshots from live DataForSEO responses."""

from __future__ import annotations

import json
import logging
from typing import Any
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.models import (
    ResearchBacklinkSummary,
    ResearchJob,
    ResearchKeyword,
    ResearchLinkGap,
    ResearchOpportunity,
    ResearchPageSnapshot,
    ResearchSerpRow,
)
from app.services.dataforseo_client import DataForSeoClient, domain_only, resolve_language_code, resolve_location_code
from app.services.research_caps import get_caps

logger = logging.getLogger(__name__)


def _host(url: str | None) -> str | None:
    if not url:
        return None
    try:
        raw = url if "://" in url else f"https://{url}"
        h = urlparse(raw).hostname or ""
        return h.lower().removeprefix("www.") or None
    except Exception:
        return None


def _competition_label(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        v = value.upper()
        if v in ("LOW", "MEDIUM", "HIGH"):
            return v
        return v[:20] or None
    try:
        f = float(value)
        if f < 0.33:
            return "LOW"
        if f < 0.66:
            return "MEDIUM"
        return "HIGH"
    except (TypeError, ValueError):
        return None


def run_live_pack(db: Session, job: ResearchJob, client: DataForSeoClient) -> float:
    """Fill job child tables from DataForSEO. Returns cost in EUR (USD≈EUR for estimate)."""
    caps = get_caps()
    seeds = json.loads(job.seed_keywords_json or "[]")
    comps = json.loads(job.competitor_urls_json or "[]")
    location_code = resolve_location_code(job.country)
    language_code = resolve_language_code(job.language)

    # 1) Keyword volumes for seeds
    volume_rows = client.search_volume(
        seeds[: caps.max_seed_keywords],
        location_code=location_code,
        language_code=language_code,
    )
    by_term: dict[str, dict[str, Any]] = {}
    for row in volume_rows:
        term = (row.get("keyword") or "").strip()
        if not term:
            continue
        by_term[term.casefold()] = row

    stored = 0
    for term in seeds[: caps.max_keywords_stored]:
        row = by_term.get(term.casefold(), {})
        vol = int(row.get("search_volume") or 0)
        cpc = float(row.get("cpc") or 0) or 0.0
        comp = _competition_label(row.get("competition") or row.get("competition_index"))
        db.add(
            ResearchKeyword(
                job_id=job.id,
                term=term,
                volume=vol,
                intent=None,
                cpc=round(cpc, 2),
                competition=comp,
                source="seed",
            )
        )
        stored += 1

    # 2) Related keywords from first seed (capped expansion)
    remaining = caps.max_keywords_stored - stored
    if seeds and remaining > 0:
        related = client.related_keywords(
            seeds[0],
            location_code=location_code,
            language_code=language_code,
            limit=min(remaining, 30),
        )
        seen = {s.casefold() for s in seeds}
        extra_terms: list[str] = []
        for item in related:
            # Labs related_keywords shape: keyword_data.keyword / keyword
            kd = item.get("keyword_data") or item
            kw_info = kd.get("keyword_info") or {}
            term = (kd.get("keyword") or item.get("keyword") or "").strip()
            if not term or term.casefold() in seen:
                continue
            seen.add(term.casefold())
            extra_terms.append(term)
            vol = int(kw_info.get("search_volume") or kd.get("search_volume") or 0)
            cpc = float(kw_info.get("cpc") or kd.get("cpc") or 0) or 0.0
            intent_info = (kd.get("search_intent_info") or {})
            intent = intent_info.get("main_intent") or None
            db.add(
                ResearchKeyword(
                    job_id=job.id,
                    term=term,
                    volume=vol,
                    intent=str(intent) if intent else None,
                    cpc=round(cpc, 2),
                    competition=_competition_label(kw_info.get("competition")),
                    source="idea",
                )
            )
            stored += 1
            if stored >= caps.max_keywords_stored:
                break
        # fill volume for extras missing volume via one more volume call if needed
        missing_vol = [t for t in extra_terms if t]
        if missing_vol:
            # already may have volume from labs; optional top-up skipped to save cost
            pass

    # 3) SERP for top seeds
    serp_queries = seeds[: caps.max_serp_queries] if seeds else []
    if not serp_queries and job.site_url:
        d = domain_only(job.site_url)
        if d:
            serp_queries = [d.split(".")[0]]
    for q in serp_queries:
        items = client.serp_organic(
            q,
            location_code=location_code,
            language_code=language_code,
            depth=max(10, caps.max_serp_results_per_query),
        )
        pos = 0
        for item in items:
            if pos >= caps.max_serp_results_per_query:
                break
            url = item.get("url") or ""
            if not url:
                continue
            pos += 1
            rank = int(item.get("rank_group") or item.get("rank_absolute") or pos)
            db.add(
                ResearchSerpRow(
                    job_id=job.id,
                    query=q,
                    position=rank,
                    url=url,
                    title=item.get("title"),
                    domain=_host(url),
                )
            )

    # 4) On-page snapshot (1 URL max)
    if job.site_url and caps.max_page_snapshots >= 1:
        page = client.instant_page(job.site_url)
        if page:
            meta = page.get("meta") or {}
            htags = meta.get("htags") or {}
            h1 = htags.get("h1") or []
            h2 = htags.get("h2") or []
            h3 = htags.get("h3") or []
            if isinstance(h1, str):
                h1 = [h1]
            if isinstance(h2, str):
                h2 = [h2]
            if isinstance(h3, str):
                h3 = [h3]
            # basic links from meta counts if full list not present
            links = []
            for key in ("internal_links_count", "external_links_count"):
                if meta.get(key) is not None:
                    links.append({key: meta.get(key)})
            db.add(
                ResearchPageSnapshot(
                    job_id=job.id,
                    url=page.get("url") or job.site_url,
                    title=meta.get("title") or meta.get("meta_title"),
                    meta_description=meta.get("description"),
                    h1_json=json.dumps(list(h1)[:20], ensure_ascii=False),
                    h2_json=json.dumps(list(h2)[:30], ensure_ascii=False),
                    h3_json=json.dumps(list(h3)[:30], ensure_ascii=False),
                    links_json=json.dumps(links, ensure_ascii=False),
                )
            )

    # 5) Backlinks summary + referring domains for target + competitors
    domains: list[tuple[str, bool]] = []
    if job.site_url:
        d = domain_only(job.site_url)
        if d:
            domains.append((d, True))
    for c in comps[: caps.max_competitors]:
        d = domain_only(c)
        if d and d not in [x[0] for x in domains]:
            domains.append((d, False))

    ref_map: dict[str, set[str]] = {}
    for dom, is_target in domains:
        summary = client.backlinks_summary(dom) or {}
        refs = client.referring_domains(dom, limit=caps.max_referring_domains)
        ref_domains = {str(r.get("domain")).lower() for r in refs if r.get("domain")}
        ref_map[dom] = ref_domains
        sample = [
            {
                "domain": r.get("domain"),
                "backlinks": r.get("backlinks"),
                "rank": r.get("rank"),
            }
            for r in refs[:10]
        ]
        db.add(
            ResearchBacklinkSummary(
                job_id=job.id,
                domain=dom,
                is_target=is_target,
                backlinks_count=int(summary.get("backlinks") or 0),
                referring_domains=int(
                    summary.get("referring_domains")
                    or summary.get("referring_main_domains")
                    or len(ref_domains)
                    or 0
                ),
                sample_json=json.dumps(sample, ensure_ascii=False),
            )
        )

    target_dom = next((d for d, t in domains if t), None)
    target_refs = ref_map.get(target_dom or "", set())
    gap_n = 0
    for dom, is_target in domains:
        if is_target:
            continue
        for ref in sorted(ref_map.get(dom, set()) - target_refs):
            if gap_n >= caps.max_link_gaps:
                break
            db.add(
                ResearchLinkGap(
                    job_id=job.id,
                    domain=ref,
                    linked_to_competitor=dom,
                    note="Enlaza al competidor y no a tu dominio",
                )
            )
            gap_n += 1

    # 6) Opportunities derived from real data
    top_kw = (
        db.query(ResearchKeyword)
        .filter(ResearchKeyword.job_id == job.id)
        .order_by(ResearchKeyword.volume.desc())
        .limit(3)
        .all()
    )
    if top_kw:
        db.add(
            ResearchOpportunity(
                job_id=job.id,
                kind="keyword",
                title=f"Priorizar: {top_kw[0].term}",
                detail=f"Volumen {top_kw[0].volume}, CPC {top_kw[0].cpc}. Top términos: "
                + ", ".join(k.term for k in top_kw),
                priority=1,
            )
        )
    if gap_n:
        db.add(
            ResearchOpportunity(
                job_id=job.id,
                kind="link_gap",
                title=f"{gap_n} dominios enlazan a competidores y no a ti",
                detail="Revisa la pestaña Backlinks → link gap para oportunidades prácticas.",
                priority=2,
            )
        )
    snap = (
        db.query(ResearchPageSnapshot)
        .filter(ResearchPageSnapshot.job_id == job.id)
        .first()
    )
    if snap and (not snap.title or not snap.meta_description):
        db.add(
            ResearchOpportunity(
                job_id=job.id,
                kind="onpage",
                title="Completar title / meta description",
                detail="El snapshot de la URL principal muestra title o meta incompletos.",
                priority=2,
            )
        )
    elif snap:
        db.add(
            ResearchOpportunity(
                job_id=job.id,
                kind="onpage",
                title="Revisar estructura H2/H3 del snapshot",
                detail="Compara headings con la intención de las keywords prioritarias.",
                priority=3,
            )
        )

    if not seeds and not domains:
        db.add(
            ResearchOpportunity(
                job_id=job.id,
                kind="input",
                title="Añade keywords o URLs en el próximo análisis",
                detail="El pack live obtuvo pocos inputs; enriquece semillas para mejor cobertura.",
                priority=1,
            )
        )

    db.flush()
    # convert USD cost to EUR 1:1 for budget tracking (configurable later)
    return round(client.total_cost_usd, 4)


def build_live_ai_report(job: ResearchJob, db: Session) -> str:
    seeds = json.loads(job.seed_keywords_json or "[]")
    comps = json.loads(job.competitor_urls_json or "[]")
    kws = (
        db.query(ResearchKeyword)
        .filter(ResearchKeyword.job_id == job.id)
        .order_by(ResearchKeyword.volume.desc())
        .limit(15)
        .all()
    )
    opps = (
        db.query(ResearchOpportunity)
        .filter(ResearchOpportunity.job_id == job.id)
        .order_by(ResearchOpportunity.priority.asc())
        .all()
    )
    gaps = db.query(ResearchLinkGap).filter(ResearchLinkGap.job_id == job.id).count()
    snaps = db.query(ResearchPageSnapshot).filter(ResearchPageSnapshot.job_id == job.id).all()
    backs = db.query(ResearchBacklinkSummary).filter(ResearchBacklinkSummary.job_id == job.id).all()

    kw_lines = "\n".join(
        f"- **{k.term}** — vol. {k.volume:,} · CPC {k.cpc:.2f} · {k.competition or '—'} · {k.source}"
        for k in kws
    ) or "- (sin keywords en snapshot)"
    opp_lines = "\n".join(f"- ({o.priority}) **{o.title}**: {o.detail or ''}" for o in opps) or "- (sin oportunidades)"
    back_lines = "\n".join(
        f"- {'Tu sitio' if b.is_target else 'Competidor'} **{b.domain}**: {b.backlinks_count} backlinks, {b.referring_domains} ref. domains"
        for b in backs
    ) or "- (sin datos de backlinks)"
    snap_lines = ""
    for s in snaps:
        snap_lines += f"\n### {s.url}\n- Title: {s.title or '—'}\n- Meta: {s.meta_description or '—'}\n- H1: {s.h1_json}\n- H2: {s.h2_json}\n"

    site = job.site_url or "(sin URL)"
    return f"""# Informe de estrategia SEO (Option 2 · DataForSEO live)

**URL:** {site}  
**Tipo principal:** {job.page_type.value}  
**País / idioma:** {job.country} / {job.language}  
**Coste API (aprox. USD→EUR 1:1):** {job.actual_cost_eur:.4f} €  
**Modo:** datos reales DataForSEO (pack acotado)

## Keywords prioritarias
{kw_lines}

## Competidores analizados
{chr(10).join(f"- {c}" for c in comps) or "- (ninguno)"}

## Backlinks (resumen)
{back_lines}

**Link gap:** {gaps} dominios que enlazan a rivales y no a ti.

## Snapshot on-page
{snap_lines or "(sin snapshot — no se envió URL o falló el crawl)"}

## Oportunidades
{opp_lines}

## Propuesta de arquitectura
### Homepage
Propone valor + rutas a clusters de las keywords de mayor volumen.

### Clusters
1. **TSG** informacional sobre la keyword principal  
2. **TSR** comparativas donde haya intención comercial  
3. **TSA** reseñas solo con hechos del catálogo **Productos** (sin inventar precios/stock)

### Enlazado interno
- Pilares → satélites; elimina huérfanas  
- Usa anclas con keywords prioritarias de la lista

### Monetización / journey
Descubrimiento → consideración → decisión. No inventar datos de producto.

## Siguiente paso
1. Crea/actualiza nichos y páginas en el CRM  
2. Añade keywords reales en Palabras clave  
3. Completa fichas en Productos antes de generar reseñas IA  
4. Re-run solo cuando la estrategia cambie (cada run cuesta API)

---
*Reabrir este informe no llama a DataForSEO. Seeds: {", ".join(seeds) or "—"}.
"""
