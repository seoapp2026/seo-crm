import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import Niche, Page, Project
from app.seed_phase2 import seed_phase2


class TestW2SeoFields(unittest.TestCase):
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

        # Create project and niche
        p = Project(name="SEO Project", description="Test project")
        self.db.add(p)
        self.db.commit()
        self.project_id = p.id

        n = Niche(project_id=self.project_id, name="Aspiradoras", topic="Aspiradoras robot y escoba")
        self.db.add(n)
        self.db.commit()
        self.niche_id = n.id

        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        self.pages_url = f"{API_PREFIX}/pages"
        self.keywords_url = f"{API_PREFIX}/keywords"
        self.niches_url = f"{API_PREFIX}/niches"

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_create_parent_and_child_pages(self):
        # 1. Create parent silo page
        parent_payload = {
            "project_id": self.project_id,
            "niche_id": self.niche_id,
            "title": "Mejores Aspiradoras 2026",
            "type": "TSG",
            "h1": "Guía Completa de Aspiradoras",
            "seo_title": "Mejores Aspiradoras 2026 — Comparativa y Guía",
            "seo_description": "Descubre las mejores aspiradoras robot y sin cable analizadas por expertos.",
            "wp_category": "Aspiradoras",
            "breadcrumb_label": "Aspiradoras",
        }
        res_parent = self.client.post(self.pages_url, json=parent_payload)
        self.assertEqual(res_parent.status_code, 201)
        parent_data = res_parent.json()
        parent_id = parent_data["id"]
        self.assertEqual(parent_data["h1"], "Guía Completa de Aspiradoras")
        self.assertEqual(parent_data["seo_title"], "Mejores Aspiradoras 2026 — Comparativa y Guía")
        self.assertIsNone(parent_data["parent_page_id"])

        # 2. Create child page linked to parent
        child_payload = {
            "project_id": self.project_id,
            "niche_id": self.niche_id,
            "parent_page_id": parent_id,
            "title": "Aspiradoras Robot",
            "type": "TSG",
            "h1": "Las Mejores Aspiradoras Robot",
            "seo_title": "Aspiradoras Robot — Top Modelos 2026",
            "seo_description": "Análisis a fondo de robots aspiradores inteligentes.",
            "wp_category": "Aspiradoras > Robot",
            "breadcrumb_label": "Robot",
            "content_status": "listo_export",
            "export_ready": True,
        }
        res_child = self.client.post(self.pages_url, json=child_payload)
        self.assertEqual(res_child.status_code, 201)
        child_data = res_child.json()
        self.assertEqual(child_data["parent_page_id"], parent_id)
        self.assertEqual(child_data["parent_title"], "Mejores Aspiradoras 2026")
        self.assertEqual(child_data["content_status"], "listo_export")
        self.assertTrue(child_data["export_ready"])

    def test_update_page_seo_fields(self):
        create_payload = {
            "project_id": self.project_id,
            "niche_id": self.niche_id,
            "title": "Aspiradoras Escoba",
            "type": "TSA",
        }
        res = self.client.post(self.pages_url, json=create_payload)
        page_id = res.json()["id"]

        update_payload = {
            "h1": "Aspiradoras Escoba Sin Cable",
            "seo_title": "Aspiradoras Escoba 2026",
            "seo_description": "Opiniones y comparativa de escobas eléctricas.",
            "outline_json": "[{\"tag\": \"h2\", \"text\": \"Top 3\"}, {\"tag\": \"h2\", \"text\": \"Guía de compra\"}]",
            "wp_tags_json": "[\"sin cable\", \"bateria\"]",
            "content_html": "<article><h1>Aspiradoras Escoba</h1><p>Contenido maquetado...</p></article>",
            "content_status": "revisado",
        }
        patch_res = self.client.patch(f"{self.pages_url}/{page_id}", json=update_payload)
        self.assertEqual(patch_res.status_code, 200)
        updated = patch_res.json()
        self.assertEqual(updated["h1"], "Aspiradoras Escoba Sin Cable")
        self.assertEqual(updated["seo_title"], "Aspiradoras Escoba 2026")
        self.assertIn("Top 3", updated["outline_json"])
        self.assertIn("Contenido maquetado", updated["content_html"])
        self.assertEqual(updated["content_status"], "revisado")

    def test_keyword_primary_exclusivity_per_page(self):
        # Create page
        res = self.client.post(self.pages_url, json={
            "project_id": self.project_id,
            "niche_id": self.niche_id,
            "title": "Aspiradoras de Mano",
            "type": "TSA",
        })
        page_id = res.json()["id"]

        # Create first primary keyword
        kw1_res = self.client.post(self.keywords_url, json={
            "project_id": self.project_id,
            "niche_id": self.niche_id,
            "page_id": page_id,
            "term": "aspiradora de mano potente",
            "is_primary": True,
        })
        self.assertEqual(kw1_res.status_code, 201)
        self.assertTrue(kw1_res.json()["is_primary"])
        kw1_id = kw1_res.json()["id"]

        # Create second keyword as primary -> first must become non-primary
        kw2_res = self.client.post(self.keywords_url, json={
            "project_id": self.project_id,
            "niche_id": self.niche_id,
            "page_id": page_id,
            "term": "mejor aspiradora de mano",
            "is_primary": True,
        })
        self.assertEqual(kw2_res.status_code, 201)
        self.assertTrue(kw2_res.json()["is_primary"])

        # Check that kw1 was demoted to non-primary
        kw_list = self.client.get(f"{self.keywords_url}?project_id={self.project_id}").json()
        kw1_refreshed = next(k for k in kw_list if k["id"] == kw1_id)
        self.assertFalse(kw1_refreshed["is_primary"])

    def test_niche_layout_template_text(self):
        patch_res = self.client.patch(f"{self.niches_url}/{self.niche_id}", json={
            "layout_template_text": "Plantilla Divi: Header > Tabla Comparativa > Secciones H2 > FAQ Schema",
        })
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(
            patch_res.json()["layout_template_text"],
            "Plantilla Divi: Header > Tabla Comparativa > Secciones H2 > FAQ Schema",
        )


if __name__ == "__main__":
    unittest.main()
