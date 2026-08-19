from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import InternalLink, Keyword, Page


def cannibalized_terms(db: Session, project_id: int | None = None) -> set[str]:
    q = select(Keyword.term, func.count(Keyword.id)).group_by(Keyword.term).having(func.count(Keyword.id) > 1)
    if project_id is not None:
        q = q.where(Keyword.project_id == project_id)
    rows = db.execute(q).all()
    return {row[0].lower() for row in rows}


def keyword_cannibalized(db: Session, term: str, project_id: int) -> bool:
    count = db.scalar(
        select(func.count(Keyword.id)).where(
            Keyword.project_id == project_id,
            func.lower(Keyword.term) == term.lower(),
        )
    )
    return (count or 0) > 1


def cannibalized_page_titles(
    db: Session, term: str, project_id: int, exclude_keyword_id: int | None = None
) -> list[str]:
    q = (
        select(Page.title)
        .join(Keyword, Keyword.page_id == Page.id)
        .where(
            Keyword.project_id == project_id,
            func.lower(Keyword.term) == term.lower(),
        )
        .distinct()
    )
    if exclude_keyword_id is not None:
        q = q.where(Keyword.id != exclude_keyword_id)
    return [row[0] for row in db.execute(q).all() if row[0]]


def orphan_pages(db: Session, project_id: int | None = None) -> list[Page]:
    linked_ids = select(InternalLink.to_page_id).distinct()
    q = select(Page).where(Page.id.not_in(linked_ids))
    if project_id is not None:
        q = q.where(Page.project_id == project_id)
    return list(db.scalars(q).all())