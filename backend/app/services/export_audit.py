"""W5 pre-export audit (PHASE25 plan, section W5).

Per-page checks before exporting to WordPress. Warnings never hard-block
export; `Page.export_ready` stays untouched.
"""

from sqlalchemy.orm import Session

from app.models import ContentDraft, InternalLink, Keyword, Page, Url


def _latest_draft(db: Session, page_id: int) -> ContentDraft | None:
    return (
        db.query(ContentDraft)
        .filter(ContentDraft.page_id == page_id)
        .order_by(ContentDraft.created_at.desc())
        .first()
    )


def _audit_page(db: Session, page: Page) -> dict:
    errors: list[str] = []
    warnings: list[str] = []

    url = db.query(Url).filter(Url.page_id == page.id).first()
    slug = url.slug if url else f"/{page.title.lower().strip().replace(' ', '-')}"

    kws = db.query(Keyword).filter(Keyword.page_id == page.id).all()
    primary_kw = next((k for k in kws if k.is_primary), None)

    # seo fields with fallback to the latest content draft meta
    seo_title = page.seo_title
    seo_description = page.seo_description
    if not seo_title or not seo_description:
        draft = _latest_draft(db, page.id)
        if draft:
            seo_title = seo_title or draft.meta_title
            seo_description = seo_description or draft.meta_description

    # final laid-out HTML with the same draft fallback the exporter uses
    content_html = page.content_html
    if not content_html:
        draft = _latest_draft(db, page.id)
        if draft:
            content_html = draft.content_html or draft.draft_body

    if not primary_kw:
        errors.append("Falta palabra clave principal")
    if not url or not url.slug:
        errors.append("Falta slug/URL")
    if not seo_title:
        errors.append("Falta seo_title")
    if not seo_description:
        errors.append("Falta seo_description")
    if not page.h1:
        errors.append("Falta H1")
    if not content_html:
        errors.append("Falta content_html (contenido final maquetado)")
    if not page.type:
        errors.append("Falta tipo de página")

    internal_links_count = (
        db.query(InternalLink).filter(InternalLink.from_page_id == page.id).count()
    )
    if internal_links_count < 1:
        warnings.append("Sin enlaces internos salientes (>= 1 recomendado)")

    return {
        "page_id": page.id,
        "title": page.title,
        "slug": slug,
        "ready": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


def audit_project_export(db: Session, project_id: int) -> dict:
    pages = db.query(Page).filter(Page.project_id == project_id).order_by(Page.created_at).all()
    page_reports = [_audit_page(db, page) for page in pages]

    total_errors = sum(len(p["errors"]) for p in page_reports)
    total_warnings = sum(len(p["warnings"]) for p in page_reports)
    error_pages = sum(1 for p in page_reports if p["errors"])

    return {
        "project_id": project_id,
        "total_pages": len(page_reports),
        "ready_pages": len(page_reports) - error_pages,
        "error_pages": error_pages,
        "total_errors": total_errors,
        "total_warnings": total_warnings,
        "pages": page_reports,
    }
