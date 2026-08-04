"""DataForSEO API v3 client — fixed endpoint whitelist for Option 2 hard caps."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.dataforseo.com"

# Whitelisted paths only (no accidental “call everything”).
PATH_SEARCH_VOLUME = "/v3/keywords_data/google_ads/search_volume/live"
PATH_RELATED_KEYWORDS = "/v3/dataforseo_labs/google/related_keywords/live"
PATH_SERP_ORGANIC = "/v3/serp/google/organic/live/regular"
PATH_INSTANT_PAGES = "/v3/on_page/instant_pages"
PATH_BACKLINKS_SUMMARY = "/v3/backlinks/summary/live"
PATH_REFERRING_DOMAINS = "/v3/backlinks/referring_domains/live"

# Common Google location codes used by DataForSEO
LOCATION_CODES: dict[str, int] = {
    "es": 2724,  # Spain
    "us": 2840,
    "mx": 2484,
    "ar": 2032,
    "co": 2170,
    "cl": 2152,
    "pe": 2604,
    "gb": 2826,
    "uk": 2826,
    "de": 2276,
    "fr": 2250,
    "it": 2380,
    "pt": 2620,
}


@dataclass
class DfsCallResult:
    path: str
    cost_usd: float = 0.0
    ok: bool = True
    error: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


def resolve_location_code(country: str | None) -> int:
    key = (country or "es").strip().lower()[:2]
    return LOCATION_CODES.get(key, 2724)


def resolve_language_code(language: str | None) -> str:
    lang = (language or "es").strip().lower()[:5]
    if not lang:
        return "es"
    return lang.split("-")[0][:2]


def domain_only(url_or_host: str | None) -> str | None:
    if not url_or_host:
        return None
    raw = url_or_host.strip()
    if not raw:
        return None
    if "://" not in raw:
        raw = f"https://{raw}"
    host = urlparse(raw).hostname or ""
    return host.lower().removeprefix("www.") or None


class DataForSeoClient:
    def __init__(self, login: str | None = None, password: str | None = None, timeout: float = 90.0):
        self.login = (login if login is not None else settings.dataforseo_login or "").strip()
        self.password = (password if password is not None else settings.dataforseo_password or "").strip()
        self.timeout = timeout
        self.total_cost_usd = 0.0
        self.calls: list[DfsCallResult] = []

    @property
    def configured(self) -> bool:
        return bool(self.login and self.password)

    def _post(self, path: str, body: list[dict[str, Any]]) -> DfsCallResult:
        if path not in {
            PATH_SEARCH_VOLUME,
            PATH_RELATED_KEYWORDS,
            PATH_SERP_ORGANIC,
            PATH_INSTANT_PAGES,
            PATH_BACKLINKS_SUMMARY,
            PATH_REFERRING_DOMAINS,
        }:
            raise ValueError(f"Endpoint no permitido por whitelist Option 2: {path}")

        url = f"{BASE_URL}{path}"
        logger.info("DataForSEO POST %s tasks=%s", path, len(body))
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    url,
                    json=body,
                    auth=(self.login, self.password),
                    headers={"Content-Type": "application/json"},
                )
        except httpx.HTTPError as exc:
            result = DfsCallResult(path=path, ok=False, error=f"HTTP error: {exc}")
            self.calls.append(result)
            return result

        try:
            data = resp.json()
        except Exception:
            result = DfsCallResult(
                path=path,
                ok=False,
                error=f"Respuesta no JSON HTTP {resp.status_code}: {resp.text[:300]}",
            )
            self.calls.append(result)
            return result

        cost = float(data.get("cost") or 0)
        self.total_cost_usd += cost
        status = int(data.get("status_code") or 0)
        if resp.status_code >= 400 or status not in (20000, 20100):
            msg = data.get("status_message") or f"HTTP {resp.status_code}"
            # partial task errors still may have useful tasks
            tasks_error = int(data.get("tasks_error") or 0)
            if status == 20000 and tasks_error:
                pass
            elif status not in (20000, 20100):
                result = DfsCallResult(path=path, cost_usd=cost, ok=False, error=str(msg)[:400], raw=data)
                self.calls.append(result)
                logger.error("DataForSEO error %s: %s", path, msg)
                return result

        result = DfsCallResult(path=path, cost_usd=cost, ok=True, raw=data)
        self.calls.append(result)
        return result

    def search_volume(
        self,
        keywords: list[str],
        *,
        location_code: int,
        language_code: str,
    ) -> list[dict[str, Any]]:
        if not keywords:
            return []
        # Google Ads search volume accepts up to 1000; we batch by 100 for safety
        out: list[dict[str, Any]] = []
        batch_size = 100
        for i in range(0, len(keywords), batch_size):
            batch = keywords[i : i + batch_size]
            call = self._post(
                PATH_SEARCH_VOLUME,
                [
                    {
                        "keywords": batch,
                        "location_code": location_code,
                        "language_code": language_code,
                    }
                ],
            )
            if not call.ok:
                logger.warning("search_volume failed: %s", call.error)
                continue
            for task in call.raw.get("tasks") or []:
                if int(task.get("status_code") or 0) != 20000:
                    continue
                for row in task.get("result") or []:
                    if isinstance(row, dict):
                        out.append(row)
        return out

    def related_keywords(
        self,
        seed: str,
        *,
        location_code: int,
        language_code: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        if not seed.strip() or limit <= 0:
            return []
        call = self._post(
            PATH_RELATED_KEYWORDS,
            [
                {
                    "keyword": seed.strip()[:80],
                    "location_code": location_code,
                    "language_code": language_code,
                    "limit": min(limit, 100),
                    "depth": 2,
                }
            ],
        )
        if not call.ok:
            logger.warning("related_keywords failed: %s", call.error)
            return []
        items: list[dict[str, Any]] = []
        for task in call.raw.get("tasks") or []:
            if int(task.get("status_code") or 0) != 20000:
                continue
            for block in task.get("result") or []:
                for item in (block or {}).get("items") or []:
                    if isinstance(item, dict):
                        items.append(item)
        return items

    def serp_organic(
        self,
        keyword: str,
        *,
        location_code: int,
        language_code: str,
        depth: int,
    ) -> list[dict[str, Any]]:
        call = self._post(
            PATH_SERP_ORGANIC,
            [
                {
                    "keyword": keyword[:700],
                    "location_code": location_code,
                    "language_code": language_code,
                    "depth": max(10, min(depth, 100)),
                    "device": "desktop",
                    "os": "windows",
                }
            ],
        )
        if not call.ok:
            logger.warning("serp failed for %r: %s", keyword, call.error)
            return []
        rows: list[dict[str, Any]] = []
        for task in call.raw.get("tasks") or []:
            if int(task.get("status_code") or 0) != 20000:
                continue
            for block in task.get("result") or []:
                for item in (block or {}).get("items") or []:
                    if not isinstance(item, dict):
                        continue
                    # regular endpoint: type organic
                    t = (item.get("type") or "").lower()
                    if t and t not in ("organic", "organic_serp_element"):
                        # some regular responses only return organic already
                        if "url" not in item:
                            continue
                    if item.get("url"):
                        rows.append(item)
        return rows

    def instant_page(self, url: str) -> dict[str, Any] | None:
        call = self._post(PATH_INSTANT_PAGES, [{"url": url, "enable_javascript": False}])
        if not call.ok:
            logger.warning("instant_pages failed: %s", call.error)
            return None
        for task in call.raw.get("tasks") or []:
            if int(task.get("status_code") or 0) != 20000:
                continue
            for block in task.get("result") or []:
                items = (block or {}).get("items") or []
                for item in items:
                    if isinstance(item, dict) and (item.get("resource_type") == "html" or item.get("url")):
                        return item
                if items and isinstance(items[0], dict):
                    return items[0]
        return None

    def backlinks_summary(self, target: str) -> dict[str, Any] | None:
        target_clean = domain_only(target) or target
        call = self._post(
            PATH_BACKLINKS_SUMMARY,
            [
                {
                    "target": target_clean,
                    "include_subdomains": True,
                    "exclude_internal_backlinks": True,
                }
            ],
        )
        if not call.ok:
            logger.warning("backlinks_summary failed for %s: %s", target_clean, call.error)
            return None
        for task in call.raw.get("tasks") or []:
            if int(task.get("status_code") or 0) != 20000:
                continue
            result = task.get("result") or []
            if result and isinstance(result[0], dict):
                return result[0]
        return None

    def referring_domains(self, target: str, limit: int) -> list[dict[str, Any]]:
        target_clean = domain_only(target) or target
        call = self._post(
            PATH_REFERRING_DOMAINS,
            [
                {
                    "target": target_clean,
                    "limit": max(1, min(limit, 1000)),
                    "order_by": ["rank,desc"],
                    "exclude_internal_backlinks": True,
                }
            ],
        )
        if not call.ok:
            logger.warning("referring_domains failed for %s: %s", target_clean, call.error)
            return []
        items: list[dict[str, Any]] = []
        for task in call.raw.get("tasks") or []:
            if int(task.get("status_code") or 0) != 20000:
                continue
            for block in task.get("result") or []:
                for item in (block or {}).get("items") or []:
                    if isinstance(item, dict) and item.get("domain"):
                        items.append(item)
        return items
