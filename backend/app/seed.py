from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import (
    IndexedStatus,
    Intent,
    InternalLink,
    Keyword,
    Monetization,
    Niche,
    NicheState,
    Note,
    Page,
    PageState,
    PageType,
    Project,
    Url,
)


def seed_if_empty():
    db = SessionLocal()
    try:
        if db.query(Project).count() > 0:
            return

        p1 = Project(name="Afiliación Hogar", description="Webs de afiliación sobre productos para el hogar")
        p2 = Project(name="Proyectos Locales", description="Negocios locales y servicios")
        db.add_all([p1, p2])
        db.flush()

        n1 = Niche(
            project_id=p1.id,
            name="Cafeteras",
            topic="Cafeteras domésticas y de oficina",
            state=NicheState.escalando,
            monetization=Monetization.afiliacion,
            notes="Nicho principal, buena conversión en comparativas.",
        )
        n2 = Niche(
            project_id=p1.id,
            name="Aspiradoras",
            topic="Aspiradoras y robots de limpieza",
            state=NicheState.senales,
            monetization=Monetization.afiliacion,
            notes="Primeras impresiones en Search Console.",
        )
        n3 = Niche(
            project_id=p2.id,
            name="Fontaneros Madrid",
            topic="Servicios de fontanería en Madrid",
            state=NicheState.nuevo,
            monetization=Monetization.leads,
        )
        db.add_all([n1, n2, n3])
        db.flush()

        pg1 = Page(
            niche_id=n1.id,
            project_id=p1.id,
            title="Mejores cafeteras de oficina 2026",
            type=PageType.TSR,
            state=PageState.publicado,
            objective="Comparativa para captar tráfico transaccional",
        )
        pg2 = Page(
            niche_id=n1.id,
            project_id=p1.id,
            title="Guía completa: cómo elegir una cafetera",
            type=PageType.TSG,
            state=PageState.borrador,
            objective="Guía pilar del cluster de cafeteras",
        )
        pg3 = Page(
            niche_id=n2.id,
            project_id=p1.id,
            title="Reseña Roomba J7+",
            type=PageType.TSA,
            state=PageState.en_revision,
            objective="Reseña de producto con enlace de afiliado",
        )
        db.add_all([pg1, pg2, pg3])
        db.flush()

        db.add_all(
            [
                Keyword(
                    page_id=pg1.id,
                    niche_id=n1.id,
                    project_id=p1.id,
                    term="mejores cafeteras de oficina",
                    intent=Intent.transaccional,
                    note="KW principal",
                ),
                Keyword(
                    page_id=pg1.id,
                    niche_id=n1.id,
                    project_id=p1.id,
                    term="cafetera para oficina pequeña",
                    intent=Intent.comercial,
                ),
                Keyword(
                    page_id=pg2.id,
                    niche_id=n1.id,
                    project_id=p1.id,
                    term="cómo elegir cafetera",
                    intent=Intent.informacional,
                ),
                Keyword(
                    page_id=pg3.id,
                    niche_id=n2.id,
                    project_id=p1.id,
                    term="roomba j7+ opiniones",
                    intent=Intent.comercial,
                ),
            ]
        )

        db.add_all(
            [
                Url(
                    page_id=pg1.id,
                    niche_id=n1.id,
                    project_id=p1.id,
                    slug="/mejores-cafeteras-oficina",
                    indexed=IndexedStatus.indexada,
                    status="publicado",
                ),
                Url(
                    page_id=pg3.id,
                    niche_id=n2.id,
                    project_id=p1.id,
                    slug="/resena-roomba-j7-plus",
                    indexed=IndexedStatus.pendiente,
                    status="borrador",
                ),
            ]
        )

        db.add(
            Note(
                project_id=p1.id,
                title="Estrategia Q1",
                body="Reforzar el cluster de cafeteras antes de atacar aspiradoras a fondo.",
            )
        )

        db.add(
            InternalLink(
                project_id=p1.id,
                from_page_id=pg2.id,
                to_page_id=pg1.id,
                anchor="mejores cafeteras de oficina",
            )
        )

        db.commit()
    finally:
        db.close()