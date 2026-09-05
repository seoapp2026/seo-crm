import csv
import io
import json
import re
import zipfile
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ContentDraft, InternalLink, Keyword, Niche, Page, Product, Project, Url
from app.services.crypto_service import read_secret
from app.schemas_phase2 import (
    WpExportBundleOut,
    WpExportItemOut,
    WpInternalLinkOut,
    WpProductOut,
    WpPushRequest,
    WpPushResponse,
    WpPushResultItem,
    WpRankMathOut,
    WpTestConnectionRequest,
    WpTestConnectionResponse,
)

router = APIRouter(prefix="/wordpress", tags=["wordpress"])


def _safe_download_name(name: str, fallback: str = "export") -> str:
    """ASCII-only filename for Content-Disposition (Starlette encodes headers as latin-1)."""
    ascii_name = (name or "").encode("ascii", "ignore").decode("ascii")
    ascii_name = re.sub(r"[^A-Za-z0-9._-]+", "_", ascii_name).strip("._-")
    return ascii_name or fallback


def _build_export_items(project_id: int, db: Session) -> tuple[Project, list[WpExportItemOut]]:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    pages = db.query(Page).filter(Page.project_id == project_id).order_by(Page.created_at).all()
    items: list[WpExportItemOut] = []

    # W6: project products are exported on every page (no page-product link table)
    products = db.query(Product).filter(Product.project_id == project_id).all()
    export_products = [
        WpProductOut(
            name=p.name,
            affiliate_url=p.affiliate_url,
            image_url=p.image_url,
        )
        for p in products
    ]

    def _slug_for(page_id: int, title: str) -> str:
        url = db.query(Url).filter(Url.page_id == page_id).first()
        slug = url.slug if url else f"/{title.lower().strip().replace(' ', '-')}"
        if not slug.startswith("/"):
            slug = f"/{slug}"
        return slug

    for page in pages:
        url = db.query(Url).filter(Url.page_id == page.id).first()
        niche = db.get(Niche, page.niche_id)
        slug = url.slug if url else f"/{page.title.lower().strip().replace(' ', '-')}"
        if not slug.startswith("/"):
            slug = f"/{slug}"

        # Keywords
        kws = db.query(Keyword).filter(Keyword.page_id == page.id).all()
        primary_kw_obj = next((k for k in kws if k.is_primary), (kws[0] if kws else None))
        primary_kw = primary_kw_obj.term if primary_kw_obj else None
        secondary_kws = [k.term for k in kws if not k.is_primary]

        # Parent info
        parent_slug = None
        parent_title = None
        if page.parent_page_id:
            parent = db.get(Page, page.parent_page_id)
            if parent:
                parent_title = parent.title
                parent_url = db.query(Url).filter(Url.page_id == parent.id).first()
                parent_slug = parent_url.slug if parent_url else f"/{parent.title.lower().strip().replace(' ', '-')}"

        # W6: breadcrumbs from the parent chain (root first), current page last
        breadcrumbs: list[str] = []
        chain_page = page
        seen_ids: set[int] = set()
        while chain_page and chain_page.id not in seen_ids:
            seen_ids.add(chain_page.id)
            breadcrumbs.insert(0, chain_page.breadcrumb_label or chain_page.title)
            chain_page = db.get(Page, chain_page.parent_page_id) if chain_page.parent_page_id else None

        # Tags
        tags_list: list[str] = []
        if page.wp_tags_json:
            try:
                parsed = json.loads(page.wp_tags_json)
                if isinstance(parsed, list):
                    tags_list = [str(t) for t in parsed]
                elif isinstance(parsed, str):
                    tags_list = [t.strip() for t in parsed.split(",") if t.strip()]
            except Exception:
                tags_list = [t.strip() for t in page.wp_tags_json.split(",") if t.strip()]

        # W6: outline from outline_json
        outline: list[dict] = []
        if page.outline_json:
            try:
                parsed_outline = json.loads(page.outline_json)
                if isinstance(parsed_outline, list):
                    outline = [o for o in parsed_outline if isinstance(o, dict)]
            except Exception:
                outline = []

        # W6: internal links from the InternalLink model
        internal_links: list[WpInternalLinkOut] = []
        links = db.query(InternalLink).filter(InternalLink.from_page_id == page.id).all()
        for link in links:
            to_page = db.get(Page, link.to_page_id)
            internal_links.append(
                WpInternalLinkOut(
                    to_slug=_slug_for(link.to_page_id, to_page.title) if to_page else None,
                    anchor=link.anchor,
                )
            )

        # HTML content
        content_html = page.content_html
        if not content_html:
            latest_draft = (
                db.query(ContentDraft)
                .filter(ContentDraft.page_id == page.id)
                .order_by(ContentDraft.created_at.desc())
                .first()
            )
            if latest_draft:
                content_html = latest_draft.content_html or latest_draft.draft_body

        meta_title = page.seo_title or page.title
        meta_description = page.seo_description or page.objective or ""

        items.append(
            WpExportItemOut(
                page_id=page.id,
                title=page.title,
                slug=slug,
                h1=page.h1 or page.title,
                meta_title=meta_title,
                meta_description=meta_description,
                focus_keyword=primary_kw,
                secondary_keywords=secondary_kws,
                content_html=content_html,
                content_type=page.type.value if hasattr(page.type, "value") else str(page.type),
                status="publish" if getattr(page.state, "value", str(page.state)) == "publicado" else "draft",
                content_status=page.content_status or "borrador",
                export_ready=bool(page.export_ready),
                niche_name=niche.name if niche else "",
                wp_category=page.wp_category or (niche.name if niche else None),
                wp_tags=tags_list,
                parent_slug=parent_slug,
                parent_title=parent_title,
                schema_json=page.schema_json,
                # W6 completeness keys (PHASE25 plan, section W6)
                seo_title=page.seo_title,
                seo_description=page.seo_description,
                primary_keyword=primary_kw,
                intent=(
                    primary_kw_obj.intent.value
                    if primary_kw_obj and hasattr(primary_kw_obj.intent, "value")
                    else (str(primary_kw_obj.intent) if primary_kw_obj else None)
                ),
                outline=outline,
                internal_links=internal_links,
                breadcrumbs=breadcrumbs,
                products=export_products,
                rank_math=WpRankMathOut(
                    focus_keyword=primary_kw,
                    title=meta_title,
                    description=meta_description,
                ),
            )
        )

    return project, items


