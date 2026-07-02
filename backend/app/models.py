import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class NicheState(str, enum.Enum):
    nuevo = "nuevo"
    prueba = "prueba"
    senales = "señales"
    escalando = "escalando"
    dormido = "dormido"


class Monetization(str, enum.Enum):
    afiliacion = "afiliacion"
    adsense = "adsense"
    mixto = "mixto"
    leads = "leads"


class PageType(str, enum.Enum):
    TSG = "TSG"
    TSR = "TSR"
    TSA = "TSA"


class PageState(str, enum.Enum):
    borrador = "borrador"
    en_revision = "en_revision"
    publicado = "publicado"
    optimizado = "optimizado"


class Intent(str, enum.Enum):
    informacional = "informacional"
    comercial = "comercial"
    transaccional = "transaccional"


class IndexedStatus(str, enum.Enum):
    indexada = "indexada"
    pendiente = "pendiente"
    noindex = "noindex"


class DraftStatus(str, enum.Enum):
    borrador = "borrador"
    revisado = "revisado"
    usado = "usado"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    gsc_site_url: Mapped[str | None] = mapped_column(Text)
    ga4_property_id: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    niches: Mapped[list["Niche"]] = relationship(back_populates="project")
    pages: Mapped[list["Page"]] = relationship(back_populates="project")
    keywords: Mapped[list["Keyword"]] = relationship(back_populates="project")
    urls: Mapped[list["Url"]] = relationship(back_populates="project")
    internal_links: Mapped[list["InternalLink"]] = relationship(back_populates="project")
    notes: Mapped[list["Note"]] = relationship(back_populates="project")


class Niche(Base):
    __tablename__ = "niches"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    topic: Mapped[str | None] = mapped_column(Text)
    state: Mapped[NicheState] = mapped_column(Enum(NicheState), default=NicheState.nuevo)
    monetization: Mapped[Monetization] = mapped_column(Enum(Monetization), default=Monetization.afiliacion)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="niches")
    pages: Mapped[list["Page"]] = relationship(back_populates="niche")
    keywords: Mapped[list["Keyword"]] = relationship(back_populates="niche")
    urls: Mapped[list["Url"]] = relationship(back_populates="niche")


class Page(Base):
    __tablename__ = "pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    niche_id: Mapped[int] = mapped_column(ForeignKey("niches.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[PageType] = mapped_column(Enum(PageType), nullable=False)
    state: Mapped[PageState] = mapped_column(Enum(PageState), default=PageState.borrador)
    objective: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    niche: Mapped["Niche"] = relationship(back_populates="pages")
    project: Mapped["Project"] = relationship(back_populates="pages")
    keywords: Mapped[list["Keyword"]] = relationship(back_populates="page")
    urls: Mapped[list["Url"]] = relationship(back_populates="page")
    content_drafts: Mapped[list["ContentDraft"]] = relationship(back_populates="page")
    outgoing_links: Mapped[list["InternalLink"]] = relationship(
        back_populates="from_page", foreign_keys="InternalLink.from_page_id"
    )
    incoming_links: Mapped[list["InternalLink"]] = relationship(
        back_populates="to_page", foreign_keys="InternalLink.to_page_id"
    )


