from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import (
    DraftStatus,
    IndexedStatus,
    Intent,
    Monetization,
    NicheState,
    PageState,
    PageType,
)


class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Projects ---

class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    gsc_site_url: str | None = None
    ga4_property_id: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    gsc_site_url: str | None = None
    ga4_property_id: str | None = None


class ProjectOut(OrmBase):
    id: int
    name: str
    description: str | None
    gsc_site_url: str | None
    ga4_property_id: str | None
    created_at: datetime


# --- Niches ---

class NicheCreate(BaseModel):
    project_id: int
    name: str
    topic: str | None = None
    state: NicheState = NicheState.nuevo
    monetization: Monetization = Monetization.afiliacion
    notes: str | None = None


class NicheUpdate(BaseModel):
    name: str | None = None
    topic: str | None = None
    state: NicheState | None = None
    monetization: Monetization | None = None
    notes: str | None = None


class NicheOut(OrmBase):
    id: int
    project_id: int
    name: str
    topic: str | None
    state: NicheState
    monetization: Monetization
    notes: str | None
    created_at: datetime


# --- Pages ---

class PageCreate(BaseModel):
    niche_id: int
    project_id: int
    title: str
    type: PageType
    state: PageState = PageState.borrador
    objective: str | None = None


class PageUpdate(BaseModel):
    title: str | None = None
    type: PageType | None = None
    state: PageState | None = None
    objective: str | None = None
    niche_id: int | None = None


class PageOut(OrmBase):
    id: int
    niche_id: int
    project_id: int
    title: str
    type: PageType
    state: PageState
    objective: str | None
    created_at: datetime


# --- Keywords ---

class KeywordCreate(BaseModel):
    page_id: int
    niche_id: int
    project_id: int
    term: str
    intent: Intent = Intent.informacional
    note: str | None = None


class KeywordUpdate(BaseModel):
    term: str | None = None
    intent: Intent | None = None
    note: str | None = None
    page_id: int | None = None


class KeywordOut(OrmBase):
    id: int
    page_id: int
    niche_id: int
    project_id: int
    term: str
    intent: Intent
    note: str | None
    created_at: datetime
    cannibalized: bool = False


# --- URLs ---

class UrlCreate(BaseModel):
    page_id: int
    niche_id: int
    project_id: int
    slug: str
    indexed: IndexedStatus = IndexedStatus.pendiente
    status: str | None = None


class UrlUpdate(BaseModel):
    slug: str | None = None
    indexed: IndexedStatus | None = None
    status: str | None = None
    page_id: int | None = None


class UrlOut(OrmBase):
    id: int
    page_id: int
    niche_id: int
    project_id: int
    slug: str
    indexed: IndexedStatus
    status: str | None
    created_at: datetime


# --- Internal links ---

class InternalLinkCreate(BaseModel):
    project_id: int
    from_page_id: int
    to_page_id: int
    anchor: str | None = None


class InternalLinkUpdate(BaseModel):
    from_page_id: int | None = None
    to_page_id: int | None = None
    anchor: str | None = None


class InternalLinkOut(OrmBase):
    id: int
    project_id: int
    from_page_id: int
    to_page_id: int
    anchor: str | None
    created_at: datetime


# --- Notes ---

class NoteCreate(BaseModel):
    project_id: int
    title: str
    body: str | None = None


class NoteUpdate(BaseModel):
    title: str | None = None
    body: str | None = None


class NoteOut(OrmBase):
    id: int
    project_id: int
    title: str
    body: str | None
    created_at: datetime


# --- Content drafts ---

class ContentDraftOut(OrmBase):
    id: int
    page_id: int
    draft_body: str | None
    meta_title: str | None
    meta_description: str | None
    model_used: str | None
    status: DraftStatus
    created_at: datetime


class GenerateContentRequest(BaseModel):
    page_id: int
    model: str = "gpt-4o-mini"


class GenerateContentResponse(BaseModel):
    draft: ContentDraftOut
    rendered: str


# --- Dashboard ---

class NicheStateCount(BaseModel):
    state: str
    count: int


class DashboardStats(BaseModel):
    projects: int
    niches: int
    pages: int
    keywords: int
    urls: int
    published_pages: int
    draft_pages: int
    scaling_niches: int
    niche_by_state: list[NicheStateCount]
    recent_pages: list[PageOut]
    orphan_pages: list[PageOut]
    cannibalized_terms: list[str]