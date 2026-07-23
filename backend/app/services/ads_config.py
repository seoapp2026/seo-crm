"""Google Ads env/config checks with clear terminal logging."""

from __future__ import annotations

import logging
import re

from app.config import settings

logger = logging.getLogger(__name__)

_DIGITS = re.compile(r"\D+")


def digits_only(value: str | None) -> str:
    if not value:
        return ""
    return _DIGITS.sub("", value.strip())


def ads_config_status() -> dict[str, object]:
    """Return presence flags for Ads-related settings (never include secrets)."""
    token = (settings.google_ads_developer_token or "").strip()
    customer = digits_only(settings.google_ads_customer_id)
    login = digits_only(settings.google_ads_login_customer_id)
    client_id = bool((settings.google_client_id or "").strip())
    client_secret = bool((settings.google_client_secret or "").strip())
    redirect = bool((settings.google_redirect_uri or "").strip())
    return {
        "developer_token_set": bool(token),
        "developer_token_len": len(token) if token else 0,
        "customer_id_set": bool(customer),
        "customer_id": customer or None,
        "login_customer_id_set": bool(login),
        "login_customer_id": login or None,
        "oauth_client_id_set": client_id,
        "oauth_client_secret_set": client_secret,
        "oauth_redirect_uri_set": redirect,
        "oauth_redirect_uri": (settings.google_redirect_uri or "").strip() or None,
        "ready_for_oauth": client_id and client_secret and redirect and bool(token),
        "ready_for_sync": bool(token) and bool(customer) and client_id and client_secret,
    }


def log_ads_config_status(prefix: str = "Google Ads config") -> dict[str, object]:
    status = ads_config_status()
    missing: list[str] = []
    if not status["developer_token_set"]:
        missing.append("GOOGLE_ADS_DEVELOPER_TOKEN")
    if not status["customer_id_set"]:
        missing.append("GOOGLE_ADS_CUSTOMER_ID")
    if not status["oauth_client_id_set"]:
        missing.append("GOOGLE_CLIENT_ID")
    if not status["oauth_client_secret_set"]:
        missing.append("GOOGLE_CLIENT_SECRET")
    if not status["oauth_redirect_uri_set"]:
        missing.append("GOOGLE_REDIRECT_URI")
    if not status["login_customer_id_set"]:
        # Optional but recommended when using MCC
        logger.info(
            "%s: GOOGLE_ADS_LOGIN_CUSTOMER_ID not set "
            "(optional MCC id; set it if API asks for login-customer-id)",
            prefix,
        )

    if missing:
        logger.warning("%s: MISSING env vars: %s", prefix, ", ".join(missing))
    else:
        logger.info(
            "%s: OK developer_token_len=%s customer_id=%s login_customer_id=%s redirect=%s",
            prefix,
            status["developer_token_len"],
            status["customer_id"],
            status["login_customer_id"],
            status["oauth_redirect_uri"],
        )
    return status


def require_ads_oauth_config() -> None:
    """Raise ValueError if Ads OAuth cannot start; logs missing keys."""
    status = log_ads_config_status("Ads OAuth check")
    missing: list[str] = []
    if not status["developer_token_set"]:
        missing.append("GOOGLE_ADS_DEVELOPER_TOKEN")
    if not status["oauth_client_id_set"]:
        missing.append("GOOGLE_CLIENT_ID")
    if not status["oauth_client_secret_set"]:
        missing.append("GOOGLE_CLIENT_SECRET")
    if not status["oauth_redirect_uri_set"]:
        missing.append("GOOGLE_REDIRECT_URI")
    if missing:
        msg = (
            "Google Ads OAuth no configurado. Faltan variables: "
            + ", ".join(missing)
            + ". Configúralas en Railway / .env y redeploy."
        )
        logger.error(msg)
        raise ValueError(msg)


def require_ads_sync_config() -> tuple[str, str, str | None]:
    """
    Validate env for Keyword Planner sync.
    Returns (developer_token, customer_id_digits, login_customer_id_or_None).
    """
    status = log_ads_config_status("Ads sync check")
    missing: list[str] = []
    token = (settings.google_ads_developer_token or "").strip()
    customer = digits_only(settings.google_ads_customer_id)
    login = digits_only(settings.google_ads_login_customer_id) or None

    if not token:
        missing.append("GOOGLE_ADS_DEVELOPER_TOKEN")
    if not customer:
        missing.append("GOOGLE_ADS_CUSTOMER_ID")
    if not status["oauth_client_id_set"]:
        missing.append("GOOGLE_CLIENT_ID")
    if not status["oauth_client_secret_set"]:
        missing.append("GOOGLE_CLIENT_SECRET")

    if missing:
        msg = (
            "Google Ads sync no puede ejecutarse. Faltan variables: "
            + ", ".join(missing)
            + ". Revisa Railway / .env (token Basic Access + Customer ID del cliente Ads)."
        )
        logger.error(msg)
        raise ValueError(msg)

    if len(customer) != 10:
        logger.warning(
            "GOOGLE_ADS_CUSTOMER_ID has %s digits (expected 10). value=%s",
            len(customer),
            customer,
        )

    return token, customer, login
