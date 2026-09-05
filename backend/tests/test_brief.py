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


class TestPageBrief(unittest.TestCase):
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

        p = Project(name="Project Brief", description="Testing per-page brief")
        self.db.add(p)
        self.db.commit()
        self.project_id = p.id

        n = Niche(project_id=self.project_id, name="Aspiradoras", topic="Aspiradoras sin cable")
        self.db.add(n)
        self.db.commit()
        self.niche_id = n.id

        page = Page(
            project_id=self.project_id,
            niche_id=self.niche_id,
            title="Mejores Aspiradoras Sin Cable",
            type="TSR",
            objective="Comparativa comercial",
        )
        self.db.add(page)
        self.db.commit()
        self.page_id = page.id

        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        self.pages_url = f"{API_PREFIX}/pages"

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_brief_text_patch_roundtrip(self):
        brief = "Redactar comparativa honesta. Keyword principal: aspiradoras sin cable. Incluir 3 productos del catálogo."
        res = self.client.patch(f"{self.pages_url}/{self.page_id}", json={"brief_text": brief})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["brief_text"], brief)

        # Reload from a fresh read (list endpoint) to confirm persistence
        list_res = self.client.get(f"{self.pages_url}?project_id={self.project_id}")
        self.assertEqual(list_res.status_code, 200)
        page = next(pg for pg in list_res.json() if pg["id"] == self.page_id)
        self.assertEqual(page["brief_text"], brief)

    def test_brief_text_can_be_cleared(self):
        page = self.db.get(Page, self.page_id)
        page.brief_text = "Brief inicial"
        self.db.commit()

        res = self.client.patch(f"{self.pages_url}/{self.page_id}", json={"brief_text": None})
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.json()["brief_text"])

    def test_suggest_brief_preview_endpoint_returns_200(self):
        # The "Generar brief sugerido" button reuses the assistants context preview
        res = self.client.post(
            f"{API_PREFIX}/ai/assistants/preview-context",
            json={
                "project_id": self.project_id,
                "page_id": self.page_id,
                "prompt_slug": "content_generator",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("Mejores Aspiradoras Sin Cable", data["user_prompt"])
        self.assertGreater(data["word_count"], 0)


if __name__ == "__main__":
    unittest.main()
