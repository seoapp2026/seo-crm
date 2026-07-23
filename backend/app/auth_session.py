import time
from typing import Any

import jwt
from fastapi import HTTPException, Request, Response

from app.config import settings

COOKIE_NAME = "seo_crm_session"
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days


def auth_enabled() -> bool:
    return bool(settings.app_auth_password.strip())


def create_session_token(email: str) -> str:
    payload = {
        "sub": email.strip().lower(),
        "iat": int(time.time()),
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_session_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada") from exc


def set_session_cookie(response: Response, email: str) -> None:
    token = create_session_token(email)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
        max_age=TOKEN_TTL_SECONDS,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")


def session_email_from_request(request: Request) -> str | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        payload = decode_session_token(token)
    except HTTPException:
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) and sub else None


def email_allowed(email: str) -> bool:
    allowed = settings.auth_allowed_emails_list
    if not allowed:
        return True
    return email.strip().lower() in allowed


def verify_login(email: str, password: str) -> str:
    if not auth_enabled():
        return email.strip().lower() or "dev@local"
    normalized = email.strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="Email requerido")
    if not email_allowed(normalized):
        raise HTTPException(status_code=403, detail="Email no autorizado")
    if password != settings.app_auth_password:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
    return normalized