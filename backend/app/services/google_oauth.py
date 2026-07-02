import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from app.config import settings
from app.models import GoogleAuth, GoogleServiceType, Project
from app.services.project_targets import apply_project_targets_to_auth

SCOPES = {
    GoogleServiceType.gsc: ["https://www.googleapis.com/auth/webmasters.readonly"],
    GoogleServiceType.ga4: ["https://www.googleapis.com/auth/analytics.readonly"],
    GoogleServiceType.ads: ["https://www.googleapis.com/auth/adwords"],
}


def _client_config() -> dict:
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth no configurado (CLIENT_ID/SECRET)")
    redirect = settings.google_redirect_uri
    if not redirect:
        raise HTTPException(status_code=503, detail="GOOGLE_REDIRECT_URI no configurado")
    return {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect],
        }
    }


def make_oauth_state(project_id: int, service: GoogleServiceType) -> str:
    payload = json.dumps({"project_id": project_id, "service": service.value})
    sig = hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
    raw = base64.urlsafe_b64encode(f"{payload}|{sig}".encode()).decode()
    return raw


def parse_oauth_state(state: str) -> tuple[int, GoogleServiceType]:
    try:
        decoded = base64.urlsafe_b64decode(state.encode()).decode()
        payload, sig = decoded.rsplit("|", 1)
        expected = hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
        if not hmac.compare_digest(sig, expected):
            raise ValueError("invalid signature")
        data = json.loads(payload)
        return data["project_id"], GoogleServiceType(data["service"])
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Estado OAuth inválido") from exc


def build_auth_url(project_id: int, service: GoogleServiceType) -> str:
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES[service])
    flow.redirect_uri = settings.google_redirect_uri
    state = make_oauth_state(project_id, service)
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    return url


def exchange_code(code: str, service: GoogleServiceType) -> Credentials:
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES[service])
    flow.redirect_uri = settings.google_redirect_uri
    flow.fetch_token(code=code)
    return flow.credentials


def credentials_from_auth(auth: GoogleAuth, service: GoogleServiceType) -> Credentials:
    if not auth.refresh_token:
        raise HTTPException(status_code=400, detail="Integración no conectada")
    creds = Credentials(
        token=auth.access_token,
        refresh_token=auth.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES[service],
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        auth.access_token = creds.token
        if creds.expiry:
            auth.token_expires_at = creds.expiry.replace(tzinfo=timezone.utc)
    return creds


def save_credentials(db: Session, auth: GoogleAuth, creds: Credentials, service: GoogleServiceType):
    auth.access_token = creds.token
    auth.refresh_token = creds.refresh_token or auth.refresh_token
    if creds.expiry:
        auth.token_expires_at = creds.expiry.replace(tzinfo=timezone.utc)
    else:
        auth.token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    project = db.get(Project, auth.project_id)
    if project:
        apply_project_targets_to_auth(db, project, auth)

    try:
        oauth2 = build("oauth2", "v2", credentials=creds)
        info = oauth2.userinfo().get().execute()
        auth.account_email = info.get("email")
    except Exception:
        auth.account_email = auth.account_email or "conectado@gmail.com"

    db.commit()
    db.refresh(auth)


def auth_to_out(auth: GoogleAuth):
    from app.schemas_phase2 import GoogleAuthOut

    return GoogleAuthOut(
        id=auth.id,
        project_id=auth.project_id,
        service=auth.service,
        account_email=auth.account_email,
        property_id=auth.property_id,
        property_label=auth.property_label,
        connected=bool(auth.refresh_token),
        last_sync_at=auth.last_sync_at,
        token_expires_at=auth.token_expires_at,
    )


def get_or_create_auth(db: Session, project_id: int, service: GoogleServiceType) -> GoogleAuth:
    auth = (
        db.query(GoogleAuth)
        .filter(GoogleAuth.project_id == project_id, GoogleAuth.service == service)
        .first()
    )
    if not auth:
        auth = GoogleAuth(project_id=project_id, service=service)
        db.add(auth)
        db.commit()
        db.refresh(auth)
    return auth