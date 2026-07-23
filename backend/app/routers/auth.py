from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.auth_session import (
    auth_enabled,
    clear_session_cookie,
    session_email_from_request,
    set_session_cookie,
    verify_login,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class AuthStatusOut(BaseModel):
    authenticated: bool
    email: str | None = None
    auth_required: bool


@router.get("/me", response_model=AuthStatusOut)
def auth_me(request: Request):
    email = session_email_from_request(request)
    return AuthStatusOut(
        authenticated=bool(email),
        email=email,
        auth_required=auth_enabled(),
    )


@router.post("/login", response_model=AuthStatusOut)
def login(payload: LoginRequest, response: Response):
    email = verify_login(payload.email, payload.password)
    set_session_cookie(response, email)
    return AuthStatusOut(authenticated=True, email=email, auth_required=auth_enabled())


@router.post("/logout", status_code=204)
def logout(response: Response):
    clear_session_cookie(response)


def require_auth(request: Request) -> str:
    if not auth_enabled():
        return "dev@local"
    email = session_email_from_request(request)
    if not email:
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar")
    return email