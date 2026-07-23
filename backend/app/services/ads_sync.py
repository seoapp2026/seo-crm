"""Google Ads Keyword Planner sync → ads_keywords table."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.models import (
    AdsCompetition,
    AdsKeyword,
    GoogleAuth,
    GoogleServiceType,
    Keyword,
    SyncJob,
    SyncJobStatus,
    SyncJobType,
)
from app.services.ads_config import require_ads_sync_config
from app.services.google_oauth import credentials_from_auth, save_credentials

logger = logging.getLogger(__name__)

# Google Ads API version for REST KeywordPlanIdeaService
ADS_API_VERSION = "v19"
BATCH_SIZE = 20


def _competition_from_api(value: str | None) -> AdsCompetition:
    raw = (value or "").upper().replace("COMPETITION_", "")
    if raw in ("LOW", "MEDIUM", "HIGH"):
        return AdsCompetition[raw]
    return AdsCompetition.MEDIUM


def _micros_to_currency(micros: int | float | str | None) -> float:
    if micros is None or micros == "":
        return 0.0
    try:
        return round(float(micros) / 1_000_000.0, 2)
    except (TypeError, ValueError):
        return 0.0


def _as_int(value: object) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _seed_terms(db: Session, project_id: int) -> list[str]:
    terms = [
        (k.term or "").strip()
        for k in db.query(Keyword).filter(Keyword.project_id == project_id).all()
        if (k.term or "").strip()
    ]
    # de-dupe case-insensitively, keep first casing
    seen: set[str] = set()
    unique: list[str] = []
    for t in terms:
        key = t.casefold()
        if key in seen:
            continue
        seen.add(key)
        unique.append(t)
    return unique


def _parse_ads_error(resp: httpx.Response) -> str:
    try:
        data = resp.json()
    except Exception:
        return f"HTTP {resp.status_code}: {resp.text[:400]}"

    # Google Ads error shape
    errors = []
    if isinstance(data, dict):
        for err in data.get("error", {}).get("details", []) or []:
            for e in err.get("errors", []) or []:
                msg = e.get("message") or e.get("errorCode") or str(e)
                errors.append(str(msg))
        if not errors and data.get("error", {}).get("message"):
            errors.append(str(data["error"]["message"]))
    if errors:
        return "; ".join(errors)[:500]
    return f"HTTP {resp.status_code}: {str(data)[:400]}"


def _call_historical_metrics(
    *,
    access_token: str,
    developer_token: str,
    customer_id: str,
    login_customer_id: str | None,
    keywords: list[str],
) -> list[dict]:
    url = (
        f"https://googleads.googleapis.com/{ADS_API_VERSION}/"
        f"customers/{customer_id}:generateKeywordHistoricalMetrics"
    )
    headers = {
        "Authorization": f"Bearer {access_token}",
        "developer-token": developer_token,
        "Content-Type": "application/json",
    }
    if login_customer_id:
        headers["login-customer-id"] = login_customer_id

    body = {
        "keywords": keywords,
        "keywordPlanNetwork": "GOOGLE_SEARCH",
    }

    logger.info(
        "Ads API generateKeywordHistoricalMetrics customer=%s login_customer=%s keywords=%s",
        customer_id,
        login_customer_id or "(none)",
        len(keywords),
    )

    with httpx.Client(timeout=60.0) as client:
        resp = client.post(url, headers=headers, json=body)

    if resp.status_code >= 400:
        detail = _parse_ads_error(resp)
        logger.error(
            "Ads API error status=%s customer=%s detail=%s body=%s",
            resp.status_code,
            customer_id,
            detail,
            resp.text[:800],
        )
        if "login-customer-id" in detail.lower() or "LOGIN_CUSTOMER" in detail.upper():
            raise ValueError(
                f"Google Ads API: {detail}. "
                "Configura GOOGLE_ADS_LOGIN_CUSTOMER_ID con el ID del Manager (MCC) y redeploy."
            )
        if "DEVELOPER_TOKEN" in detail.upper() or "developer token" in detail.lower():
            raise ValueError(
                f"Google Ads API: {detail}. "
                "Revisa GOOGLE_ADS_DEVELOPER_TOKEN y que Basic Access esté Approved en API Center."
            )
        if "CUSTOMER" in detail.upper() and "PERMISSION" in detail.upper():
            raise ValueError(
                f"Google Ads API: {detail}. "
                "La cuenta OAuth debe tener acceso al Customer ID y el cliente debe estar linked al MCC."
            )
        raise ValueError(f"Google Ads API: {detail}")

    data = resp.json()
    results = data.get("results") or data.get("metrics") or []
    logger.info("Ads API OK: %s metric rows for batch of %s keywords", len(results), len(keywords))
    return results if isinstance(results, list) else []


def _upsert_keyword(
    db: Session,
    project_id: int,
    term: str,
    volume: int,
    competition: AdsCompetition,
    cpc_low: float,
    cpc_high: float,
    now: datetime,
) -> None:
    existing = (
        db.query(AdsKeyword)
        .filter(AdsKeyword.project_id == project_id, AdsKeyword.term == term)
        .first()
    )
    if existing:
        existing.volume = volume
        existing.competition = competition
        existing.cpc_low = cpc_low
        existing.cpc_high = cpc_high
        existing.synced_at = now
    else:
        db.add(
            AdsKeyword(
                project_id=project_id,
                term=term,
                volume=volume,
                competition=competition,
                cpc_low=cpc_low,
                cpc_high=cpc_high,
                synced_at=now,
            )
        )


def sync_ads_for_project(db: Session, project_id: int) -> int:
    logger.info("Ads sync starting project_id=%s", project_id)

    developer_token, customer_id, login_customer_id = require_ads_sync_config()

    auth = (
        db.query(GoogleAuth)
        .filter(GoogleAuth.project_id == project_id, GoogleAuth.service == GoogleServiceType.ads)
        .first()
    )
    if not auth or not auth.refresh_token:
        msg = (
            f"Google Ads no conectado para proyecto {project_id}. "
            "Ve a Integraciones → Keyword Planner → Conectar OAuth."
        )
        logger.error(msg)
        raise ValueError(msg)

    job = (
        db.query(SyncJob)
        .filter(SyncJob.project_id == project_id, SyncJob.job_type == SyncJobType.ads)
        .first()
    )
    if job:
        job.status = SyncJobStatus.running
        job.last_error = None
        db.commit()

    try:
        creds = credentials_from_auth(auth, GoogleServiceType.ads)
        save_credentials(db, auth, creds, GoogleServiceType.ads)
        if not creds.token:
            raise ValueError(
                "No se obtuvo access_token de OAuth para Ads. "
                "Desconecta y vuelve a conectar Keyword Planner."
            )

        seeds = _seed_terms(db, project_id)
        if not seeds:
            msg = (
                f"Proyecto {project_id} no tiene keywords en la tabla keywords. "
                "Añade palabras clave en el CRM y vuelve a sincronizar."
            )
            logger.warning(msg)
            raise ValueError(msg)

        logger.info("Ads sync project=%s seed_keywords=%s", project_id, len(seeds))

        now = datetime.now(timezone.utc)
        count = 0

        for i in range(0, len(seeds), BATCH_SIZE):
            batch = seeds[i : i + BATCH_SIZE]
            results = _call_historical_metrics(
                access_token=creds.token,
                developer_token=developer_token,
                customer_id=customer_id,
                login_customer_id=login_customer_id,
                keywords=batch,
            )

            # Map by text from API; fall back to seed order if missing
            for row in results:
                # Response shapes vary slightly by API version
                text = (
                    row.get("text")
                    or row.get("keywordText")
                    or (row.get("keywordMetrics") or {}).get("text")
                    or ""
                )
                metrics = row.get("keywordMetrics") or row.get("metrics") or row
                if not text and isinstance(metrics, dict):
                    # generateKeywordHistoricalMetrics returns results[].text + keywordMetrics
                    pass
                if not text:
                    # try nested
                    text = str(row.get("closeVariants", [""])[0] if row.get("closeVariants") else "")
                term = (text or "").strip()
                if not term:
                    # Pair by index if API returns same order (best-effort)
                    continue

                if not isinstance(metrics, dict):
                    metrics = {}
                volume = _as_int(
                    metrics.get("avgMonthlySearches") or metrics.get("avg_monthly_searches")
                )
                competition = _competition_from_api(
                    metrics.get("competition") or metrics.get("competitionLevel")
                )
                cpc_low = _micros_to_currency(
                    metrics.get("lowTopOfPageBidMicros") or metrics.get("low_top_of_page_bid_micros")
                )
                cpc_high = _micros_to_currency(
                    metrics.get("highTopOfPageBidMicros") or metrics.get("high_top_of_page_bid_micros")
                )
                _upsert_keyword(db, project_id, term, volume, competition, cpc_low, cpc_high, now)
                count += 1
                logger.debug(
                    "Ads keyword upserted term=%r volume=%s competition=%s",
                    term,
                    volume,
                    competition.value,
                )

            # For seeds with no result row, still upsert 0 volume so UI shows they were checked
            returned_terms = {
                (
                    (r.get("text") or r.get("keywordText") or "")
                    .strip()
                    .casefold()
                )
                for r in results
            }
            for seed in batch:
                if seed.casefold() not in returned_terms:
                    # API may return result with close variants only — keep seed with zeros
                    existing = (
                        db.query(AdsKeyword)
                        .filter(AdsKeyword.project_id == project_id, AdsKeyword.term == seed)
                        .first()
                    )
                    if not existing:
                        _upsert_keyword(
                            db, project_id, seed, 0, AdsCompetition.MEDIUM, 0.0, 0.0, now
                        )
                        count += 1

        auth.last_sync_at = now
        auth.property_id = customer_id
        auth.property_label = f"Customer {customer_id}"
        if job:
            job.status = SyncJobStatus.success
            job.records_synced = (job.records_synced or 0) + count
            job.last_run_at = now
            job.last_error = None
        db.commit()
        logger.info("Ads sync complete project=%s records=%s", project_id, count)
        return count

    except Exception as exc:
        logger.exception("Ads sync failed project_id=%s: %s", project_id, exc)
        if job:
            job.status = SyncJobStatus.error
            job.last_error = str(exc)[:500]
            job.last_run_at = datetime.now(timezone.utc)
            db.commit()
        raise
