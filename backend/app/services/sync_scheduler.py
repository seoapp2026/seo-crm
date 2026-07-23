import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import GoogleAuth, GoogleServiceType, Project, SyncJob, SyncJobStatus, SyncJobType
from app.services.ads_sync import sync_ads_for_project
from app.services.ga4_sync import sync_ga4_for_project
from app.services.gsc_sync import sync_gsc_for_project

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()

_AUTH_FOR_JOB = {
    SyncJobType.gsc: GoogleServiceType.gsc,
    SyncJobType.ga4: GoogleServiceType.ga4,
    SyncJobType.ads: GoogleServiceType.ads,
}


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
            auth_service = _AUTH_FOR_JOB.get(job_type)
            if not auth_service:
                continue
            auth = (
                db.query(GoogleAuth)
                .filter(GoogleAuth.project_id == project.id, GoogleAuth.service == auth_service)
                .first()
            )
            if not auth or not auth.refresh_token:
                logger.info(
                    "Skip scheduled %s for project %s — OAuth not connected",
                    job_type.value,
                    project.id,
                )
                continue
            try:
                if job_type == SyncJobType.gsc:
                    sync_gsc_for_project(db, project.id)
                elif job_type == SyncJobType.ga4:
                    sync_ga4_for_project(db, project.id)
                elif job_type == SyncJobType.ads:
                    sync_ads_for_project(db, project.id)
            except Exception as exc:
                logger.exception("Sync %s failed for project %s: %s", job_type, project.id, exc)
                job.status = SyncJobStatus.error
                job.last_error = str(exc)[:500]
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

    logger.info(
        "Manual sync start job_id=%s type=%s project_id=%s",
        job_id,
        job.job_type.value,
        job.project_id,
    )

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
            sync_ads_for_project(db, job.project_id)
        else:
            raise ValueError(f"Tipo de sync no soportado: {job.job_type}")
    except ValueError as exc:
        message = str(exc) or "Error de sincronización"
        logger.error("Manual sync ValueError job %s: %s", job_id, message)
        db.refresh(job)
        if job.status == SyncJobStatus.running:
            _mark_job_failed(db, job, message)
        else:
            # ads_sync may already have set error; ensure message is stored
            if job.status != SyncJobStatus.success:
                _mark_job_failed(db, job, message)
        raise
    except Exception as exc:
        message = _sync_error_message(exc)
        if "403" in message or "sufficient permission" in message.lower():
            logger.warning("Manual sync failed for job %s: %s", job_id, message.split("\n")[0])
        else:
            logger.exception("Manual sync failed for job %s", job_id)
        db.refresh(job)
        if job.status == SyncJobStatus.running:
            _mark_job_failed(db, job, message)
        raise ValueError(message) from exc

    logger.info("Manual sync OK job_id=%s type=%s", job_id, job.job_type.value)
    db.refresh(job)
    return job


def start_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(_run_job, CronTrigger.from_crontab(settings.sync_gsc_cron), args=[SyncJobType.gsc], id="sync_gsc")
    scheduler.add_job(_run_job, CronTrigger.from_crontab(settings.sync_ga4_cron), args=[SyncJobType.ga4], id="sync_ga4")
    scheduler.add_job(_run_job, CronTrigger.from_crontab(settings.sync_ads_cron), args=[SyncJobType.ads], id="sync_ads")
    scheduler.start()
    logger.info(
        "Background sync scheduler started (gsc=%s ga4=%s ads=%s)",
        settings.sync_gsc_cron,
        settings.sync_ga4_cron,
        settings.sync_ads_cron,
    )
