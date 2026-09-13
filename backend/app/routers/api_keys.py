import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ApiKey
from app.routers.auth import require_auth
from app.schemas import ApiKeyCreate, ApiKeyOut

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


@router.post("", status_code=201)
def create_api_key(
    payload: ApiKeyCreate,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_auth),
):
    """Crea una clave de API. La clave completa solo se muestra en esta respuesta."""
    raw_key = "seocrm_" + secrets.token_urlsafe(24)
    api_key = ApiKey(
        name=payload.name,
        key_hash=_hash_key(raw_key),
        prefix=raw_key[:8],
        can_write=payload.can_write,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    data = ApiKeyOut.model_validate(api_key).model_dump()
    data["api_key"] = raw_key
    return data


@router.get("", response_model=list[ApiKeyOut])
def list_api_keys(db: Session = Depends(get_db), _admin: str = Depends(require_auth)):
    return db.query(ApiKey).order_by(ApiKey.issued_at.desc()).all()


@router.delete("/{api_key_id}", response_model=ApiKeyOut)
def revoke_api_key(
    api_key_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_auth),
):
    api_key = db.get(ApiKey, api_key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="Clave de API no encontrada")
    if api_key.revoked_at is None:
        api_key.revoked_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(api_key)
    return api_key
