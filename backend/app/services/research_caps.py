"""Option 2 hard caps — enforced server-side for cost control."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

from app.config import settings


@dataclass(frozen=True)
class ResearchCaps:
    max_competitors: int
    max_seed_keywords: int
    max_keywords_stored: int
    max_serp_queries: int
    max_serp_results_per_query: int
    max_page_snapshots: int
    max_backlinks_per_domain: int
    max_referring_domains: int
    max_link_gaps: int
    max_concurrent_per_project: int
    max_concurrent_global: int
    soft_monthly_eur: float
    hard_monthly_eur: float  # 0 = disabled


def get_caps() -> ResearchCaps:
    return ResearchCaps(
        max_competitors=max(1, int(settings.dataforseo_max_competitors)),
        max_seed_keywords=max(1, int(settings.dataforseo_max_seed_keywords)),
        max_keywords_stored=max(1, int(settings.dataforseo_max_keywords_stored)),
        max_serp_queries=max(1, int(settings.dataforseo_max_serp_queries)),
        max_serp_results_per_query=max(1, int(settings.dataforseo_max_serp_results)),
        max_page_snapshots=1,
        max_backlinks_per_domain=max(1, int(settings.dataforseo_max_backlinks_per_domain)),
        max_referring_domains=max(1, int(settings.dataforseo_max_referring_domains)),
        max_link_gaps=max(1, int(settings.dataforseo_max_link_gaps)),
        max_concurrent_per_project=1,
        max_concurrent_global=max(1, int(settings.dataforseo_max_concurrent_global)),
        soft_monthly_eur=float(settings.dataforseo_soft_monthly_eur or 0),
        hard_monthly_eur=float(settings.dataforseo_hard_monthly_eur or 0),
    )


def normalize_url_list(raw: list[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in raw or []:
        u = (item or "").strip()
        if not u:
            continue
        if not u.startswith("http://") and not u.startswith("https://"):
            u = f"https://{u}"
        key = u.rstrip("/").casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(u.rstrip("/"))
    return out


def normalize_keywords(raw: list[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in raw or []:
        t = " ".join((item or "").split()).strip()
        if not t:
            continue
        key = t.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(t)
    return out


def domain_from_url(url: str | None) -> str | None:
    if not url:
        return None
    try:
        raw = url if "://" in url else f"https://{url}"
        host = urlparse(raw).hostname or ""
        return host.lower().removeprefix("www.") or None
    except Exception:
        return None


def estimate_cost_eur(
    *,
    seed_count: int,
    competitor_count: int,
    has_site: bool,
    caps: ResearchCaps | None = None,
) -> float:
    """Rough band estimate for UI / budget checks (not vendor invoice)."""
    caps = caps or get_caps()
    base = 1.5
    base += min(seed_count, caps.max_seed_keywords) * 0.12
    base += competitor_count * 1.2
    if has_site:
        base += 0.8
    # SERP pack
    serp_n = min(max(seed_count, 1), caps.max_serp_queries)
    base += serp_n * 0.25
    return round(min(base, 40.0), 2)


class CapViolation(ValueError):
    pass


def validate_analysis_inputs(
    *,
    site_url: str | None,
    competitor_urls: list[str],
    seed_keywords: list[str],
) -> tuple[str | None, list[str], list[str]]:
    caps = get_caps()
    comps = normalize_url_list(competitor_urls)
    seeds = normalize_keywords(seed_keywords)
    site = None
    if site_url and site_url.strip():
        sites = normalize_url_list([site_url])
        site = sites[0] if sites else None

    if len(comps) > caps.max_competitors:
        raise CapViolation(
            f"Máximo {caps.max_competitors} competidores por análisis (recibidos {len(comps)})."
        )
    if len(seeds) > caps.max_seed_keywords:
        raise CapViolation(
            f"Máximo {caps.max_seed_keywords} keywords semilla (recibidas {len(seeds)})."
        )
    if not seeds and not site and not comps:
        raise CapViolation(
            "Indica al menos keywords semilla, URL del sitio o un competidor."
        )
    return site, comps, seeds
