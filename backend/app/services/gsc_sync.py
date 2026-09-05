from datetime import date, datetime, timedelta, timezone

from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from app.models import GoogleAuth, GoogleServiceType, GscData, SyncJob, SyncJobStatus, SyncJobType, Url
from app.services.crypto_service import read_secret
from app.services.google_oauth import credentials_from_auth, save_credentials
from app.services.gsc_sites import validate_gsc_site_access
from app.services.project_targets import resolve_gsc_site


def sync_gsc_for_project(db: Session, project_id: int) -> int:
    auth = (
        db.query(GoogleAuth)
        .filter(GoogleAuth.project_id == project_id, GoogleAuth.service == GoogleServiceType.gsc)
        .first()
    )
    site = resolve_gsc_site(db, project_id, auth)
    if not auth or not read_secret(auth.refresh_token) or not site:
        raise ValueError("GSC no conectado — configura la URL de Search Console en el proyecto")

    job = (
        db.query(SyncJob)
        .filter(SyncJob.project_id == project_id, SyncJob.job_type == SyncJobType.gsc)
        .first()
    )
    if job:
        job.status = SyncJobStatus.running
        job.last_error = None
        db.commit()

    creds = credentials_from_auth(auth, GoogleServiceType.gsc)
    save_credentials(db, auth, creds, GoogleServiceType.gsc)
    validate_gsc_site_access(db, project_id, site)

    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=27)

    service = build("searchconsole", "v1", credentials=creds)
    response = (
        service.searchanalytics()
        .query(
            siteUrl=site,
            body={
                "startDate": start.isoformat(),
                "endDate": end.isoformat(),
                "dimensions": ["date", "page"],
                "rowLimit": 25000,
            },
        )
        .execute()
    )

    url_map = {u.slug: u.id for u in db.query(Url).filter(Url.project_id == project_id).all()}
    count = 0

    for row in response.get("rows", []):
        keys = row.get("keys", [])
        if len(keys) < 2:
            continue
        day, page_url = keys[0], keys[1]
        impressions = int(row.get("impressions", 0))
        clicks = int(row.get("clicks", 0))
        ctr = round(float(row.get("ctr", 0)) * 100, 2)
        position = round(float(row.get("position", 0)), 1)

        existing = (
            db.query(GscData)
            .filter(GscData.project_id == project_id, GscData.page_url == page_url, GscData.date == day)
            .first()
        )
        if existing:
            existing.impressions = impressions
            existing.clicks = clicks
            existing.ctr = ctr
            existing.position = position
            existing.url_id = url_map.get(page_url)
        else:
            db.add(
                GscData(
                    project_id=project_id,
                    page_url=page_url,
                    date=day,
                    impressions=impressions,
                    clicks=clicks,
                    ctr=ctr,
                    position=position,
                    url_id=url_map.get(page_url),
                )
            )
        count += 1

    now = datetime.now(timezone.utc)
    auth.last_sync_at = now
    if job:
        job.status = SyncJobStatus.success
        job.records_synced += count
        job.last_run_at = now
        job.last_error = None
    db.commit()
    return count