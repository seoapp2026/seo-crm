from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.auth_session import auth_enabled, session_email_from_request
from app.constants import API_PREFIX

PUBLIC_API_SUFFIXES = (
    "/health",
    "/auth/login",
    "/auth/logout",
    "/auth/me",
    "/integrations/google/callback",
)


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
        if any(relative == suffix or relative.startswith(f"{suffix}?") for suffix in PUBLIC_API_SUFFIXES):
            return await call_next(request)

        if not session_email_from_request(request):
            return JSONResponse(status_code=401, content={"detail": "Inicia sesión para continuar"})

        return await call_next(request)