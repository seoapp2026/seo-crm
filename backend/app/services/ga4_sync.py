from datetime import date, datetime, timedelta, timezone

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import DateRange, Dimension, Metric, RunReportRequest
from google.oauth2.credentials import Credentials
from sqlalchemy.orm import Session

from app.models import AnalyticsData, GoogleAuth, GoogleServiceType, SyncJob, SyncJobStatus, SyncJobType
from app.services.crypto_service import read_secret
from app.services.google_oauth import SCOPES, credentials_from_auth, save_credentials
from app.services.project_targets import resolve_ga4_property


def sync_ga4_for_project(db: Session, project_id: int) -> int:
    auth = (
        db.query(GoogleAuth)
        .filter(GoogleAuth.project_id == project_id, GoogleAuth.service == GoogleServiceType.ga4)
        .first()
    )
    property_id = resolve_ga4_property(db, project_id, auth)
    if not auth or not read_secret(auth.refresh_token) or not property_id:
        raise ValueError("GA4 no conectado — configura el Property ID en el proyecto")

    job = (
        db.query(SyncJob)
        .filter(SyncJob.project_id == project_id, SyncJob.job_type == SyncJobType.ga4)
        .first()
    )
    if job:
        job.status = SyncJobStatus.running
        job.last_error = None
        db.commit()

    creds = credentials_from_auth(auth, GoogleServiceType.ga4)
    save_credentials(db, auth, creds, GoogleServiceType.ga4)

    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=27)

    ga_creds = Credentials(
        token=creds.token,
        refresh_token=creds.refresh_token,
        token_uri=creds.token_uri,
        client_id=creds.client_id,
        client_secret=creds.client_secret,
        scopes=SCOPES[GoogleServiceType.ga4],
    )
    client = BetaAnalyticsDataClient(credentials=ga_creds)

    request = RunReportRequest(
        property=property_id,
        date_ranges=[DateRange(start_date=start.isoformat(), end_date=end.isoformat())],
        dimensions=[Dimension(name="date"), Dimension(name="pagePath")],
        metrics=[
            Metric(name="sessions"),
            Metric(name="activeUsers"),
            Metric(name="bounceRate"),
            Metric(name="averageSessionDuration"),
        ],
        limit=25000,
    )
    response = client.run_report(request)
    count = 0

    for row in response.rows:
        day = row.dimension_values[0].value
        if len(day) == 8:
            day = f"{day[:4]}-{day[4:6]}-{day[6:8]}"
        page_path = row.dimension_values[1].value
        sessions = int(float(row.metric_values[0].value or 0))
        users = int(float(row.metric_values[1].value or 0))
        bounce = round(float(row.metric_values[2].value or 0) * 100, 1)
        engagement = round(float(row.metric_values[3].value or 0))

        existing = (
            db.query(AnalyticsData)
            .filter(
                AnalyticsData.project_id == project_id,
                AnalyticsData.page_path == page_path,
                AnalyticsData.date == day,
            )
            .first()
        )
        if existing:
            existing.sessions = sessions
            existing.users = users
            existing.bounce_rate = bounce
            existing.avg_engagement_time = engagement
        else:
            db.add(
                AnalyticsData(
                    project_id=project_id,
                    page_path=page_path,
                    date=day,
                    sessions=sessions,
                    users=users,
                    bounce_rate=bounce,
                    avg_engagement_time=engagement,
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