class Keyword(Base):
    __tablename__ = "keywords"

    id: Mapped[int] = mapped_column(primary_key=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    niche_id: Mapped[int] = mapped_column(ForeignKey("niches.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    term: Mapped[str] = mapped_column(Text, nullable=False)
    intent: Mapped[Intent] = mapped_column(Enum(Intent), default=Intent.informacional)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    page: Mapped["Page"] = relationship(back_populates="keywords")
    niche: Mapped["Niche"] = relationship(back_populates="keywords")
    project: Mapped["Project"] = relationship(back_populates="keywords")


class Url(Base):
    __tablename__ = "urls"

    id: Mapped[int] = mapped_column(primary_key=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    niche_id: Mapped[int] = mapped_column(ForeignKey("niches.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    indexed: Mapped[IndexedStatus] = mapped_column(Enum(IndexedStatus), default=IndexedStatus.pendiente)
    status: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    page: Mapped["Page"] = relationship(back_populates="urls")
    niche: Mapped["Niche"] = relationship(back_populates="urls")
    project: Mapped["Project"] = relationship(back_populates="urls")


class InternalLink(Base):
    __tablename__ = "internal_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    from_page_id: Mapped[int] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    to_page_id: Mapped[int] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    anchor: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="internal_links")
    from_page: Mapped["Page"] = relationship(back_populates="outgoing_links", foreign_keys=[from_page_id])
    to_page: Mapped["Page"] = relationship(back_populates="incoming_links", foreign_keys=[to_page_id])


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="notes")


class ContentDraft(Base):
    __tablename__ = "content_drafts"

    id: Mapped[int] = mapped_column(primary_key=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    draft_body: Mapped[str | None] = mapped_column(Text)
    meta_title: Mapped[str | None] = mapped_column(Text)
    meta_description: Mapped[str | None] = mapped_column(Text)
    model_used: Mapped[str | None] = mapped_column(Text)
    status: Mapped[DraftStatus] = mapped_column(Enum(DraftStatus), default=DraftStatus.borrador)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    page: Mapped["Page"] = relationship(back_populates="content_drafts")


# --- Phase 2 ---


class GoogleServiceType(str, enum.Enum):
    gsc = "gsc"
    ga4 = "ga4"
    ads = "ads"


class SyncJobStatus(str, enum.Enum):
    idle = "idle"
    running = "running"
    success = "success"
    error = "error"


class SyncJobType(str, enum.Enum):
    gsc = "gsc"
    ga4 = "ga4"
    ads = "ads"


class AdsCompetition(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class AssistantSlug(str, enum.Enum):
    seo_architect = "seo_architect"
    keyword_classifier = "keyword_classifier"
    content_generator = "content_generator"
    competitor_analyst = "competitor_analyst"
    continuous_optimizer = "continuous_optimizer"


class GoogleAuth(Base):
    __tablename__ = "google_auth"
    __table_args__ = (UniqueConstraint("project_id", "service", name="uq_google_auth_project_service"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    service: Mapped[GoogleServiceType] = mapped_column(Enum(GoogleServiceType), nullable=False)
    account_email: Mapped[str | None] = mapped_column(Text)
    property_id: Mapped[str | None] = mapped_column(Text)
    property_label: Mapped[str | None] = mapped_column(Text)
    access_token: Mapped[str | None] = mapped_column(Text)
    refresh_token: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GscData(Base):
    __tablename__ = "gsc_data"
    __table_args__ = (UniqueConstraint("project_id", "page_url", "date", name="uq_gsc_project_url_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    url_id: Mapped[int | None] = mapped_column(ForeignKey("urls.id", ondelete="SET NULL"))
    page_url: Mapped[str] = mapped_column(Text, nullable=False)
    date: Mapped[str] = mapped_column(Text, nullable=False)
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)
    ctr: Mapped[float] = mapped_column(Float, default=0.0)
    position: Mapped[float] = mapped_column(Float, default=0.0)


class AnalyticsData(Base):
    __tablename__ = "analytics_data"
    __table_args__ = (UniqueConstraint("project_id", "page_path", "date", name="uq_analytics_project_path_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    page_path: Mapped[str] = mapped_column(Text, nullable=False)
    date: Mapped[str] = mapped_column(Text, nullable=False)
    sessions: Mapped[int] = mapped_column(Integer, default=0)
    users: Mapped[int] = mapped_column(Integer, default=0)
    bounce_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_engagement_time: Mapped[float] = mapped_column(Float, default=0.0)


class AdsKeyword(Base):
    __tablename__ = "ads_keywords"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    term: Mapped[str] = mapped_column(Text, nullable=False)
    volume: Mapped[int] = mapped_column(Integer, default=0)
    competition: Mapped[AdsCompetition] = mapped_column(Enum(AdsCompetition), default=AdsCompetition.MEDIUM)
    cpc_low: Mapped[float] = mapped_column(Float, default=0.0)
    cpc_high: Mapped[float] = mapped_column(Float, default=0.0)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Competitor(Base):
    __tablename__ = "competitors"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    domain: Mapped[str] = mapped_column(Text, nullable=False)
    niche_id: Mapped[int | None] = mapped_column(ForeignKey("niches.id", ondelete="SET NULL"))
    notes: Mapped[str | None] = mapped_column(Text)
    pages_tracked: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiPrompt(Base):
    __tablename__ = "ai_prompts"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[AssistantSlug] = mapped_column(Enum(AssistantSlug), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    model_default: Mapped[str] = mapped_column(Text, default="gpt-4o-mini")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SyncJob(Base):
    __tablename__ = "sync_jobs"
    __table_args__ = (UniqueConstraint("project_id", "job_type", name="uq_sync_job_project_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    job_type: Mapped[SyncJobType] = mapped_column(Enum(SyncJobType), nullable=False)
    schedule: Mapped[str] = mapped_column(Text, nullable=False)
    schedule_cron: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[SyncJobStatus] = mapped_column(Enum(SyncJobStatus), default=SyncJobStatus.idle)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    records_synced: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)