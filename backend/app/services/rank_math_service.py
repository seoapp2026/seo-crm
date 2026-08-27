import csv
import io
from sqlalchemy.orm import Session

from app.models import Keyword, Page, Url
from app.schemas_phase2 import (
    RankMathBulkSyncResponse,
    RankMathImportResponse,
)


def export_rank_math_csv(db: Session, project_id: int) -> str:
    pages = db.query(Page).filter(Page.project_id == project_id).order_by(Page.id.asc()).all()
    output = io.StringIO()
    output.write("\ufeff")

    fieldnames = [
        "id",
        "slug",
        "title",
        "h1",
        "rank_math_title",
        "rank_math_description",
        "rank_math_focus_keyword",
        "rank_math_canonical_url",
        "rank_math_robots_meta",
        "rank_math_schema_type",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for p in pages:
        primary_kw = (
            db.query(Keyword)
            .filter(Keyword.page_id == p.id, Keyword.is_primary.is_(True))
            .first()
        )
        if not primary_kw:
            primary_kw = db.query(Keyword).filter(Keyword.page_id == p.id).first()

        slug = p.urls[0].slug if p.urls else f"/{p.id}"
        focus_term = primary_kw.term if primary_kw else ""

        writer.writerow({
            "id": p.id,
            "slug": slug,
            "title": p.title,
            "h1": p.h1 or p.title,
            "rank_math_title": p.seo_title or p.title,
            "rank_math_description": p.seo_description or "",
            "rank_math_focus_keyword": focus_term,
            "rank_math_canonical_url": f"https://example.com{slug}",
            "rank_math_robots_meta": "index, follow",
            "rank_math_schema_type": "Article",
        })

    return output.getvalue()


def import_rank_math_csv(db: Session, project_id: int, csv_content: str) -> RankMathImportResponse:
    cleaned = csv_content.lstrip("\ufeff").strip()
    if not cleaned:
        return RankMathImportResponse(total_rows=0, updated_count=0, skipped_count=0, error_count=0, messages=["CSV vacio"])

    reader = csv.DictReader(io.StringIO(cleaned))
    total_rows = 0
    updated_count = 0
    skipped_count = 0
    error_count = 0
    messages: list[str] = []

    for row in reader:
        total_rows += 1
        page_id_str = row.get("id") or row.get("page_id")
        slug = (row.get("slug") or "").strip()
        title = (row.get("title") or "").strip()

        page = None
        if page_id_str and page_id_str.isdigit():
            page = db.get(Page, int(page_id_str))
            if page and page.project_id != project_id:
                page = None

        if not page and slug:
            url_obj = db.query(Url).filter(Url.project_id == project_id, Url.slug == slug).first()
            if url_obj and url_obj.page_id:
                page = db.get(Page, url_obj.page_id)

        if not page and title:
            page = db.query(Page).filter(Page.project_id == project_id, Page.title == title).first()

        if not page:
            skipped_count += 1
            messages.append(f"Fila #{total_rows}: No se encontro pagina para {slug or title or page_id_str}")
            continue

        seo_title = row.get("rank_math_title") or row.get("seo_title")
        seo_desc = row.get("rank_math_description") or row.get("seo_description")
        h1 = row.get("h1") or row.get("H1")
        focus_keyword = (row.get("rank_math_focus_keyword") or row.get("focus_keyword") or "").strip()

        if seo_title:
            page.seo_title = seo_title
        if seo_desc:
            page.seo_description = seo_desc
        if h1:
            page.h1 = h1

        if focus_keyword:
            db.query(Keyword).filter(Keyword.page_id == page.id, Keyword.is_primary.is_(True)).update({"is_primary": False})
            existing_kw = db.query(Keyword).filter(Keyword.page_id == page.id, Keyword.term == focus_keyword).first()
            if existing_kw:
                existing_kw.is_primary = True
            else:
                db.add(
                    Keyword(
                        project_id=project_id,
                        niche_id=page.niche_id,
                        page_id=page.id,
                        term=focus_keyword,
                        is_primary=True,
                    )
                )

        updated_count += 1

    db.commit()
    return RankMathImportResponse(
        total_rows=total_rows,
        updated_count=updated_count,
        skipped_count=skipped_count,
        error_count=error_count,
        messages=messages[:10],
    )


def bulk_sync_rank_math_metas(
    db: Session,
    project_id: int,
    page_ids: list[int] | None = None,
    overwrite_existing: bool = False,
    title_suffix: str | None = " | Guia 2026",
) -> RankMathBulkSyncResponse:
    q = db.query(Page).filter(Page.project_id == project_id)
    if page_ids:
        q = q.filter(Page.id.in_(page_ids))

    pages = q.all()
    analyzed_count = len(pages)
    updated_titles = 0
    updated_descs = 0

    suffix = title_suffix or ""

    for p in pages:
        primary_kw = (
            db.query(Keyword)
            .filter(Keyword.page_id == p.id, Keyword.is_primary.is_(True))
            .first()
        )
        focus_term = primary_kw.term if primary_kw else p.title

        if not p.seo_title or overwrite_existing:
            base_t = (p.h1 or p.title).strip()
            max_base_len = max(20, 60 - len(suffix))
            trimmed_base = base_t[:max_base_len].strip()
            proposed_title = f"{trimmed_base}{suffix}"
            p.seo_title = proposed_title[:60].strip()
            updated_titles += 1

        if not p.seo_description or overwrite_existing:
            prop_desc = (
                f"Descubre todo sobre {focus_term}. "
                f"Analisis detallado, comparativa de caracteristicas, pros, contras y guia de compra completa."
            )
            p.seo_description = prop_desc[:155].strip()
            updated_descs += 1

    db.commit()
    return RankMathBulkSyncResponse(
        analyzed_count=analyzed_count,
        updated_titles_count=updated_titles,
        updated_descriptions_count=updated_descs,
    )