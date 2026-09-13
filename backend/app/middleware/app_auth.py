import hashlib
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.auth_session import auth_enabled, session_email_from_request
from app.constants import API_PREFIX
from app.database import SessionLocal
from app.models import ApiKey

PUBLIC_API_SUFFIXES = (
    "/health",
    "/auth/login",
    "/auth/logout",
    "/auth/me",
    "/integrations/google/callback",
)


def _api_key_from_request(request: Request) -> tuple[ApiKey | None, str | None]:
    """Autentica una petición con la cabecera X-API-Key.

    Devuelve (api_key, error) donde error es None si la clave es válida,
    "missing" si no hay cabecera o la clave no existe/está revocada, y
    "forbidden" si la clave es de solo lectura y la petición no es GET.
    """
    raw = request.headers.get("x-api-key")
    if not raw:
        return None, "missing"
    key_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    db = SessionLocal()
    try:
        api_key = db.query(ApiKey).filter(ApiKey.key_hash == key_hash).first()
        if not api_key or api_key.revoked_at is not None:
            return None, "missing"
        if not api_key.can_write and request.method != "GET":
            return api_key, "forbidden"
        api_key.last_used_at = datetime.now(timezone.utc)
        db.commit()
        return api_key, None
    finally:
        db.close()


class AppAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not auth_enabled():
            return await call_next(request)

        path = request.url.path
        api_root = API_PREFIX
        if not path.startswith(api_root):
            return await call_next(request)

        if request.method == "OPTIONS":
            return await call_next(request)

        relative = path[len(api_root) :]
        # WP8: el alias versionado /v1 comparte las rutas públicas del prefijo base
        if relative.startswith("/v1"):
            versionless = relative[len("/v1") :]
        else:
            versionless = relative
        if any(
            versionless == suffix or versionless.startswith(f"{suffix}?") for suffix in PUBLIC_API_SUFFIXES
        ):
            return await call_next(request)

        if not session_email_from_request(request):
            api_key, error = _api_key_from_request(request)
            if error == "forbidden":
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Esta clave de API solo permite lectura"},
                )
            if api_key is None:
                return JSONResponse(status_code=401, content={"detail": "Inicia sesión para continuar"})

        return await call_next(request)
