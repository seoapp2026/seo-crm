from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.models import ResearchJob
from app.schemas_phase2 import (
    ResearchBudgetOut,
    ResearchCapsOut,
    ResearchJobCreate,
    ResearchJobDetailOut,
    ResearchJobOut,
)
from app.services.research_caps import CapViolation, get_caps
from app.services.research_runner import (
    create_job,
    credentials_configured,
    job_to_competitor_list,
    job_to_seed_list,
    monthly_spend,
    run_job,
    should_use_stub,
)

router = APIRouter(prefix="/research", tags=["research"])


def _job_out(job: ResearchJob) -> ResearchJobOut:
    return ResearchJobOut(
        id=job.id,
        project_id=job.project_id,
        site_url=job.site_url,
        competitor_urls=job_to_competitor_list(job),
        seed_keywords=job_to_seed_list(job),
        country=job.country,
        language=job.language,
        page_type=job.page_type,
        status=job.status,
        error_message=job.error_message,
        estimated_cost_eur=job.estimated_cost_eur,
        actual_cost_eur=job.actual_cost_eur,
        ai_report=job.ai_report,
        used_stub=job.used_stub,
        started_at=job.started_at,
        finished_at=job.finished_at,
        created_at=job.created_at,
    )


def _job_detail(job: ResearchJob) -> ResearchJobDetailOut:
    base = _job_out(job).model_dump()
    return ResearchJobDetailOut(
        **base,
        keywords=job.keywords,
        serp_rows=job.serp_rows,
        page_snapshots=job.page_snapshots,
        backlink_summaries=job.backlink_summaries,
        link_gaps=job.link_gaps,
        opportunities=job.opportunities,
    )


@router.get("/caps", response_model=ResearchCapsOut)
def research_caps():
    caps = get_caps()
    return ResearchCapsOut(
        max_competitors=caps.max_competitors,
        max_seed_keywords=caps.max_seed_keywords,
        max_keywords_stored=caps.max_keywords_stored,
        max_serp_queries=caps.max_serp_queries,
        max_serp_results_per_query=caps.max_serp_results_per_query,
        max_page_snapshots=caps.max_page_snapshots,
        max_backlinks_per_domain=caps.max_backlinks_per_domain,
        max_referring_domains=caps.max_referring_domains,
        max_link_gaps=caps.max_link_gaps,
        soft_monthly_eur=caps.soft_monthly_eur,
        hard_monthly_eur=caps.hard_monthly_eur,
        credentials_configured=credentials_configured(),
        force_stub=bool(settings.dataforseo_force_stub) or should_use_stub(),
    )


@router.get("/budget", response_model=ResearchBudgetOut)
def research_budget(db: Session = Depends(get_db)):
    caps = get_caps()
    ym, runs, spend = monthly_spend(db)
    soft = caps.soft_monthly_eur
    hard = caps.hard_monthly_eur
    return ResearchBudgetOut(
        year_month=ym,
        runs_count=runs,
        spend_eur=round(spend, 2),
        soft_monthly_eur=soft,
        hard_monthly_eur=hard,
        soft_warning=bool(soft and spend >= soft * 0.8),
        hard_blocked=bool(hard and hard > 0 and spend >= hard),
    )


@router.get("/jobs", response_model=list[ResearchJobOut])
def list_jobs(project_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(ResearchJob)
    if project_id is not None:
        q = q.filter(ResearchJob.project_id == project_id)
    jobs = q.order_by(ResearchJob.created_at.desc()).limit(100).all()
    return [_job_out(j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=ResearchJobDetailOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = (
        db.query(ResearchJob)
        .options(
            joinedload(ResearchJob.keywords),
            joinedload(ResearchJob.serp_rows),
            joinedload(ResearchJob.page_snapshots),
            joinedload(ResearchJob.backlink_summaries),
            joinedload(ResearchJob.link_gaps),
            joinedload(ResearchJob.opportunities),
        )
        .filter(ResearchJob.id == job_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    return _job_detail(job)


@router.post("/jobs", response_model=ResearchJobDetailOut, status_code=201)
def start_job(payload: ResearchJobCreate, db: Session = Depends(get_db)):
    try:
        job = create_job(
            db,
            project_id=payload.project_id,
            site_url=payload.site_url,
            competitor_urls=payload.competitor_urls,
            seed_keywords=payload.seed_keywords,
            country=payload.country,
            language=payload.language,
            page_type=payload.page_type,
        )
        job = run_job(db, job.id)
    except CapViolation as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:400]) from exc

    # reload with relations
    return get_job(job.id, db)
