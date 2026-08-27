from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models import (
    AdsCompetition,
    AssistantSlug,
    GoogleServiceType,
    PageType,
    ResearchJobStatus,
    SyncJobStatus,
    SyncJobType,
)


class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class GoogleAuthOut(OrmBase):
    id: int
    project_id: int
    service: GoogleServiceType
    account_email: str | None
    property_id: str | None
    property_label: str | None
    connected: bool = False
    last_sync_at: datetime | None
    token_expires_at: datetime | None


class GoogleConnectRequest(BaseModel):
    project_id: int
    service: GoogleServiceType


class GoogleConnectResponse(BaseModel):
    auth_url: str | None = None


class GscSiteOut(BaseModel):
    site_url: str
    permission_level: str
    auth: GoogleAuthOut | None = None


class GscDataOut(OrmBase):
    id: int
    project_id: int
    url_id: int | None
    page_url: str
    date: str
    impressions: int
    clicks: int
    ctr: float
    position: float


class AnalyticsDataOut(OrmBase):
    id: int
    project_id: int
    page_path: str
    date: str
    sessions: int
    users: int
    bounce_rate: float
    avg_engagement_time: float


class AdsKeywordOut(OrmBase):
    id: int
    project_id: int
    term: str
    volume: int
    competition: AdsCompetition
    cpc_low: float
    cpc_high: float
    synced_at: datetime


class CompetitorCreate(BaseModel):
    project_id: int
    domain: str
    niche_id: int | None = None
    notes: str | None = None


class CompetitorUpdate(BaseModel):
    domain: str | None = None
    niche_id: int | None = None
    notes: str | None = None


class CompetitorOut(OrmBase):
    id: int
    project_id: int
    domain: str
    niche_id: int | None
    notes: str | None
    pages_tracked: int
    created_at: datetime


class AiPromptOut(OrmBase):
    id: int
    slug: str
    name: str
    description: str
    system_prompt: str
    model_default: str
    sort_order: int = 0
    is_system: bool = False
    project_id: int | None = None
    updated_at: datetime


class AiPromptCreate(BaseModel):
    slug: str
    name: str
    description: str = ""
    system_prompt: str
    model_default: str = "gpt-4o-mini"
    sort_order: int = 0
    is_system: bool = False
    project_id: int | None = None


class AiPromptUpdate(BaseModel):
    slug: str | None = None
    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    model_default: str | None = None
    sort_order: int | None = None
    project_id: int | None = None


class AiPromptReorderItem(BaseModel):
    id: int
    sort_order: int


class SyncJobOut(OrmBase):
    id: int
    project_id: int
    job_type: SyncJobType
    schedule: str
    schedule_cron: str
    status: SyncJobStatus
    last_run_at: datetime | None
    next_run_at: datetime | None
    last_error: str | None
    records_synced: int
    enabled: bool


class SyncJobUpdate(BaseModel):
    enabled: bool | None = None


class PagePerformanceOut(BaseModel):
    page_id: int
    page_title: str
    page_url: str
    impressions_28d: int
    clicks_28d: int
    ctr_28d: float
    position_28d: float
    sessions_28d: int
    bounce_rate_28d: float
    trend: str
    trend_pct: float
    status: str
    sparkline_clicks: list[int]


class PerformanceSummaryOut(BaseModel):
    winning: int
    declining: int
    needs_work: int
    stable: int
    total_clicks_28d: int
    total_impressions_28d: int
    total_sessions_28d: int
    avg_position_28d: float
    pages: list[PagePerformanceOut]


class AssistantRunRequest(BaseModel):
    assistant: str | None = None
    prompt_id: int | None = None
    prompt_slug: str | None = None
    project_id: int
    page_id: int | None = None
    niche_id: int | None = None
    competitor_id: int | None = None
    extra_context: str | None = None
    model: str | None = None


class AssistantRunResponse(BaseModel):
    assistant: str
    prompt_id: int | None = None
    prompt_name: str | None = None
    rendered: str
    model_used: str
    used_metrics: bool
    context_used: dict[str, Any] | None = None


class ContextPreviewRequest(BaseModel):
    prompt_id: int | None = None
    prompt_slug: str | None = None
    assistant: str | None = None
    project_id: int
    page_id: int | None = None
    niche_id: int | None = None
    competitor_id: int | None = None
    extra_context: str | None = None
    model: str | None = None


