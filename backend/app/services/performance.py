from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AnalyticsData, GscData, Page, Url
from app.schemas_phase2 import PagePerformanceOut, PerformanceSummaryOut


def _days_ago(n: int) -> str:
    return (date.today() - timedelta(days=n)).isoformat()


def build_performance_summary(db: Session, project_id: int | None) -> PerformanceSummaryOut:
    since = _days_ago(28)
    prev_since = _days_ago(56)
    prev_until = _days_ago(29)

    pages_q = db.query(Page)
    if project_id is not None:
        pages_q = pages_q.filter(Page.project_id == project_id)
    pages = pages_q.all()

    slug_by_page: dict[int, str] = {}
    for page in pages:
        url = db.query(Url).filter(Url.page_id == page.id).first()
        slug_by_page[page.id] = url.slug if url else f"/page-{page.id}"

    results: list[PagePerformanceOut] = []

    for page in pages:
        slug = slug_by_page[page.id]
        gsc_filter = [GscData.page_url.contains(slug.lstrip("/"))]
        if project_id is not None:
            gsc_filter.append(GscData.project_id == project_id)

        recent = db.query(
            func.coalesce(func.sum(GscData.clicks), 0),
            func.coalesce(func.sum(GscData.impressions), 0),
            func.coalesce(func.avg(GscData.ctr), 0),
            func.coalesce(func.avg(GscData.position), 0),
        ).filter(GscData.date >= since, *gsc_filter)

        prev = db.query(func.coalesce(func.sum(GscData.clicks), 0)).filter(
            GscData.date >= prev_since,
            GscData.date <= prev_until,
            *gsc_filter,
        )

        row = recent.one()
        clicks_28d = int(row[0])
        impressions_28d = int(row[1])
        ctr_28d = round(float(row[2] or 0), 1)
        position_28d = round(float(row[3] or 0), 1)
        prev_clicks = int(prev.scalar() or 0)

        ana_filter = [AnalyticsData.page_path.contains(slug)]
        if project_id is not None:
            ana_filter.append(AnalyticsData.project_id == project_id)

        ana = db.query(
            func.coalesce(func.sum(AnalyticsData.sessions), 0),
            func.coalesce(func.avg(AnalyticsData.bounce_rate), 0),
        ).filter(AnalyticsData.date >= since, *ana_filter).one()
        sessions_28d = int(ana[0])
        bounce_rate_28d = round(float(ana[1] or 0))

        if prev_clicks > 0:
            trend_pct = round(((clicks_28d - prev_clicks) / prev_clicks) * 100)
        elif clicks_28d > 0:
            trend_pct = 100
        else:
            trend_pct = 0

        if trend_pct > 5:
            trend, status = "up", "winning"
        elif trend_pct < -10:
            trend, status = "down", "declining"
        elif clicks_28d < 20 and impressions_28d > 100:
            trend, status = "stable", "needs_work"
        else:
            trend, status = "stable", "stable"

        spark = list(
            db.scalars(
                select(GscData.clicks)
                .where(GscData.date >= _days_ago(14), *gsc_filter)
                .order_by(GscData.date)
                .limit(14)
            )
        )

        results.append(
            PagePerformanceOut(
                page_id=page.id,
                page_title=page.title,
                page_url=slug,
                impressions_28d=impressions_28d,
                clicks_28d=clicks_28d,
                ctr_28d=ctr_28d,
                position_28d=position_28d,
                sessions_28d=sessions_28d,
                bounce_rate_28d=bounce_rate_28d,
                trend=trend,
                trend_pct=trend_pct,
                status=status,
                sparkline_clicks=spark or [0],
            )
        )

    return PerformanceSummaryOut(
        winning=sum(1 for p in results if p.status == "winning"),
        declining=sum(1 for p in results if p.status == "declining"),
        needs_work=sum(1 for p in results if p.status == "needs_work"),
        stable=sum(1 for p in results if p.status == "stable"),
        total_clicks_28d=sum(p.clicks_28d for p in results),
        total_impressions_28d=sum(p.impressions_28d for p in results),
        total_sessions_28d=sum(p.sessions_28d for p in results),
        avg_position_28d=round(
            sum(p.position_28d for p in results) / len(results), 1
        )
        if results
        else 0,
        pages=sorted(results, key=lambda p: p.clicks_28d, reverse=True),
    )