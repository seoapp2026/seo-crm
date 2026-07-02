from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import GoogleAuth, GoogleServiceType, Project
from app.schemas_phase2 import GoogleAuthOut, GoogleConnectRequest, GoogleConnectResponse
from app.services.google_oauth import (
    auth_to_out,
    build_auth_url,
    exchange_code,
    get_or_create_auth,
    parse_oauth_state,
    save_credentials,
)

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
    if not db.get(Project, payload.project_id):
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if payload.service == GoogleServiceType.ads:
        raise HTTPException(status_code=400, detail="Google Ads OAuth pendiente — requiere developer token")
    get_or_create_auth(db, payload.project_id, payload.service)
    url = build_auth_url(payload.project_id, payload.service)
    return GoogleConnectResponse(auth_url=url)


@router.get("/google/callback")
def google_callback(code: str = Query(...), state: str = Query(...), db: Session = Depends(get_db)):
    project_id, service = parse_oauth_state(state)
    auth = get_or_create_auth(db, project_id, service)
    creds = exchange_code(code, service)
    save_credentials(db, auth, creds, service)
    frontend = "http://localhost:5173"
    for origin in settings.cors_origin_list:
        if origin.startswith("https://"):
            frontend = origin.rstrip("/")
            break
    else:
        if settings.cors_origin_list:
            frontend = settings.cors_origin_list[0].rstrip("/")
    return RedirectResponse(url=f"{frontend}/integrations?connected={service.value}")


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