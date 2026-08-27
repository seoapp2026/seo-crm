import io
import json
import unittest
import zipfile
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import Keyword, Niche, Page, Project, Url
from app.seed_phase2 import seed_phase2


class TestW5WordPressExport(unittest.TestCase):
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

        # Create project with niche and pages
        self.project = Project(
            name="Tienda Camping",
            description="Web de equipamiento de montaña",
            wp_url="https://tiendacamping.example.com",
            wp_username="editor_wp",
            wp_app_password="xxxx-yyyy-zzzz-wwww",
        )
        self.db.add(self.project)
        self.db.commit()

        self.niche = Niche(
            project_id=self.project.id,
            name="Tiendas Ultraligeras",
            topic="Tiendas de campaña para trekking",
        )
        self.db.add(self.niche)
        self.db.commit()

        # Pillar page
        self.pillar_page = Page(
            project_id=self.project.id,
            niche_id=self.niche.id,
            title="Mejores Tiendas Ultraligeras",
            type="TSG",
            state="publicado",
            h1="Guía de Tiendas Ultraligeras 2026",
            seo_title="Mejores Tiendas Ultraligeras (2026)",
            seo_description="Comparativa y guía definitiva de tiendas de campaña ligeras.",
            wp_category="Tiendas de Campaña",
            wp_tags_json=json.dumps(["trekking", "ultraligero", "montaña"]),
            content_html="<article><h1>Guía de Tiendas</h1><p>Contenido completo...</p></article>",
            content_status="listo_export",
            export_ready=True,
        )
        self.db.add(self.pillar_page)
        self.db.commit()

        # Url
        self.db.add(Url(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.pillar_page.id,
            slug="/tiendas-ultraligeras",
        ))

        # Focus keyword
        self.db.add(Keyword(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.pillar_page.id,
            term="mejores tiendas ultraligeras",
            is_primary=True,
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

    def test_export_json_returns_rich_structure(self):
        res = self.client.get(f"{API_PREFIX}/wordpress/export?project_id={self.project.id}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["project_name"], "Tienda Camping")
        self.assertEqual(len(data["pages"]), 1)
        p = data["pages"][0]
        self.assertEqual(p["title"], "Mejores Tiendas Ultraligeras")
        self.assertEqual(p["slug"], "/tiendas-ultraligeras")
        self.assertEqual(p["focus_keyword"], "mejores tiendas ultraligeras")
        self.assertEqual(p["wp_category"], "Tiendas de Campaña")
        self.assertEqual(p["wp_tags"], ["trekking", "ultraligero", "montaña"])
        self.assertEqual(p["status"], "publish")
        self.assertTrue(p["export_ready"])
        self.assertIn("<article>", p["content_html"])

    def test_export_csv_returns_utf8_bom_and_headers(self):
        res = self.client.get(f"{API_PREFIX}/wordpress/export/csv?project_id={self.project.id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "text/csv; charset=utf-8")
        self.assertIn("attachment; filename=", res.headers["content-disposition"])

        content = res.content.decode("utf-8")
        self.assertTrue(content.startswith("\ufeff"))
        self.assertIn("Rank_Math_Focus_Keyword", content)
        self.assertIn("mejores tiendas ultraligeras", content)
        self.assertIn("Mejores Tiendas Ultraligeras (2026)", content)
        self.assertIn("trekking, ultraligero, montaña", content)

    def test_export_zip_bundle_contains_all_files(self):
        res = self.client.get(f"{API_PREFIX}/wordpress/export/zip?project_id={self.project.id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "application/zip")

        zip_buf = io.BytesIO(res.content)
        with zipfile.ZipFile(zip_buf, "r") as zf:
            namelist = zf.namelist()
            self.assertIn("import_all_pages.csv", namelist)
            self.assertIn("rank_math_seo.csv", namelist)
            self.assertIn("structure.json", namelist)
            self.assertIn("README.txt", namelist)
            self.assertIn("html_pages/tiendas-ultraligeras.html", namelist)

            html_data = zf.read("html_pages/tiendas-ultraligeras.html").decode("utf-8")
            self.assertIn("<article><h1>Guía de Tiendas</h1>", html_data)

    def test_push_without_credentials_fails(self):
        p_no_creds = Project(name="Sin Credenciales")
        self.db.add(p_no_creds)
        self.db.commit()

        res = self.client.post(f"{API_PREFIX}/wordpress/push", json={
            "project_id": p_no_creds.id,
        })
        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
