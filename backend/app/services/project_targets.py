from sqlalchemy.orm import Session

from app.config import settings
from app.models import GoogleAuth, GoogleServiceType, Project


def normalize_gsc_site_url(raw: str | None) -> str | None:
    if not raw or not raw.strip():
        return None
    url = raw.strip()
    if url.startswith("sc-domain:"):
        return url
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"
    if not url.endswith("/"):
        url += "/"
    return url


def normalize_ga4_property_id(raw: str | None) -> str | None:
    if not raw or not raw.strip():
        return None
    value = raw.strip()
    if value.startswith("properties/"):
        value = value.split("/", 1)[1]
    return value


def project_gsc_site(project: Project | None) -> str | None:
    if not project:
        return None
    return normalize_gsc_site_url(project.gsc_site_url) or normalize_gsc_site_url(settings.gsc_site_url)


def project_ga4_property(project: Project | None) -> str | None:
    if not project:
        return None
    raw = project.ga4_property_id or settings.ga4_property_id
    pid = normalize_ga4_property_id(raw)
    if not pid:
        return None
    return f"properties/{pid}"


def resolve_gsc_site(db: Session, project_id: int, auth: GoogleAuth | None) -> str | None:
    project = db.get(Project, project_id)
    if auth and auth.property_id:
        return normalize_gsc_site_url(auth.property_id) or auth.property_id
    return project_gsc_site(project)


def resolve_ga4_property(db: Session, project_id: int, auth: GoogleAuth | None) -> str:
    project = db.get(Project, project_id)
    if auth and auth.property_id:
        raw = auth.property_id
        if not raw.startswith("properties/"):
            raw = f"properties/{normalize_ga4_property_id(raw)}"
        return raw
    return project_ga4_property(project) or ""


def apply_project_targets_to_auth(db: Session, project: Project, auth: GoogleAuth):
    if auth.service == GoogleServiceType.gsc:
        site = project_gsc_site(project)
        if site:
            auth.property_id = site
            auth.property_label = site
    elif auth.service == GoogleServiceType.ga4:
        prop = project_ga4_property(project)
        if prop:
            auth.property_id = normalize_ga4_property_id(project.ga4_property_id)
            auth.property_label = f"GA4 — {auth.property_id}"
    db.commit()