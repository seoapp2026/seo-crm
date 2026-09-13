from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SyncJob, SyncJobStatus
from app.schemas_phase2 import SyncJobOut, SyncJobUpdate
from app.services.pagination import DEFAULT_LIMIT, DEFAULT_SKIP, MAX_LIMIT, fetch_page, set_page_headers
from app.services.sync_scheduler import run_sync_job_now

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/jobs", response_model=list[SyncJobOut])
def list_jobs(
    response: Response,
    project_id: int | None = Query(None),
    skip: int = Query(DEFAULT_SKIP, ge=0),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    db: Session = Depends(get_db),
):
    q = db.query(SyncJob)
    if project_id is not None:
        q = q.filter(SyncJob.project_id == project_id)
    q = q.order_by(SyncJob.id)
    items, total = fetch_page(q, skip, limit)
    set_page_headers(response, total, skip, limit)
    return items


@router.post("/jobs/{job_id}/run", response_model=SyncJobOut)
def run_job(job_id: int, db: Session = Depends(get_db)):
    try:
        job = run_sync_job_now(db, job_id)
        return job
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/jobs/{job_id}", response_model=SyncJobOut)
def update_job(job_id: int, payload: SyncJobUpdate, db: Session = Depends(get_db)):
    job = db.get(SyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado")
    if payload.enabled is not None:
        job.enabled = payload.enabled
        if payload.enabled:
            job.status = SyncJobStatus.idle
    db.commit()
    db.refresh(job)
    return job