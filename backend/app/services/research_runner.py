"""Option 2 research job runner — stub pack in PR1; live DataForSEO in PR2."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Project,
    ResearchBacklinkSummary,
    ResearchJob,
    ResearchJobStatus,
    ResearchKeyword,
    ResearchLinkGap,
    ResearchOpportunity,
    ResearchPageSnapshot,
    ResearchSerpRow,
)
from app.services.research_caps import (
    CapViolation,
    domain_from_url,
    estimate_cost_eur,
    get_caps,
    validate_analysis_inputs,
)

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def credentials_configured() -> bool:
    return bool((settings.dataforseo_login or "").strip() and (settings.dataforseo_password or "").strip())


def should_use_stub() -> bool:
    if settings.dataforseo_force_stub:
        return True
    return not credentials_configured()


def monthly_spend(db: Session) -> tuple[str, int, float]:
    now = _now()
    ym = f"{now.year:04d}-{now.month:02d}"
    q = (
        db.query(
            func.count(ResearchJob.id),
            func.coalesce(func.sum(ResearchJob.actual_cost_eur), 0.0),
        )
        .filter(ResearchJob.status == ResearchJobStatus.done)
        .filter(extract("year", ResearchJob.finished_at) == now.year)
        .filter(extract("month", ResearchJob.finished_at) == now.month)
    )
    count, spend = q.one()
    return ym, int(count or 0), float(spend or 0.0)


def assert_can_start(db: Session, project_id: int) -> None:
    caps = get_caps()
    running_project = (
        db.query(ResearchJob)
        .filter(
            ResearchJob.project_id == project_id,
            ResearchJob.status.in_([ResearchJobStatus.queued, ResearchJobStatus.running]),
        )
        .count()
    )
    if running_project >= caps.max_concurrent_per_project:
        raise CapViolation("Ya hay un análisis en curso para este proyecto. Espera a que termine.")

    running_global = (
        db.query(ResearchJob)
        .filter(ResearchJob.status.in_([ResearchJobStatus.queued, ResearchJobStatus.running]))
        .count()
    )
    if running_global >= caps.max_concurrent_global:
        raise CapViolation("Hay demasiados análisis en curso. Inténtalo en unos minutos.")

    if caps.hard_monthly_eur and caps.hard_monthly_eur > 0:
        _, _, spend = monthly_spend(db)
        if spend >= caps.hard_monthly_eur:
            raise CapViolation(
                f"Tope mensual hard alcanzado ({caps.hard_monthly_eur:.0f} €). "
                "Sube DATAFORSEO_HARD_MONTHLY_EUR o espera al próximo mes."
            )


def create_job(
    db: Session,
    *,
    project_id: int,
    site_url: str | None,
    competitor_urls: list[str],
    seed_keywords: list[str],
    country: str,
    language: str,
    page_type,
) -> ResearchJob:
    project = db.get(Project, project_id)
    if not project:
        raise CapViolation("Proyecto no encontrado")

    site, comps, seeds = validate_analysis_inputs(
        site_url=site_url,
        competitor_urls=competitor_urls,
        seed_keywords=seed_keywords,
    )
    assert_can_start(db, project_id)

    caps = get_caps()
    est = estimate_cost_eur(
        seed_count=len(seeds),
        competitor_count=len(comps),
        has_site=bool(site),
        caps=caps,
    )

    job = ResearchJob(
        project_id=project_id,
        site_url=site,
        competitor_urls_json=json.dumps(comps, ensure_ascii=False),
        seed_keywords_json=json.dumps(seeds, ensure_ascii=False),
        country=(country or "es")[:8],
        language=(language or "es")[:8],
        page_type=page_type,
        status=ResearchJobStatus.queued,
        estimated_cost_eur=est,
        used_stub=should_use_stub(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def run_job(db: Session, job_id: int) -> ResearchJob:
    job = db.get(ResearchJob, job_id)
    if not job:
        raise CapViolation("Análisis no encontrado")
    if job.status not in (ResearchJobStatus.queued, ResearchJobStatus.error):
        # allow re-read; only run from queued (error retry optional)
        if job.status == ResearchJobStatus.running:
            return job
        if job.status == ResearchJobStatus.done:
            return job

    job.status = ResearchJobStatus.running
    job.started_at = _now()
    job.error_message = None
    db.commit()

    try:
        if should_use_stub():
            _run_stub(db, job)
            job.used_stub = True
            job.actual_cost_eur = 0.0
            job.ai_report = _build_stub_ai_report(job)
        else:
            from app.services.dataforseo_client import DataForSeoClient
            from app.services.research_live import build_live_ai_report, run_live_pack

            client = DataForSeoClient()
            if not client.configured:
                raise CapViolation(
                    "DataForSEO no configurado. Define DATAFORSEO_LOGIN y DATAFORSEO_PASSWORD "
                    "o activa DATAFORSEO_FORCE_STUB=true."
                )
            cost = run_live_pack(db, job, client)
            job.used_stub = False
            job.actual_cost_eur = float(cost)
            # surface partial failures if all calls failed
            if client.calls and all(not c.ok for c in client.calls):
                errs = "; ".join((c.error or c.path) for c in client.calls[:3])
                raise CapViolation(f"DataForSEO no devolvió datos útiles: {errs}")
            job.ai_report = build_live_ai_report(job, db)

        job.status = ResearchJobStatus.done
        job.finished_at = _now()
        db.commit()
        db.refresh(job)
        return job
    except CapViolation as exc:
        logger.warning("Research job %s cap/config error: %s", job_id, exc)
        job.status = ResearchJobStatus.error
        job.error_message = str(exc)[:500]
        job.finished_at = _now()
        db.commit()
        db.refresh(job)
        raise
    except Exception as exc:
        logger.exception("Research job %s failed: %s", job_id, exc)
        job.status = ResearchJobStatus.error
        job.error_message = str(exc)[:500]
        job.finished_at = _now()
        db.commit()
        db.refresh(job)
        raise


def _run_stub(db: Session, job: ResearchJob) -> None:
    """Deterministic fixture snapshot so UI/history work without spending API credits."""
    caps = get_caps()
    seeds = json.loads(job.seed_keywords_json or "[]")
    comps = json.loads(job.competitor_urls_json or "[]")
    if not seeds:
        seeds = ["keyword ejemplo", "servicio local", "comparativa producto"]

    # Keywords
    stored = 0
    for i, term in enumerate(seeds[: caps.max_keywords_stored]):
        db.add(
            ResearchKeyword(
                job_id=job.id,
                term=term,
                volume=max(50, 12000 - i * 700),
                intent=["informacional", "comercial", "transaccional"][i % 3],
                cpc=round(0.15 + (i % 5) * 0.22, 2),
                competition=["LOW", "MEDIUM", "HIGH"][i % 3],
                source="seed",
            )
        )
        stored += 1
    # a few expanded ideas
    for i, base in enumerate(seeds[:5]):
        if stored >= caps.max_keywords_stored:
            break
        db.add(
            ResearchKeyword(
                job_id=job.id,
                term=f"{base} precio",
                volume=max(20, 800 - i * 50),
                intent="transaccional",
                cpc=0.9,
                competition="MEDIUM",
                source="idea",
            )
        )
        stored += 1

    # SERP
    serp_queries = seeds[: caps.max_serp_queries]
    for q in serp_queries:
        for pos in range(1, min(6, caps.max_serp_results_per_query + 1)):
            dom = f"ejemplo{pos}.com"
            if comps and pos <= len(comps):
                dom = domain_from_url(comps[pos - 1]) or dom
            db.add(
                ResearchSerpRow(
                    job_id=job.id,
                    query=q,
                    position=pos,
                    url=f"https://{dom}/pagina-{pos}",
                    title=f"Resultado {pos} para {q}",
                    domain=dom,
                )
            )

    # Page snapshot
    if job.site_url:
        db.add(
            ResearchPageSnapshot(
                job_id=job.id,
                url=job.site_url,
                title="Título de ejemplo (stub)",
                meta_description="Meta description de ejemplo generada en modo stub sin llamar a DataForSEO.",
                h1_json=json.dumps(["H1 principal de ejemplo"], ensure_ascii=False),
                h2_json=json.dumps(["Beneficios", "Precios", "FAQ"], ensure_ascii=False),
                h3_json=json.dumps(["Detalle 1", "Detalle 2"], ensure_ascii=False),
                links_json=json.dumps(
                    [{"href": "/contacto", "text": "Contacto"}, {"href": "/blog", "text": "Blog"}],
                    ensure_ascii=False,
                ),
            )
        )

    # Backlinks summaries
    domains: list[tuple[str, bool]] = []
    if job.site_url:
        d = domain_from_url(job.site_url)
        if d:
            domains.append((d, True))
    for c in comps:
        d = domain_from_url(c)
        if d:
            domains.append((d, False))
    if not domains:
        domains = [("tusitio.example", True), ("rival.example", False)]

    ref_sets: dict[str, set[str]] = {}
    for i, (dom, is_target) in enumerate(domains):
        refs = {f"ref{j}-{dom.split('.')[0]}.org" for j in range(1, 8)}
        if not is_target:
            refs.add("oportunidad-compartida.net")
            refs.add(f"media-nicho-{i}.com")
        ref_sets[dom] = refs
        sample = [{"url": f"https://{r}/enlace", "domain": r} for r in list(refs)[:5]]
        db.add(
            ResearchBacklinkSummary(
                job_id=job.id,
                domain=dom,
                is_target=is_target,
                backlinks_count=120 + i * 40,
                referring_domains=len(refs) * 3,
                sample_json=json.dumps(sample, ensure_ascii=False),
            )
        )

    target_dom = next((d for d, t in domains if t), None)
    target_refs = ref_sets.get(target_dom or "", set())
    gap_n = 0
    for dom, is_target in domains:
        if is_target:
            continue
        for ref in sorted(ref_sets.get(dom, set()) - target_refs):
            if gap_n >= caps.max_link_gaps:
                break
            db.add(
                ResearchLinkGap(
                    job_id=job.id,
                    domain=ref,
                    linked_to_competitor=dom,
                    note="Enlaza al competidor y no a tu dominio (stub)",
                )
            )
            gap_n += 1

    db.add_all(
        [
            ResearchOpportunity(
                job_id=job.id,
                kind="content_gap",
                title="Cubrir intención comercial de la keyword principal",
                detail="Los rivales rankean con comparativas; valora una página TSR.",
                priority=1,
            ),
            ResearchOpportunity(
                job_id=job.id,
                kind="link_gap",
                title="Medios que enlazan a competidores",
                detail=f"{gap_n} dominios de oportunidad detectados (datos stub).",
                priority=2,
            ),
            ResearchOpportunity(
                job_id=job.id,
                kind="onpage",
                title="Reforzar H2 de FAQ y precios",
                detail="Snapshot stub sugiere ampliar secciones de decisión de compra.",
                priority=2,
            ),
        ]
    )
    db.flush()


def _build_stub_ai_report(job: ResearchJob) -> str:
    seeds = json.loads(job.seed_keywords_json or "[]")
    comps = json.loads(job.competitor_urls_json or "[]")
    site = job.site_url or "(proyecto sin URL aún)"
    mode = "STUB (sin gasto DataForSEO)" if job.used_stub or should_use_stub() else "live"
    return f"""# Informe de estrategia SEO (Option 2)

