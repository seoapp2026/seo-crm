"""Fernet encryption at rest for stored credentials.

Wraps GoogleAuth access/refresh tokens and Project.wp_app_password before they
hit the database. Migration is gradual: legacy plaintext values that fail
decryption are returned as-is and re-encrypted on the next write.

If APP_ENCRYPTION_KEY is absent/empty, encryption is bypassed (plaintext
behavior, same as before) and a warning is logged.
"""

import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger(__name__)

_warned_missing_key = False


def _fernet() -> Fernet | None:
    global _warned_missing_key
    key = (settings.app_encryption_key or "").strip()
    if not key:
        if not _warned_missing_key:
            logger.warning(
                "APP_ENCRYPTION_KEY is not set — credentials will be stored as plaintext. "
                "Generate a key with: python -c \"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\""
            )
            _warned_missing_key = True
        return None
    return Fernet(key.encode())


def encrypt_value(value: str) -> str:
    """Encrypt a string. Returns it unchanged when no key is configured."""
    fernet = _fernet()
    if fernet is None:
        return value
    return fernet.encrypt(value.encode()).decode()


def decrypt_value(value: str) -> str:
    """Decrypt a string. Values that fail decryption are treated as legacy
    plaintext and returned as-is (migrate-on-read)."""
    fernet = _fernet()
    if fernet is None:
        return value
    try:
        return fernet.decrypt(value.encode()).decode()
    except InvalidToken:
        logger.info("Secret is not ciphertext (legacy plaintext) — returning as-is")
        return value


def store_secret(value: str | None) -> str | None:
    """Encrypt a credential for storage. None/empty pass through unchanged."""
    if value is None or value == "":
        return value
    return encrypt_value(value)


def read_secret(value: str | None) -> str | None:
    """Decrypt a credential read from storage. Legacy plaintext values are
    returned as-is; they are re-encrypted on the next write."""
    if value is None or value == "":
        return value
    return decrypt_value(value)
