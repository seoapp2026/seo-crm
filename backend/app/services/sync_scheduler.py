import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import GoogleAuth, GoogleServiceType, Project, SyncJob, SyncJobStatus, SyncJobType
from app.services.ga4_sync import sync_ga4_for_project
from app.services.gsc_sync import sync_gsc_for_project

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def _run_job(job_type: SyncJobType):
    db = SessionLocal()
    try:
        for project in db.query(Project).all():
            job = (
                db.query(SyncJob)
                .filter(SyncJob.project_id == project.id, SyncJob.job_type == job_type, SyncJob.enabled.is_(True))
                .first()
            )
            if not job:
                continue
            auth_service = GoogleServiceType.gsc if job_type == SyncJobType.gsc else GoogleServiceType.ga4
            auth = (
                db.query(GoogleAuth)
                .filter(GoogleAuth.project_id == project.id, GoogleAuth.service == auth_service)
                .first()
            )
            if not auth or not auth.refresh_token:
                continue
            try:
                if job_type == SyncJobType.gsc:
                    sync_gsc_for_project(db, project.id)
                elif job_type == SyncJobType.ga4:
                    sync_ga4_for_project(db, project.id)
            except Exception as exc:
                logger.exception("Sync %s failed for project %s", job_type, project.id)
                job.status = SyncJobStatus.error
                job.last_error = str(exc)
                job.last_run_at = datetime.now(timezone.utc)
                db.commit()
    finally:
        db.close()


def _sync_error_message(exc: Exception) -> str:
    try:
        from googleapiclient.errors import HttpError

        if isinstance(exc, HttpError):
            return f"Error de Google API ({exc.resp.status}): {exc.reason or exc.resp.reason}"
    except Exception:
        pass
    return str(exc) or "Error de sincronización"


def _mark_job_failed(db: Session, job: SyncJob, message: str) -> None:
    job.status = SyncJobStatus.error
    job.last_error = message[:500]
    job.last_run_at = datetime.now(timezone.utc)
    db.commit()


def run_sync_job_now(db: Session, job_id: int) -> SyncJob:
    job = db.get(SyncJob, job_id)
    if not job:
        raise ValueError("Trabajo no encontrado")
    if not job.enabled:
        raise ValueError(job.last_error or "Trabajo deshabilitado")

    if job.status == SyncJobStatus.running:
        job.status = SyncJobStatus.idle
        job.last_error = None
        db.commit()

    try:
        if job.job_type == SyncJobType.gsc:
            sync_gsc_for_project(db, job.project_id)
        elif job.job_type == SyncJobType.ga4:
            sync_ga4_for_project(db, job.project_id)
        elif job.job_type == SyncJobType.ads:
            raise ValueError("Google Ads sync no implementado aún")
    except ValueError:
        db.refresh(job)
        if job.status == SyncJobStatus.running:
            _mark_job_failed(db, job, "Error de sincronización")
        raise
    except Exception as exc:
        message = _sync_error_message(exc)
        logger.exception("Manual sync failed for job %s", job_id)
        db.refresh(job)
        if job.status == SyncJobStatus.running:
            _mark_job_failed(db, job, message)
        raise ValueError(message) from exc

    db.refresh(job)
    return job


def start_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(_run_job, CronTrigger.from_crontab(settings.sync_gsc_cron), args=[SyncJobType.gsc], id="sync_gsc")
    scheduler.add_job(_run_job, CronTrigger.from_crontab(settings.sync_ga4_cron), args=[SyncJobType.ga4], id="sync_ga4")
    scheduler.start()
    logger.info("Background sync scheduler started")