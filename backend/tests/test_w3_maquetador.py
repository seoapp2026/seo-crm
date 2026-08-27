import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import ContentDraft, Keyword, Niche, Page, Project
from app.seed_phase2 import seed_phase2


class TestW3Maquetador(unittest.TestCase):
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

        # Create project, niche with custom layout template, page, and keywords
        p = Project(name="Project W3", description="Testing maquetacion")
        self.db.add(p)
        self.db.commit()
        self.project_id = p.id

        n = Niche(
            project_id=self.project_id,
            name="Cafeteras Express",
            topic="Cafeteras de brazo y automaticas",
            layout_template_text="PLANTILLA NICHO: Header > Tabla Comparativa > Pros/Contras > FAQ",
        )
        self.db.add(n)
        self.db.commit()
        self.niche_id = n.id

        page = Page(
            project_id=self.project_id,
            niche_id=self.niche_id,
            title="Mejores Cafeteras Express 2026",
            type="TSG",
            h1="Guía Definitiva de Cafeteras Express",
            seo_title="Mejores Cafeteras Express (2026)",
            seo_description="Descubre las mejores cafeteras para espresso en casa.",
            wp_category="Cafeteras > Express",
            breadcrumb_label="Express",
        )
        self.db.add(page)
        self.db.commit()
        self.page_id = page.id

        kw1 = Keyword(
            project_id=self.project_id,
            niche_id=self.niche_id,
            page_id=self.page_id,
            term="mejor cafetera express manual",
            is_primary=True,
        )
        kw2 = Keyword(
            project_id=self.project_id,
            niche_id=self.niche_id,
            page_id=self.page_id,
            term="cafeteras de brazo baratas",
            is_primary=False,
        )
        self.db.add_all([kw1, kw2])
        self.db.commit()

        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        self.ai_url = f"{API_PREFIX}/ai"
        self.pages_url = f"{API_PREFIX}/pages"

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_maquetar_page_saves_html_and_updates_page(self):
        payload = {
            "page_id": self.page_id,
            "save_to_page": True,
        }
        res = self.client.post(f"{self.ai_url}/maquetar", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["page_updated"])
        self.assertIn("<article", data["content_html"])
        self.assertIn("Guía Definitiva de Cafeteras Express", data["content_html"])
        self.assertEqual(data["draft"]["draft_kind"], "maquetado")

        # Verify page was updated in DB
        page_res = self.client.get(f"{self.pages_url}?project_id={self.project_id}")
        page = next(p for p in page_res.json() if p["id"] == self.page_id)
        self.assertIsNotNone(page["content_html"])
        self.assertIn("<article", page["content_html"])
        self.assertEqual(page["content_status"], "revisado")

    def test_maquetar_with_custom_template_override(self):
        payload = {
            "page_id": self.page_id,
            "custom_layout_template": "CUSTOM TEMPLATE OVERRIDE: Solo tabla y CTA",
            "save_to_page": False,
        }
        res = self.client.post(f"{self.ai_url}/maquetar", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data["page_updated"])
        self.assertEqual(data["draft"]["draft_kind"], "maquetado")

    def test_list_drafts_by_page_and_kind(self):
        # Create a text draft and a layout draft
        d1 = ContentDraft(page_id=self.page_id, draft_body="Texto plano", draft_kind="texto")
        d2 = ContentDraft(page_id=self.page_id, content_html="<p>HTML</p>", draft_kind="maquetado")
        self.db.add_all([d1, d2])
        self.db.commit()

        # List all drafts
        res = self.client.get(f"{self.ai_url}/drafts?page_id={self.page_id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 2)

        # List only maquetado drafts
        res_maq = self.client.get(f"{self.ai_url}/drafts?page_id={self.page_id}&draft_kind=maquetado")
        self.assertEqual(res_maq.status_code, 200)
        self.assertEqual(len(res_maq.json()), 1)
        self.assertEqual(res_maq.json()[0]["content_html"], "<p>HTML</p>")


if __name__ == "__main__":
    unittest.main()
