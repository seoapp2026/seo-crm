import logging
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import GoogleAuth, GoogleServiceType, Project
from app.services.ads_config import require_ads_oauth_config
from app.services.project_targets import project_ga4_property, project_gsc_site
from app.schemas_phase2 import GscSiteOut, GoogleAuthOut, GoogleConnectRequest, GoogleConnectResponse
from app.services.gsc_sites import list_gsc_sites_for_project
from app.services.google_oauth import (
    auth_to_out,
    build_auth_url,
    exchange_code,
    get_or_create_auth,
    parse_oauth_state,
    save_credentials,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])


def _list_for_project(db: Session, project_id: int | None) -> list[GoogleAuthOut]:
    q = db.query(GoogleAuth)
    if project_id is not None:
        q = q.filter(GoogleAuth.project_id == project_id)
    rows = q.order_by(GoogleAuth.project_id, GoogleAuth.service).all()
    if project_id is not None:
        for service in GoogleServiceType:
            if not any(r.service == service for r in rows):
                auth = get_or_create_auth(db, project_id, service)
                rows.append(auth)
    return [auth_to_out(r) for r in rows]


@router.get("/google", response_model=list[GoogleAuthOut])
def list_google_integrations(project_id: int | None = Query(None), db: Session = Depends(get_db)):
    return _list_for_project(db, project_id)


@router.post("/google/connect", response_model=GoogleConnectResponse)
def connect_google(payload: GoogleConnectRequest, db: Session = Depends(get_db)):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if payload.service == GoogleServiceType.ads:
        try:
            require_ads_oauth_config()
        except ValueError as exc:
            logger.error("Ads OAuth connect blocked project_id=%s: %s", payload.project_id, exc)
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        logger.info(
            "Ads OAuth connect start project_id=%s (developer token present)",
            payload.project_id,
        )
    if payload.service == GoogleServiceType.gsc and not project_gsc_site(project):
        raise HTTPException(
            status_code=400,
            detail="Configura la URL de Search Console en Proyectos (ej. https://www.tusitio.com/)",
        )
    if payload.service == GoogleServiceType.ga4 and not project_ga4_property(project):
        raise HTTPException(
            status_code=400,
            detail="Configura el GA4 Property ID en Proyectos antes de conectar",
        )
    get_or_create_auth(db, payload.project_id, payload.service)
    try:
        url = build_auth_url(payload.project_id, payload.service)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Failed to build OAuth URL project_id=%s service=%s",
            payload.project_id,
            payload.service,
        )
        raise HTTPException(status_code=500, detail=f"Error al iniciar OAuth: {exc}") from exc
    logger.info("OAuth URL ready project_id=%s service=%s", payload.project_id, payload.service.value)
    return GoogleConnectResponse(auth_url=url)


@router.get("/google/callback")
def google_callback(code: str = Query(...), state: str = Query(...), db: Session = Depends(get_db)):
    project_id, service = parse_oauth_state(state)
    logger.info("OAuth callback project_id=%s service=%s", project_id, service.value)
    try:
        auth = get_or_create_auth(db, project_id, service)
        creds = exchange_code(code, service)
        save_credentials(db, auth, creds, service)
        if service == GoogleServiceType.ads:
            from app.services.ads_config import digits_only

            cid = digits_only(settings.google_ads_customer_id)
            if cid:
                auth.property_id = cid
                auth.property_label = f"Customer {cid}"
                db.commit()
            logger.info(
                "Ads OAuth connected project_id=%s email=%s customer_id=%s",
                project_id,
                auth.account_email,
                cid or "(not set in env)",
            )
    except HTTPException:
        raise
    except Exception as exc:
        detail = str(exc) or "Error al completar OAuth con Google"
        logger.exception(
            "OAuth callback failed project_id=%s service=%s: %s",
            project_id,
            service.value,
            detail,
        )
        return RedirectResponse(
            url=(
                f"{settings.frontend_base_url}/integrations?oauth_error={service.value}"
                f"&message={quote(detail[:200])}"
            )
        )
    return RedirectResponse(
        url=f"{settings.frontend_base_url}/integrations?connected={service.value}"
    )


@router.get("/google/gsc-sites", response_model=list[GscSiteOut])
def list_gsc_sites(project_id: int = Query(...), db: Session = Depends(get_db)):
    try:
        return list_gsc_sites_for_project(db, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/google/{auth_id}", status_code=204)
def disconnect_google(auth_id: int, db: Session = Depends(get_db)):
    auth = db.get(GoogleAuth, auth_id)
    if not auth:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    auth.access_token = None
    auth.refresh_token = None
    auth.account_email = None
    auth.property_id = None
    auth.property_label = None
    auth.token_expires_at = None
    auth.last_sync_at = None
    db.commit()