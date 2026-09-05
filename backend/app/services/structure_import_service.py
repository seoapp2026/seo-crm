import csv
import io
import json
import logging
import re
from typing import Any

from sqlalchemy.orm import Session

from app.models import Keyword, Niche, Page, PageType, Project, Url
from app.schemas_phase2 import (
    StructureImportItem,
    StructureImportRequest,
    StructureImportResponse,
)

log = logging.getLogger("seo_crm.structure_import")


def parse_structure_csv(csv_content: str) -> list[StructureImportItem]:
    if not csv_content or not csv_content.strip():
        return []

    # Strip UTF-8 BOM if present
    text = csv_content.lstrip("\ufeff").strip()
    
    # Detect delimiter
    sample = text[:1024]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    items: list[StructureImportItem] = []

    for row in reader:
        if not row:
            continue
        # Normalize header keys
        norm = {k.strip().lower().replace(" ", "_"): (v.strip() if v else "") for k, v in row.items() if k}
        
        title = norm.get("title") or norm.get("titulo") or norm.get("pagina") or norm.get("page")
        slug = norm.get("slug") or norm.get("url") or norm.get("path")
        niche_name = norm.get("niche_name") or norm.get("niche") or norm.get("nicho") or "General"
        parent_slug = norm.get("parent_slug") or norm.get("parent") or norm.get("padre") or None
        
        # Page type parsing
        pt_raw = (norm.get("page_type") or norm.get("type") or norm.get("tipo") or "TSG").upper()
        if pt_raw in ("TSR", "TSA", "TSG"):
            page_type = PageType(pt_raw)
        else:
            page_type = PageType.TSG

        h1 = norm.get("h1") or None
        seo_title = norm.get("seo_title") or norm.get("meta_title") or None
        seo_desc = norm.get("seo_description") or norm.get("meta_description") or norm.get("description") or None
        focus_kw = norm.get("focus_keyword") or norm.get("keyword") or norm.get("palabra_clave") or None

        if title and slug:
            # Ensure slug starts with /
            if not slug.startswith("/"):
                slug = "/" + slug
            if parent_slug and not parent_slug.startswith("/"):
                parent_slug = "/" + parent_slug

            items.append(
                StructureImportItem(
                    title=title,
                    slug=slug,
                    niche_name=niche_name,
                    parent_slug=parent_slug if parent_slug else None,
                    page_type=page_type,
                    h1=h1,
                    seo_title=seo_title,
                    seo_description=seo_desc,
                    focus_keyword=focus_kw,
                )
            )

    return items


def parse_structure_json(json_content: str) -> list[StructureImportItem]:
    if not json_content or not json_content.strip():
        return []

    text = json_content.lstrip("\ufeff").strip()
    data = json.loads(text)
    if isinstance(data, dict):
        # Accept a single object or an object wrapping a list
        data = data.get("items") or data.get("pages") or [data]
    if not isinstance(data, list):
        raise ValueError("El contenido JSON debe ser una lista de objetos.")

    items: list[StructureImportItem] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        norm = {str(k).strip().lower().replace(" ", "_"): (str(v).strip() if v is not None else "") for k, v in row.items()}

        title = norm.get("title") or norm.get("titulo") or norm.get("pagina") or norm.get("page")
        slug = norm.get("slug") or norm.get("url") or norm.get("path")
        niche_name = norm.get("niche_name") or norm.get("niche") or norm.get("nicho") or "General"
        parent_slug = norm.get("parent_slug") or norm.get("parent") or norm.get("padre") or None

        pt_raw = (norm.get("page_type") or norm.get("type") or norm.get("tipo") or "TSG").upper()
        if pt_raw in ("TSR", "TSA", "TSG"):
            page_type = PageType(pt_raw)
        else:
            page_type = PageType.TSG

        h1 = norm.get("h1") or None
        seo_title = norm.get("seo_title") or norm.get("meta_title") or None
        seo_desc = norm.get("seo_description") or norm.get("meta_description") or norm.get("description") or None
        focus_kw = norm.get("focus_keyword") or norm.get("keyword") or norm.get("palabra_clave") or None

        if title and slug:
            if not slug.startswith("/"):
                slug = "/" + slug
            if parent_slug and not parent_slug.startswith("/"):
                parent_slug = "/" + parent_slug

            items.append(
                StructureImportItem(
                    title=title,
                    slug=slug,
                    niche_name=niche_name,
                    parent_slug=parent_slug if parent_slug else None,
                    page_type=page_type,
                    h1=h1,
                    seo_title=seo_title,
                    seo_description=seo_desc,
                    focus_keyword=focus_kw,
                )
            )

    return items