@router.get("/export", response_model=WpExportBundleOut)
def export_wordpress_json(project_id: int = Query(...), db: Session = Depends(get_db)):
    project, items = _build_export_items(project_id, db)
    return WpExportBundleOut(
        project_name=project.name,
        exported_at=datetime.now(timezone.utc),
        pages=items,
    )


@router.get("/export/csv")
def export_wordpress_csv(project_id: int = Query(...), db: Session = Depends(get_db)):
    project, items = _build_export_items(project_id, db)

    output = io.StringIO()
    # Write UTF-8 BOM for Excel and WP All Import compatibility
    output.write("\ufeff")

    fieldnames = [
        "ID",
        "Title",
        "Slug",
        "Content",
        "Status",
        "Post Type",
        "Category",
        "Tags",
        "H1",
        "Rank_Math_Title",
        "Rank_Math_Description",
        "Rank_Math_Focus_Keyword",
        "Rank_Math_Secondary_Keywords",
        "Parent_Slug",
        "Parent_Title",
        "Schema_JSON",
        "CRM_Content_Status",
        "CRM_Export_Ready",
    ]

    writer = csv.DictWriter(output, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()

    for item in items:
        writer.writerow({
            "ID": item.page_id,
            "Title": item.title,
            "Slug": item.slug,
            "Content": item.content_html or "",
            "Status": item.status,
            "Post Type": "page",
            "Category": item.wp_category or item.niche_name,
            "Tags": ", ".join(item.wp_tags),
            "H1": item.h1 or item.title,
            "Rank_Math_Title": item.meta_title or item.title,
            "Rank_Math_Description": item.meta_description or "",
            "Rank_Math_Focus_Keyword": item.focus_keyword or "",
            "Rank_Math_Secondary_Keywords": ", ".join(item.secondary_keywords),
            "Parent_Slug": item.parent_slug or "",
            "Parent_Title": item.parent_title or "",
            "Schema_JSON": item.schema_json or "",
            "CRM_Content_Status": item.content_status,
            "CRM_Export_Ready": "1" if item.export_ready else "0",
        })

    csv_data = output.getvalue().encode("utf-8")
    safe_name = _safe_download_name(project.name.lower().replace(" ", "_"), fallback=f"project_{project_id}")
    filename = f"wp_export_{safe_name}_{project_id}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/zip")
