import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

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


def run_sync_job_now(job_id: int) -> SyncJob:
    db = SessionLocal()
    try:
        job = db.get(SyncJob, job_id)
        if not job:
            raise ValueError("Trabajo no encontrado")
        if not job.enabled:
            raise ValueError(job.last_error or "Trabajo deshabilitado")
        if job.job_type == SyncJobType.gsc:
            sync_gsc_for_project(db, job.project_id)
        elif job.job_type == SyncJobType.ga4:
            sync_ga4_for_project(db, job.project_id)
        elif job.job_type == SyncJobType.ads:
            raise ValueError("Google Ads sync no implementado aún")
        db.refresh(job)
        return job
    finally:
        db.close()


def start_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(_run_job, CronTrigger.from_crontab(settings.sync_gsc_cron), args=[SyncJobType.gsc], id="sync_gsc")
    scheduler.add_job(_run_job, CronTrigger.from_crontab(settings.sync_ga4_cron), args=[SyncJobType.ga4], id="sync_ga4")
    scheduler.start()
    logger.info("Background sync scheduler started")