def import_site_structure(db: Session, request: StructureImportRequest) -> StructureImportResponse:
    # 1. Resolve or create Project
    project = None
    if request.project_id:
        project = db.get(Project, request.project_id)
        if not project:
            raise ValueError(f"Proyecto con ID {request.project_id} no encontrado")
    elif request.project_name and request.project_name.strip():
        name = request.project_name.strip()
        project = db.query(Project).filter(Project.name.ilike(name)).first()
        if not project:
            project = Project(name=name)
            db.add(project)
            db.commit()
            db.refresh(project)
    else:
        # Fallback to the first existing project
        project = db.query(Project).first()
        if not project:
            project = Project(name="Nuevo Proyecto SEO")
            db.add(project)
            db.commit()
            db.refresh(project)

    # 2. Extract items from CSV, JSON or raw list
    items: list[StructureImportItem] = []
    if request.csv_content:
        items = parse_structure_csv(request.csv_content)
    elif request.json_content:
        items = parse_structure_json(request.json_content)
    elif request.items:
        items = request.items

    if not items:
        return StructureImportResponse(
            project_id=project.id,
            project_name=project.name,
            niches_created=0,
            pages_created=0,
            urls_created=0,
            silos_linked=0,
            keywords_linked=0,
            errors=["No se encontraron filas válidas para importar."],
        )

    # Cache existing niches and pages for the project
    niches_map: dict[str, Niche] = {
        n.name.strip().lower(): n
        for n in db.query(Niche).filter(Niche.project_id == project.id).all()
    }
    pages_by_slug: dict[str, Page] = {
        u.slug: u.page
        for u in db.query(Url).filter(Url.project_id == project.id).all()
        if u.page
    }

    niches_created_count = 0
    pages_created_count = 0
    urls_created_count = 0
    silos_linked_count = 0
    keywords_linked_count = 0
    errors: list[str] = []

    # First Pass: Create Niches, Pages, and URLs
    for item in items:
        try:
            n_key = item.niche_name.strip().lower()
            if n_key not in niches_map:
                new_niche = Niche(project_id=project.id, name=item.niche_name.strip())
                db.add(new_niche)
                db.commit()
                db.refresh(new_niche)
                niches_map[n_key] = new_niche
                niches_created_count += 1
            niche = niches_map[n_key]

            clean_slug = item.slug if item.slug.startswith("/") else f"/{item.slug}"

            if clean_slug in pages_by_slug:
                # Update existing page fields
                page = pages_by_slug[clean_slug]
                page.title = item.title
                page.h1 = item.h1 or page.h1 or item.title
                page.seo_title = item.seo_title or page.seo_title
                page.seo_description = item.seo_description or page.seo_description
                page.type = item.page_type
                page.niche_id = niche.id
                db.commit()
            else:
                # Create new page
                page = Page(
                    project_id=project.id,
                    niche_id=niche.id,
                    title=item.title,
                    h1=item.h1 or item.title,
                    seo_title=item.seo_title,
                    seo_description=item.seo_description,
                    type=item.page_type,
                    wp_category=niche.name,
                )
                db.add(page)
                db.commit()
                db.refresh(page)
                pages_created_count += 1

                # Create matching URL
                url = Url(project_id=project.id, niche_id=niche.id, page_id=page.id, slug=clean_slug)
                db.add(url)
                db.commit()
                db.refresh(url)
                urls_created_count += 1

                pages_by_slug[clean_slug] = page

            # Link focus keyword if provided
            if item.focus_keyword and item.focus_keyword.strip():
                kw_term = item.focus_keyword.strip()
                # Check if keyword already exists for this page
                existing_kw = (
                    db.query(Keyword)
                    .filter(Keyword.project_id == project.id, Keyword.page_id == page.id, Keyword.term.ilike(kw_term))
                    .first()
                )
                if not existing_kw:
                    new_kw = Keyword(
                        project_id=project.id,
                        niche_id=niche.id,
                        page_id=page.id,
                        term=kw_term,
                        is_primary=True,
                    )
                    db.add(new_kw)
                    db.commit()
                    keywords_linked_count += 1

        except Exception as e:
            errors.append(f"Error en fila '{item.title}' ({item.slug}): {str(e)}")

    # Second Pass: Wire Parent/Child Silo Hierarchy
    for item in items:
        if item.parent_slug:
            parent_clean_slug = item.parent_slug if item.parent_slug.startswith("/") else f"/{item.parent_slug}"
            clean_slug = item.slug if item.slug.startswith("/") else f"/{item.slug}"

            child_page = pages_by_slug.get(clean_slug)
            parent_page = pages_by_slug.get(parent_clean_slug)

            if child_page and parent_page and child_page.id != parent_page.id:
                if child_page.parent_page_id != parent_page.id:
                    child_page.parent_page_id = parent_page.id
                    db.commit()
                    silos_linked_count += 1

    return StructureImportResponse(
        project_id=project.id,
        project_name=project.name,
        niches_created=niches_created_count,
        pages_created=pages_created_count,
        urls_created=urls_created_count,
        silos_linked=silos_linked_count,
        keywords_linked=keywords_linked_count,
        errors=errors,
    )
