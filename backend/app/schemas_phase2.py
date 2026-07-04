from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import AdsCompetition, AssistantSlug, GoogleServiceType, SyncJobStatus, SyncJobType


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
    slug: AssistantSlug
    name: str
    description: str
    system_prompt: str
    model_default: str
    updated_at: datetime


class AiPromptUpdate(BaseModel):
    description: str | None = None
    system_prompt: str | None = None
    model_default: str | None = None


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
    assistant: AssistantSlug
    project_id: int
    page_id: int | None = None
    niche_id: int | None = None
    competitor_id: int | None = None
    extra_context: str | None = None
    model: str | None = None


class AssistantRunResponse(BaseModel):
    assistant: AssistantSlug
    rendered: str
    model_used: str
    used_metrics: bool


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