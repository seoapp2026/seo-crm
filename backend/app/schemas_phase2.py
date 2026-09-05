from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    draft_id: int | None = None


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


class WpInternalLinkOut(BaseModel):
    to_slug: str | None = None
    anchor: str | None = None


class WpProductOut(BaseModel):
    name: str
    affiliate_url: str | None = None
    image_url: str | None = None


class WpRankMathOut(BaseModel):
    focus_keyword: str | None = None
    title: str | None = None
    description: str | None = None


class WpExportItemOut(BaseModel):
    page_id: int
    title: str
    slug: str
    h1: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    focus_keyword: str | None = None
    secondary_keywords: list[str] = Field(default_factory=list)
    content_html: str | None = None
    content_type: str
    status: str
    content_status: str = "borrador"
    export_ready: bool = False
    niche_name: str
    wp_category: str | None = None
    wp_tags: list[str] = Field(default_factory=list)
    parent_slug: str | None = None
    parent_title: str | None = None
    schema_json: str | None = None
    # W6 completeness keys (PHASE25 plan, section W6) — additive only
    seo_title: str | None = None
    seo_description: str | None = None
    primary_keyword: str | None = None
    intent: str | None = None
    outline: list[dict] = Field(default_factory=list)
    internal_links: list[WpInternalLinkOut] = Field(default_factory=list)
    breadcrumbs: list[str] = Field(default_factory=list)
    products: list[WpProductOut] = Field(default_factory=list)
    rank_math: WpRankMathOut | None = None


class WpExportBundleOut(BaseModel):
    project_name: str
    exported_at: datetime
    pages: list[WpExportItemOut]


class WpPushRequest(BaseModel):
    project_id: int
    page_ids: list[int] | None = None
    post_type: str = "pages"  # "pages" or "posts"
    post_status: str = "draft"  # "draft" or "publish"
    wp_url: str | None = None
    wp_username: str | None = None
    wp_app_password: str | None = None


class WpPushResultItem(BaseModel):
    page_id: int
    title: str
    wp_post_id: int | None = None
    wp_url: str | None = None
    status: str  # "success", "error", "skipped"
    message: str | None = None


class WpPushResponse(BaseModel):
    total_pushed: int
    success_count: int
    error_count: int
    items: list[WpPushResultItem]


class WpTestConnectionRequest(BaseModel):
    project_id: int | None = None
    wp_url: str | None = None
    wp_username: str | None = None
    wp_app_password: str | None = None


class WpTestConnectionResponse(BaseModel):
    success: bool
    site_name: str | None = None
    site_url: str | None = None
    message: str


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
    availability: str | None = None
    opinions: str | None = None
    source_url: str | None = None
    provider: str = "manual"
    external_id: str | None = None
    image_url: str | None = None
    affiliate_url: str | None = None
    rating: str | None = None
    raw_payload_json: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    sku: str | None = None
    features: str | None = None
    price: float | None = None
    currency: str | None = None
    stock_notes: str | None = None
    availability: str | None = None
    opinions: str | None = None
    source_url: str | None = None
    provider: str | None = None
    external_id: str | None = None
    image_url: str | None = None
    affiliate_url: str | None = None
    rating: str | None = None
    raw_payload_json: str | None = None


class ProductOut(OrmBase):
    id: int
    project_id: int
    name: str
    brand: str | None = None
    sku: str | None = None
    features: str | None = None
    price: float | None = None
    currency: str = "EUR"
    stock_notes: str | None = None
    availability: str | None = None
    opinions: str | None = None
    source_url: str | None = None
    provider: str = "manual"
    external_id: str | None = None
    image_url: str | None = None
    affiliate_url: str | None = None
    rating: str | None = None
    raw_payload_json: str | None = None
    last_synced_at: datetime | None = None
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


# --- Workstream 7 (W7) — Competitor Comparison & Product Entity ---

class ProductItemIn(BaseModel):
    name: str
    brand: str | None = None
    model: str | None = None
    badge: str | None = None  # e.g., "Nuestra Elección ⭐", "Mejor Calidad-Precio", "Opción Económica"
    price: str | None = None  # e.g., "299,00 €"
    rating: str | None = None  # e.g., "4.8/5"
    image_url: str | None = None
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    specs: dict[str, str] = Field(default_factory=dict)
    cta_text: str = "Ver Mejor Precio"
    affiliate_url: str | None = None


class ComparisonTableGenerateRequest(BaseModel):
    products: list[ProductItemIn]
    table_title: str | None = "Tabla Comparativa de los Mejores Modelos"
    show_badges: bool = True
    show_pros_cons: bool = True
    show_ratings: bool = True
    target_page_id: int | None = None


class ComparisonTableGenerateResponse(BaseModel):
    html_table: str
    preview_cards_html: str
    spec_columns: list[str]
    products_count: int


class CompetitorHeadingItem(BaseModel):
    level: int
    tag: str
    text: str


