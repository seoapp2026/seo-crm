from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from app.models import GoogleAuth, GoogleServiceType
from app.services.google_oauth import credentials_from_auth, save_credentials


def list_gsc_sites_for_project(db: Session, project_id: int) -> list[dict[str, str]]:
    auth = (
        db.query(GoogleAuth)
        .filter(GoogleAuth.project_id == project_id, GoogleAuth.service == GoogleServiceType.gsc)
        .first()
    )
    if not auth or not auth.refresh_token:
        raise ValueError("Search Console no conectado — autoriza OAuth primero")

    creds = credentials_from_auth(auth, GoogleServiceType.gsc)
    save_credentials(db, auth, creds, GoogleServiceType.gsc)

    service = build("searchconsole", "v1", credentials=creds)
    try:
        response = service.sites().list().execute()
    except HttpError as exc:
        raise ValueError(f"No se pudieron listar propiedades de Search Console: {exc.reason}") from exc

    sites: list[dict[str, str]] = []
    for entry in response.get("siteEntry", []):
        site_url = entry.get("siteUrl")
        if not site_url:
            continue
        sites.append(
            {
                "site_url": site_url,
                "permission_level": entry.get("permissionLevel", "unknown"),
            }
        )
    return sorted(sites, key=lambda item: item["site_url"])


def validate_gsc_site_access(db: Session, project_id: int, site: str) -> None:
    sites = list_gsc_sites_for_project(db, project_id)
    available = [item["site_url"] for item in sites]
    if site in available:
        return

    if not available:
        raise ValueError(
            f"La cuenta OAuth no tiene ninguna propiedad en Search Console. "
            f"Verifica el sitio en search.google.com/search-console y vuelve a conectar OAuth."
        )

    formatted = "\n".join(f"  • {url}" for url in available)
    raise ValueError(
        f"La cuenta OAuth no tiene acceso a '{site}'.\n"
        f"Propiedades disponibles para esta cuenta:\n{formatted}\n"
        f"Copia una de esas URLs exactas en Proyectos → URL de Search Console."
    )