def export_wordpress_zip(project_id: int = Query(...), db: Session = Depends(get_db)):
    project, items = _build_export_items(project_id, db)
    safe_name = _safe_download_name(project.name.lower().replace(" ", "_"), fallback=f"project_{project_id}")

    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # 1. Main WP All Import CSV
        csv_out = io.StringIO()
        csv_out.write("\ufeff")
        fieldnames = [
            "ID", "Title", "Slug", "Content", "Status", "Post Type", "Category", "Tags",
            "H1", "Rank_Math_Title", "Rank_Math_Description", "Rank_Math_Focus_Keyword",
            "Rank_Math_Secondary_Keywords", "Parent_Slug", "Parent_Title", "Schema_JSON",
        ]
        writer = csv.DictWriter(csv_out, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            writer.writerow({
                "ID": item.page_id,
                "Title": item.title,
                "Slug": item.slug,
                "Content": item.content_html or "",
                "Status": item.status,
                "Post Type": "page",
                "Category": item.wp_category or item.niche_name,
                "Tags": ", ".join(item.wp_tags),
                "H1": item.h1 or item.title,
                "Rank_Math_Title": item.meta_title or item.title,
                "Rank_Math_Description": item.meta_description or "",
                "Rank_Math_Focus_Keyword": item.focus_keyword or "",
                "Rank_Math_Secondary_Keywords": ", ".join(item.secondary_keywords),
                "Parent_Slug": item.parent_slug or "",
                "Parent_Title": item.parent_title or "",
                "Schema_JSON": item.schema_json or "",
            })
        zip_file.writestr("import_all_pages.csv", csv_out.getvalue().encode("utf-8"))

        # 2. Rank Math Specific CSV
        rm_csv_out = io.StringIO()
        rm_csv_out.write("\ufeff")
        rm_fieldnames = ["ID", "Title", "URL", "Rank_Math_Focus_Keyword", "Rank_Math_Title", "Rank_Math_Description"]
        rm_writer = csv.DictWriter(rm_csv_out, fieldnames=rm_fieldnames)
        rm_writer.writeheader()
        for item in items:
            rm_writer.writerow({
                "ID": item.page_id,
                "Title": item.title,
                "URL": item.slug,
                "Rank_Math_Focus_Keyword": item.focus_keyword or "",
                "Rank_Math_Title": item.meta_title or item.title,
                "Rank_Math_Description": item.meta_description or "",
            })
        zip_file.writestr("rank_math_seo.csv", rm_csv_out.getvalue().encode("utf-8"))

        # 3. JSON Structure
        json_data = json.dumps(
            {
                "project_name": project.name,
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "pages": [i.model_dump() for i in items],
            },
            indent=2,
            ensure_ascii=False,
        )
        zip_file.writestr("structure.json", json_data.encode("utf-8"))

        # 4. Individual HTML Files
        for item in items:
            clean_slug = _safe_download_name(
                item.slug.strip("/").replace("/", "_"),
                fallback=f"page_{item.page_id}",
            )
            file_name = f"html_pages/{clean_slug}.html"
            html_content = item.content_html or f"<!-- Sin contenido maquetado para {item.title} -->"
            zip_file.writestr(file_name, html_content.encode("utf-8"))

        # 5. README instructions
        readme = f"""GUÍA DE IMPORTACIÓN A WORDPRESS
================================
Proyecto: {project.name}
Fecha: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}
Total Páginas: {len(items)}

OPCIÓN A — WP All Import (Recomendado):
1. Instala el plugin WP All Import en tu WordPress.
2. Sube el archivo 'import_all_pages.csv'.
3. Mapea los campos:
   - Título -> Title
   - Contenido -> Content (acepta HTML y código Divi limpio)
   - Slug -> Slug
   - Categoría -> Category
   - Rank Math SEO -> Rank_Math_Title, Rank_Math_Description, Rank_Math_Focus_Keyword

OPCIÓN B — HTML Individuales:
Los archivos de la carpeta 'html_pages/' contienen el código HTML maquetado listo para copiar y pegar en WordPress / Divi Builder.
"""
        zip_file.writestr("README.txt", readme.encode("utf-8"))

    zip_buffer.seek(0)
    filename = f"wp_bundle_{safe_name}_{project_id}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/test-connection", response_model=WpTestConnectionResponse)
