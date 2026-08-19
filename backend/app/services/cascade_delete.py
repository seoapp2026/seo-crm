"""Delete projects / niches / pages with all dependent rows.

SQLAlchemy relationships do not cover Option 2 / Phase 2 tables, and production
Postgres FKs are not guaranteed to have ON DELETE CASCADE. Always purge children
explicitly before deleting the parent.
"""

from sqlalchemy.orm import Session

from app.models import (
    AdsKeyword,
    AnalyticsData,
    Competitor,
    ContentDraft,
    GoogleAuth,
    GscData,
    InternalLink,
    Keyword,
    Niche,
    Note,
    Page,
    Product,
    Project,
    ResearchBacklinkSummary,
    ResearchJob,
    ResearchKeyword,
    ResearchLinkGap,
    ResearchOpportunity,
    ResearchPageSnapshot,
    ResearchSerpRow,
    SyncJob,
    Url,
)


def _ids(rows) -> list[int]:
    return [row[0] if not isinstance(row, int) else row for row in rows]


def purge_page(db: Session, page: Page) -> None:
    page_id = page.id
    url_ids = _ids(db.query(Url.id).filter(Url.page_id == page_id).all())
    if url_ids:
        db.query(GscData).filter(GscData.url_id.in_(url_ids)).update(
            {GscData.url_id: None}, synchronize_session=False
        )
    db.query(ContentDraft).filter(ContentDraft.page_id == page_id).delete(synchronize_session=False)
    db.query(Keyword).filter(Keyword.page_id == page_id).delete(synchronize_session=False)
    db.query(Url).filter(Url.page_id == page_id).delete(synchronize_session=False)
    db.query(InternalLink).filter(
        (InternalLink.from_page_id == page_id) | (InternalLink.to_page_id == page_id)
    ).delete(synchronize_session=False)
    db.delete(page)
    db.flush()


def purge_niche(db: Session, niche: Niche) -> None:
    niche_id = niche.id
    db.query(Competitor).filter(Competitor.niche_id == niche_id).update(
        {Competitor.niche_id: None}, synchronize_session=False
    )
    pages = db.query(Page).filter(Page.niche_id == niche_id).all()
    for page in pages:
        purge_page(db, page)
    db.query(Keyword).filter(Keyword.niche_id == niche_id).delete(synchronize_session=False)
    db.query(Url).filter(Url.niche_id == niche_id).delete(synchronize_session=False)
    db.delete(niche)
    db.flush()


def _purge_research_jobs(db: Session, project_id: int) -> None:
    job_ids = _ids(db.query(ResearchJob.id).filter(ResearchJob.project_id == project_id).all())
    if not job_ids:
        return
    child_models = (
        ResearchKeyword,
        ResearchSerpRow,
        ResearchPageSnapshot,
        ResearchBacklinkSummary,
        ResearchLinkGap,
        ResearchOpportunity,
    )
    for model in child_models:
        db.query(model).filter(model.job_id.in_(job_ids)).delete(synchronize_session=False)
    db.query(ResearchJob).filter(ResearchJob.project_id == project_id).delete(synchronize_session=False)


def purge_project(db: Session, project: Project) -> None:
    project_id = project.id
    _purge_research_jobs(db, project_id)
    db.query(Product).filter(Product.project_id == project_id).delete(synchronize_session=False)
    db.query(AdsKeyword).filter(AdsKeyword.project_id == project_id).delete(synchronize_session=False)
    db.query(GscData).filter(GscData.project_id == project_id).delete(synchronize_session=False)
    db.query(AnalyticsData).filter(AnalyticsData.project_id == project_id).delete(synchronize_session=False)
    db.query(SyncJob).filter(SyncJob.project_id == project_id).delete(synchronize_session=False)
    db.query(GoogleAuth).filter(GoogleAuth.project_id == project_id).delete(synchronize_session=False)
    db.query(Competitor).filter(Competitor.project_id == project_id).delete(synchronize_session=False)
    db.query(Note).filter(Note.project_id == project_id).delete(synchronize_session=False)
    db.query(InternalLink).filter(InternalLink.project_id == project_id).delete(synchronize_session=False)
    niches = db.query(Niche).filter(Niche.project_id == project_id).all()
    for niche in niches:
        purge_niche(db, niche)
    db.query(Keyword).filter(Keyword.project_id == project_id).delete(synchronize_session=False)
    db.query(Url).filter(Url.project_id == project_id).delete(synchronize_session=False)
    db.query(Page).filter(Page.project_id == project_id).delete(synchronize_session=False)
    db.delete(project)
    db.flush()
