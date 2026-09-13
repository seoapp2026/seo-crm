"""Emparejamiento de páginas con filas de GSC/GA4 vía canonical (WP4).

Regla de matching: Page.canonical_url (fallback: dominio del proyecto +
slug de la URL primaria de la página) ↔ GscData.page_url ↔ AnalyticsData.page_path.
Nunca se inventan matches: sin clave resoluble se devuelve lista vacía.
"""

from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.models import AnalyticsData, GscData, Page, Project, Url


def _primary_url(page: Page) -> Url | None:
    urls = sorted(page.urls, key=lambda u: u.id)
    return urls[0] if urls else None


def resolve_page_key(db: Session, page: Page) -> str | None:
    """Clave de matching de una página: canonical_url, o dominio del proyecto + slug."""
    canonical = (page.canonical_url or "").strip()
    if canonical:
        return canonical
    url = _primary_url(page)
    if url is None or not (url.slug or "").strip():
        return None
    project = page.project if page.project is not None else db.get(Project, page.project_id)
    if project is None:
        return None
    base = ((project.wp_url or project.gsc_site_url) or "").strip().rstrip("/")
    if not base:
        return None
    return base + "/" + url.slug.strip().lstrip("/")


def _key_variants(key: str) -> list[str]:
    """Variante con/sin barra final para comparación insensible a la barra."""
    stripped = key.rstrip("/")
    if not stripped:
        return []
    return [stripped, stripped + "/"]


def find_gsc_rows(
    db: Session,
    page: Page,
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[GscData]:
    key = resolve_page_key(db, page)
    if not key:
        return []
    q = db.query(GscData).filter(GscData.project_id == page.project_id, GscData.page_url == key)
    if from_date:
        q = q.filter(GscData.date >= from_date)
    if to_date:
        q = q.filter(GscData.date <= to_date)
    rows = q.order_by(GscData.date.desc(), GscData.clicks.desc()).all()
    if rows:
        return rows
    # Sin coincidencia exacta: reintento insensible a la barra final
    q = db.query(GscData).filter(
        GscData.project_id == page.project_id,
        GscData.page_url.in_(_key_variants(key)),
    )
    if from_date:
        q = q.filter(GscData.date >= from_date)
    if to_date:
        q = q.filter(GscData.date <= to_date)
    return q.order_by(GscData.date.desc(), GscData.clicks.desc()).all()


def find_analytics_rows(
    db: Session,
    page: Page,
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[AnalyticsData]:
    key = resolve_page_key(db, page)
    if not key:
        return []
    # GA4 pagePath suele ser relativo ("/ruta"): probamos la clave completa y
    # también la parte de ruta, cada una con/sin barra final.
    candidates: list[str] = []
    for candidate in [key, *_key_variants(key), *_path_variants(key)]:
        if candidate and candidate not in candidates:
            candidates.append(candidate)
    q = db.query(AnalyticsData).filter(
        AnalyticsData.project_id == page.project_id,
        AnalyticsData.page_path.in_(candidates),
    )
    if from_date:
        q = q.filter(AnalyticsData.date >= from_date)
    if to_date:
        q = q.filter(AnalyticsData.date <= to_date)
    return q.order_by(AnalyticsData.date.desc()).all()


def _path_variants(key: str) -> list[str]:
    """Variantes de la parte de ruta de una URL (para page_path relativo de GA4)."""
    path = urlparse(key).path
    if not path or path == "/":
        return []
    stripped = path.rstrip("/")
    return [stripped, stripped + "/"] if stripped else []


def build_project_page_url_map(db: Session, project_id: int) -> dict[str, int]:
    """Mapa page_url (exacta y variante de barra final) → url_id para un proyecto.

    Usado por la sync de GSC para rellenar GscData.url_id cuando hay match.
    """
    result: dict[str, int] = {}
    pages = db.query(Page).filter(Page.project_id == project_id).all()
    for page in pages:
        url = _primary_url(page)
        if url is None:
            continue
        key = resolve_page_key(db, page)
        if not key:
            continue
        for variant in _key_variants(key):
            result.setdefault(variant, url.id)
    return result
