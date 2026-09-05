import json
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import (
    ContentDraft,
    InternalLink,
    Keyword,
    Niche,
    Page,
    Product,
    Project,
    Url,
)
from app.routers.wordpress import _build_export_items
from app.seed_phase2 import seed_phase2


class TestExportAudit(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = self.Session()
        seed_phase2(self.db)

        self.project = Project(name="Tienda Camping", description="Web de montaña")
        self.db.add(self.project)
        self.db.commit()

        self.niche = Niche(project_id=self.project.id, name="Tiendas Ultraligeras")
        self.db.add(self.niche)
        self.db.commit()

        # Fully-populated pillar page (ready, no warnings thanks to its outgoing link)
        self.pillar = Page(
            project_id=self.project.id,
            niche_id=self.niche.id,
            title="Mejores Tiendas Ultraligeras",
            type="TSG",
            state="publicado",
            breadcrumb_label="Tiendas Ultraligeras",
            h1="Guía de Tiendas Ultraligeras 2026",
            outline_json=json.dumps([{"tag": "h2", "text": "Comparativa"}]),
            seo_title="Mejores Tiendas Ultraligeras (2026)",
            seo_description="Comparativa definitiva de tiendas ligeras.",
            content_html="<article><h1>Guía</h1><p>Contenido</p></article>",
            content_status="listo_export",
            export_ready=True,
        )
        self.db.add(self.pillar)
        self.db.commit()
        self.db.add(Url(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.pillar.id,
            slug="/tiendas-ultraligeras",
        ))
        self.db.add(Keyword(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.pillar.id,
            term="mejores tiendas ultraligeras",
            intent="comercial",
            is_primary=True,
        ))
        self.db.add(Keyword(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.pillar.id,
            term="tiendas ultraligeras baratas",
            intent="transaccional",
            is_primary=False,
        ))
        self.db.commit()

        # Fully-populated child page but WITHOUT outgoing internal links (warning)
        self.child = Page(
            project_id=self.project.id,
            niche_id=self.niche.id,
            parent_page_id=self.pillar.id,
            title="Tienda Ultraligera 2P",
            type="TSR",
            state="borrador",
            breadcrumb_label="2P",
            h1="Tienda 2 Personas",
            seo_title="Tienda 2P ultraligera",
            seo_description="Review de la tienda 2P.",
            content_html="<article><h1>Review</h1><p>Texto</p></article>",
        )
        self.db.add(self.child)
        self.db.commit()
        self.db.add(Url(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.child.id,
            slug="/tiendas-ultraligeras/2p",
        ))
        self.db.add(Keyword(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.child.id,
            term="tienda ultraligera 2 personas",
            intent="informacional",
            is_primary=True,
        ))
        self.db.commit()

        # Internal link from pillar -> child (keeps pillar warning-free)
        self.db.add(InternalLink(
            project_id=self.project.id,
            from_page_id=self.pillar.id,
            to_page_id=self.child.id,
            anchor="ver comparativa 2P",
        ))
        self.db.commit()

        # Incomplete page: url + primary kw only
        self.bad = Page(
            project_id=self.project.id,
            niche_id=self.niche.id,
            title="Pagina Incompleta",
            type="TSA",
            state="borrador",
        )
        self.db.add(self.bad)
        self.db.commit()
        self.db.add(Url(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.bad.id,
            slug="/pagina-incompleta",
        ))
        self.db.add(Keyword(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.bad.id,
            term="pagina incompleta",
            is_primary=True,
        ))
        self.db.commit()

        # Project product (exported on every page item)
        self.db.add(Product(
            project_id=self.project.id,
            name="Tienda Modelo X",
            affiliate_url="https://aff.example.com/tienda-x",
            image_url="https://img.example.com/tienda-x.jpg",
        ))
        self.db.commit()

        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def _audit(self):
        res = self.client.get(f"{API_PREFIX}/audit/export-audit?project_id={self.project.id}")
        self.assertEqual(res.status_code, 200)
        return res.json()

    def test_fully_populated_page_audits_ready(self):
        report = self._audit()
        pillar = next(p for p in report["pages"] if p["page_id"] == self.pillar.id)
        self.assertTrue(pillar["ready"])
        self.assertEqual(pillar["errors"], [])
        self.assertEqual(pillar["warnings"], [])
        self.assertEqual(pillar["slug"], "/tiendas-ultraligeras")

    def test_missing_fields_produce_errors(self):
        report = self._audit()
        bad = next(p for p in report["pages"] if p["page_id"] == self.bad.id)
        self.assertFalse(bad["ready"])
        self.assertIn("Falta seo_title", bad["errors"])
        self.assertIn("Falta seo_description", bad["errors"])
        self.assertIn("Falta H1", bad["errors"])
        self.assertIn("Falta content_html (contenido final maquetado)", bad["errors"])
        # url and primary keyword exist, so no errors for those
        self.assertNotIn("Falta slug/URL", bad["errors"])
        self.assertNotIn("Falta palabra clave principal", bad["errors"])

    def test_seo_falls_back_to_latest_draft_meta(self):
        self.db.add(ContentDraft(
            page_id=self.bad.id,
            meta_title="Meta desde borrador",
            meta_description="Descripción desde borrador",
        ))
        self.db.commit()
        report = self._audit()
        bad = next(p for p in report["pages"] if p["page_id"] == self.bad.id)
        self.assertNotIn("Falta seo_title", bad["errors"])
        self.assertNotIn("Falta seo_description", bad["errors"])
        # h1 and content_html are still missing
        self.assertIn("Falta H1", bad["errors"])
        self.assertIn("Falta content_html (contenido final maquetado)", bad["errors"])

    def test_page_without_internal_links_gets_warning(self):
        report = self._audit()
        child = next(p for p in report["pages"] if p["page_id"] == self.child.id)
        self.assertTrue(child["ready"])
        self.assertEqual(child["errors"], [])
        self.assertEqual(len(child["warnings"]), 1)
        self.assertIn("Sin enlaces internos", child["warnings"][0])

    def test_endpoint_totals_are_correct(self):
        report = self._audit()
        self.assertEqual(report["project_id"], self.project.id)
        self.assertEqual(report["project_name"], "Tienda Camping")
        self.assertEqual(report["total_pages"], 3)
        self.assertEqual(report["ready_pages"], 2)
        self.assertEqual(report["error_pages"], 1)
        self.assertEqual(report["total_errors"], 4)  # seo_title, seo_description, h1, content_html
        self.assertEqual(report["total_warnings"], 2)  # child + incomplete page lack internal links

    def test_endpoint_404_for_unknown_project(self):
        res = self.client.get(f"{API_PREFIX}/audit/export-audit?project_id=999999")
        self.assertEqual(res.status_code, 404)

    def test_export_items_include_w6_keys(self):
        res = self.client.get(f"{API_PREFIX}/wordpress/export?project_id={self.project.id}")
        self.assertEqual(res.status_code, 200)
        pages = {p["title"]: p for p in res.json()["pages"]}

        pillar = pages["Mejores Tiendas Ultraligeras"]
        self.assertEqual(pillar["content_type"], "TSG")
        self.assertEqual(pillar["h1"], "Guía de Tiendas Ultraligeras 2026")
        self.assertEqual(pillar["outline"], [{"tag": "h2", "text": "Comparativa"}])
        self.assertEqual(pillar["seo_title"], "Mejores Tiendas Ultraligeras (2026)")
        self.assertEqual(pillar["seo_description"], "Comparativa definitiva de tiendas ligeras.")
        self.assertEqual(pillar["primary_keyword"], "mejores tiendas ultraligeras")
        self.assertEqual(pillar["secondary_keywords"], ["tiendas ultraligeras baratas"])
        self.assertEqual(pillar["intent"], "comercial")
        self.assertIn("<article>", pillar["content_html"])
        self.assertEqual(
            pillar["internal_links"],
            [{"to_slug": "/tiendas-ultraligeras/2p", "anchor": "ver comparativa 2P"}],
        )
        self.assertEqual(pillar["breadcrumbs"], ["Tiendas Ultraligeras"])
        self.assertEqual(
            pillar["products"],
            [
                {
                    "name": "Tienda Modelo X",
                    "affiliate_url": "https://aff.example.com/tienda-x",
                    "image_url": "https://img.example.com/tienda-x.jpg",
                }
            ],
        )
        self.assertEqual(
            pillar["rank_math"],
            {
                "focus_keyword": "mejores tiendas ultraligeras",
                "title": "Mejores Tiendas Ultraligeras (2026)",
                "description": "Comparativa definitiva de tiendas ligeras.",
            },
        )

        child = pages["Tienda Ultraligera 2P"]
        self.assertEqual(child["parent_slug"], "/tiendas-ultraligeras")
        self.assertEqual(child["breadcrumbs"], ["Tiendas Ultraligeras", "2P"])

    def test_build_export_items_shape(self):
        _, items = _build_export_items(self.project.id, self.db)
        pillar = next(i for i in items if i.page_id == self.pillar.id)
        dumped = pillar.model_dump()
        for key in (
            "page_id", "title", "slug", "h1", "meta_title", "meta_description",
            "focus_keyword", "secondary_keywords", "content_html", "content_type",
            "status", "content_status", "export_ready", "niche_name", "wp_category",
            "wp_tags", "parent_slug", "parent_title", "schema_json",
            "seo_title", "seo_description", "primary_keyword", "intent", "outline",
            "internal_links", "breadcrumbs", "products", "rank_math",
        ):
            self.assertIn(key, dumped)


if __name__ == "__main__":
    unittest.main()