class CompetitorScrapeRequest(BaseModel):
    url: str | None = None
    raw_html: str | None = None
    project_id: int
    niche_id: int | None = None


class CompetitorScrapeResponse(BaseModel):
    title: str
    meta_description: str | None = None
    h1: str | None = None
    headings: list[CompetitorHeadingItem] = Field(default_factory=list)
    word_count: int = 0
    detected_products: list[ProductItemIn] = Field(default_factory=list)
    detected_keywords: list[str] = Field(default_factory=list)
    has_comparison_table: bool = False
    extracted_summary: str = ""


# --- Workstream 8 (W8) — Rank Math SEO Import / Export & Bulk Sync ---

class RankMathExportItemOut(BaseModel):
    page_id: int
    title: str
    slug: str
    rank_math_title: str
    rank_math_description: str
    rank_math_focus_keyword: str
    rank_math_canonical_url: str | None = None
    rank_math_robots_meta: str = "index, follow"
    rank_math_schema_type: str = "Article"


class RankMathImportRequest(BaseModel):
    project_id: int
    csv_content: str


class RankMathImportResponse(BaseModel):
    total_rows: int
    updated_count: int
    skipped_count: int
    error_count: int
    messages: list[str] = Field(default_factory=list)


class RankMathBulkSyncRequest(BaseModel):
    project_id: int
    page_ids: list[int] | None = None
    overwrite_existing: bool = False
    title_suffix: str | None = " | Especialistas"


class RankMathBulkSyncResponse(BaseModel):
    analyzed_count: int
    updated_titles_count: int
    updated_descriptions_count: int


# --- Workstream 9 (W9) — Bulk Page Edit & Grid Actions ---

class PageBulkUpdateItem(BaseModel):
    id: int
    title: str | None = None
    h1: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    type: PageType | None = None
    state: str | None = None
    parent_page_id: int | None = None
    export_ready: bool | None = None
    wp_category: str | None = None


class PageBulkUpdateRequest(BaseModel):
    project_id: int
    pages: list[PageBulkUpdateItem]


class PageBulkUpdateResponse(BaseModel):
    updated_count: int
    updated_ids: list[int]


# --- Official Product Providers (Amazon PA-API & eBay Browse API) ---

class ProviderStatusItem(BaseModel):
    provider: str
    name: str
    configured: bool
    marketplace: str
    using_stub: bool
    partner_tag: str | None = None
    campaign_id: str | None = None


class ProductProviderStatusOut(BaseModel):
    providers: list[ProviderStatusItem]


class ProductSearchItemOut(BaseModel):
    provider: str  # "amazon" | "ebay"
    external_id: str  # ASIN or eBay Item ID
    name: str
    brand: str | None = None
    price: float | None = None
    currency: str = "EUR"
    image_url: str | None = None
    rating: str | None = None
    affiliate_url: str | None = None
    features: str | None = None
    availability: str | None = None
    is_prime: bool = False
    condition: str | None = None


class ProductSearchRequest(BaseModel):
    provider: str = "all"  # "all" | "amazon" | "ebay"
    query: str
    limit: int = 10
    project_id: int | None = None


class ProductSearchResponse(BaseModel):
    query: str
    provider_used: str
    total_found: int
    is_stub: bool
    results: list[ProductSearchItemOut]


class ProductImportRequest(BaseModel):
    project_id: int
    provider: str  # "amazon" | "ebay" | "manual"
    external_id: str | None = None
    name: str
    brand: str | None = None
    price: float | None = None
    currency: str = "EUR"
    image_url: str | None = None
    rating: str | None = None
    affiliate_url: str | None = None
    features: str | None = None
    opinions: str | None = None
    stock_notes: str | None = None
    availability: str | None = None


class ProductImportResponse(BaseModel):
    imported: bool
    message: str
    product: ProductOut


# --- Light Site Structure Importer (CSV / JSON) ---

class StructureImportItem(BaseModel):
    title: str
    slug: str
    niche_name: str
    parent_slug: str | None = None
    page_type: PageType = PageType.TSG
    h1: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    focus_keyword: str | None = None


class StructureImportRequest(BaseModel):
    project_id: int | None = None
    project_name: str | None = None
    csv_content: str | None = None
    json_content: str | None = None
    items: list[StructureImportItem] | None = None

    @model_validator(mode="after")
    def _validate_single_source(self):
        has_csv = bool(self.csv_content and self.csv_content.strip())
        has_json = bool(self.json_content and self.json_content.strip())
        if has_csv and has_json:
            raise ValueError(
                "Proporciona solo uno de csv_content o json_content, no ambos."
            )
        if not has_csv and not has_json and not self.items:
            raise ValueError(
                "Debes proporcionar csv_content, json_content o items para importar."
            )
        return self


class StructureImportResponse(BaseModel):
    project_id: int
    project_name: str
    niches_created: int
    pages_created: int
    urls_created: int
    silos_linked: int
    keywords_linked: int
    errors: list[str] = Field(default_factory=list)