**Modo:** {mode}  
**Proyecto ID:** {job.project_id}  
**URL analizada:** {site}  
**Tipo de contenido principal:** {job.page_type.value}  
**País / idioma:** {job.country} / {job.language}

## Resumen
Este informe organiza la investigación en una propuesta de estructura. Revisa y aprueba antes de crear páginas en el CRM.

## Keywords semilla
{chr(10).join(f"- {s}" for s in seeds) or "- (ninguna — se usaron ejemplos stub)"}

## Competidores
{chr(10).join(f"- {c}" for c in comps) or "- (ninguno)"}

## Propuesta de arquitectura
### Homepage
Mensaje claro de propuesta de valor + rutas a clusters principales.

### Categorías / clusters
1. Cluster informacional (TSG) alrededor de la keyword principal  
2. Cluster comercial (TSR) para comparativas  
3. Reseñas puntuales (TSA) solo con **hechos de producto** guardados en el CRM  

### Enlazado interno
- Pilares → satélites  
- Evitar páginas huérfanas  
- Anclas descriptivas (no “pincha aquí”)

### Monetización y journey
- Descubrimiento (TSG) → consideración (TSR) → decisión (TSA / lead)  
- No inventar precios ni stock: usar la ficha de **Productos**

## Oportunidades (desde snapshot)
- Content gap vs SERP de ejemplo  
- Link gap básico vs competidores  
- Mejora on-page del snapshot  

## Siguiente paso
1. Revisa keywords y oportunidades en las pestañas del análisis  
2. Crea nichos/páginas en el CRM  
3. Añade productos reales antes de generar reseñas con IA  

---
*Datos de esta ejecución: fixture stub hasta activar DataForSEO (PR2). Re-leer este informe no genera coste de API.*
"""


def job_to_competitor_list(job: ResearchJob) -> list[str]:
    try:
        return json.loads(job.competitor_urls_json or "[]")
    except json.JSONDecodeError:
        return []


def job_to_seed_list(job: ResearchJob) -> list[str]:
    try:
        return json.loads(job.seed_keywords_json or "[]")
    except json.JSONDecodeError:
        return []
