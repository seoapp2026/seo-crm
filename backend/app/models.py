import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
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