class ContextPreviewResponse(BaseModel):
    prompt_id: int | None = None
    prompt_name: str
    prompt_slug: str
    model: str
    system_prompt: str
    user_prompt: str
    full_prompt_text: str
    word_count: int
    estimated_tokens: int
    resolved_entities: dict[str, Any]


class WpExportItemOut(BaseModel):
    page_id: int
    title: str
    slug: str
    meta_title: str
    meta_description: str
    content_type: str
    h1: str
    status: str
    niche_name: str


class WpExportBundleOut(BaseModel):
    project_name: str
    exported_at: datetime
    pages: list[WpExportItemOut]


# ── Option 2: products + research ───────────────────────────────────────────


class ProductCreate(BaseModel):
    project_id: int
    name: str
    brand: str | None = None
    sku: str | None = None
    features: str | None = None
    price: float | None = None
    currency: str = "EUR"
    stock_notes: str | None = None
    opinions: str | None = None
    source_url: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    sku: str | None = None
    features: str | None = None
    price: float | None = None
    currency: str | None = None
    stock_notes: str | None = None
    opinions: str | None = None
    source_url: str | None = None


class ProductOut(OrmBase):
    id: int
    project_id: int
    name: str
    brand: str | None
    sku: str | None
    features: str | None
    price: float | None
    currency: str
    stock_notes: str | None
    opinions: str | None
    source_url: str | None
    created_at: datetime
    updated_at: datetime


class ResearchJobCreate(BaseModel):
    project_id: int
    site_url: str | None = None
    competitor_urls: list[str] = Field(default_factory=list)
    seed_keywords: list[str] = Field(default_factory=list)
    country: str = "es"
    language: str = "es"
    page_type: PageType = PageType.TSG


class ResearchKeywordOut(OrmBase):
    id: int
    term: str
    volume: int
    intent: str | None
    cpc: float
    competition: str | None
    source: str


class ResearchSerpRowOut(OrmBase):
    id: int
    query: str
    position: int
    url: str
    title: str | None
    domain: str | None


class ResearchPageSnapshotOut(OrmBase):
    id: int
    url: str
    title: str | None
    meta_description: str | None
    h1_json: str
    h2_json: str
    h3_json: str
    links_json: str


class ResearchBacklinkSummaryOut(OrmBase):
    id: int
    domain: str
    is_target: bool
    backlinks_count: int
    referring_domains: int
    sample_json: str


class ResearchLinkGapOut(OrmBase):
    id: int
    domain: str
    linked_to_competitor: str
    note: str | None


class ResearchOpportunityOut(OrmBase):
    id: int
    kind: str
    title: str
    detail: str | None
    priority: int


class ResearchJobOut(OrmBase):
    id: int
    project_id: int
    site_url: str | None
    competitor_urls: list[str] = Field(default_factory=list)
    seed_keywords: list[str] = Field(default_factory=list)
    country: str
    language: str
    page_type: PageType
    status: ResearchJobStatus
    error_message: str | None
    estimated_cost_eur: float
    actual_cost_eur: float
    ai_report: str | None
    used_stub: bool
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime


class ResearchJobDetailOut(ResearchJobOut):
    keywords: list[ResearchKeywordOut] = Field(default_factory=list)
    serp_rows: list[ResearchSerpRowOut] = Field(default_factory=list)
    page_snapshots: list[ResearchPageSnapshotOut] = Field(default_factory=list)
    backlink_summaries: list[ResearchBacklinkSummaryOut] = Field(default_factory=list)
    link_gaps: list[ResearchLinkGapOut] = Field(default_factory=list)
    opportunities: list[ResearchOpportunityOut] = Field(default_factory=list)


class ResearchCapsOut(BaseModel):
    max_competitors: int
    max_seed_keywords: int
    max_keywords_stored: int
    max_serp_queries: int
    max_serp_results_per_query: int
    max_page_snapshots: int
    max_backlinks_per_domain: int
    max_referring_domains: int
    max_link_gaps: int
    soft_monthly_eur: float
    hard_monthly_eur: float
    credentials_configured: bool
    force_stub: bool


class ResearchBudgetOut(BaseModel):
    year_month: str
    runs_count: int
    spend_eur: float
    soft_monthly_eur: float
    hard_monthly_eur: float
    soft_warning: bool
    hard_blocked: bool