async def test_wp_connection(payload: WpTestConnectionRequest, db: Session = Depends(get_db)):
    wp_url = payload.wp_url
    wp_username = payload.wp_username
    wp_app_password = payload.wp_app_password

    if payload.project_id and (not wp_url or not wp_username or not wp_app_password):
        project = db.get(Project, payload.project_id)
        if project:
            wp_url = wp_url or project.wp_url
            wp_username = wp_username or project.wp_username
            wp_app_password = wp_app_password or read_secret(project.wp_app_password)

    if not wp_url or not wp_username or not wp_app_password:
        raise HTTPException(
            status_code=400,
            detail="Faltan credenciales de WordPress (URL, usuario o contraseña de aplicación)",
        )

    base_url = wp_url.rstrip("/")
    api_endpoint = f"{base_url}/wp-json/wp/v2/users/me"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(api_endpoint, auth=(wp_username, wp_app_password))
            if res.status_code == 200:
                user_data = res.json()
                return WpTestConnectionResponse(
                    success=True,
                    site_name=user_data.get("name", "WordPress Site"),
                    site_url=base_url,
                    message=f"Conexión exitosa como usuario «{user_data.get('name', wp_username)}»",
                )
            elif res.status_code == 401 or res.status_code == 403:
                return WpTestConnectionResponse(
                    success=False,
                    site_url=base_url,
                    message=f"Error de autenticación (HTTP {res.status_code}): Verifica tu usuario y contraseña de aplicación de WordPress.",
                )
            else:
                return WpTestConnectionResponse(
                    success=False,
                    site_url=base_url,
                    message=f"Error del servidor WordPress (HTTP {res.status_code}): {res.text[:120]}",
                )
    except Exception as e:
        return WpTestConnectionResponse(
            success=False,
            site_url=base_url,
            message=f"No se pudo conectar con el servidor WordPress: {str(e)}",
        )


@router.post("/push", response_model=WpPushResponse)
async def push_to_wordpress(payload: WpPushRequest, db: Session = Depends(get_db)):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    wp_url = payload.wp_url or project.wp_url
    wp_username = payload.wp_username or project.wp_username
    wp_app_password = payload.wp_app_password or read_secret(project.wp_app_password)

    if not wp_url or not wp_username or not wp_app_password:
        raise HTTPException(
            status_code=400,
            detail="Faltan credenciales de WordPress. Configúralas en el proyecto o en la solicitud.",
        )

    base_url = wp_url.rstrip("/")
    endpoint = f"{base_url}/wp-json/wp/v2/{payload.post_type}"

    # Filter pages
    q = db.query(Page).filter(Page.project_id == payload.project_id)
    if payload.page_ids:
        q = q.filter(Page.id.in_(payload.page_ids))
    pages = q.all()

    if not pages:
        return WpPushResponse(
            total_pushed=0,
            success_count=0,
            error_count=0,
            items=[],
        )

    results: list[WpPushResultItem] = []
    success_count = 0
    error_count = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        for page in pages:
            url_rec = db.query(Url).filter(Url.page_id == page.id).first()
            raw_slug = url_rec.slug.strip("/") if url_rec else page.title.lower().strip().replace(" ", "-")

            kws = db.query(Keyword).filter(Keyword.page_id == page.id).all()
            primary_kw = next((k.term for k in kws if k.is_primary), (kws[0].term if kws else ""))

            content_html = page.content_html or page.objective or ""

            post_data = {
                "title": page.title,
                "slug": raw_slug,
                "content": content_html,
                "status": payload.post_status,
                "meta": {
                    "rank_math_title": page.seo_title or page.title,
                    "rank_math_description": page.seo_description or "",
                    "rank_math_focus_keyword": primary_kw,
                },
            }

            try:
                res = await client.post(
                    endpoint,
                    json=post_data,
                    auth=(wp_username, wp_app_password),
                )
                if res.status_code in (200, 201):
                    res_json = res.json()
                    results.append(
                        WpPushResultItem(
                            page_id=page.id,
                            title=page.title,
                            wp_post_id=res_json.get("id"),
                            wp_url=res_json.get("link"),
                            status="success",
                            message=f"Página creada en WP (ID: {res_json.get('id')}) con estado {payload.post_status}",
                        )
                    )
                    success_count += 1
                else:
                    results.append(
                        WpPushResultItem(
                            page_id=page.id,
                            title=page.title,
                            status="error",
                            message=f"Error WP (HTTP {res.status_code}): {res.text[:120]}",
                        )
                    )
                    error_count += 1
            except Exception as e:
                results.append(
                    WpPushResultItem(
                        page_id=page.id,
                        title=page.title,
                        status="error",
                        message=f"Fallo de conexión: {str(e)}",
                    )
                )
                error_count += 1

    return WpPushResponse(
        total_pushed=len(pages),
        success_count=success_count,
        error_count=error_count,
        items=results,
    )