import json
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import AiPrompt, ContentDraft, Keyword, Niche, Page, Project
from app.seed_phase2 import seed_phase2
from app.services.assistant_runner import _META_DESCRIPTION_RE, _META_TITLE_RE, _extract_meta


class TestDraftPersistence(unittest.TestCase):
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

        p = Project(name="Project Drafts", description="Testing draft persistence")
        self.db.add(p)
        self.db.commit()
        self.project_id = p.id

        n = Niche(project_id=self.project_id, name="Cafeteras", topic="Cafeteras express")
        self.db.add(n)
        self.db.commit()
        self.niche_id = n.id

        page = Page(
            project_id=self.project_id,
            niche_id=self.niche_id,
            title="Mejores Cafeteras Express 2026",
            type="TSG",
            objective="Guía comparativa",
        )
        self.db.add(page)
        self.db.commit()
        self.page_id = page.id

        kw = Keyword(
            project_id=self.project_id,
            niche_id=self.niche_id,
            page_id=self.page_id,
            term="mejor cafetera express",
            is_primary=True,
        )
        self.db.add(kw)
        self.db.commit()

        self.prompt = self.db.query(AiPrompt).filter(AiPrompt.slug == "content_generator").first()

        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        self.ai_url = f"{API_PREFIX}/ai"
        self.assistants_url = f"{API_PREFIX}/ai/assistants"

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def _mock_openai(self, content: str):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": content}}]
        }
        return mock_response

    def test_assistant_run_persists_texto_draft_with_context(self):
        rendered = (
            "META TITLE: Las Mejores Cafeteras Express de 2026\n"
            "META DESCRIPTION: Comparativa honesta con pros, contras y recomendaciones.\n\n"
            "# H1: Guía Definitiva de Cafeteras Express\n\n"
            "Contenido del artículo..."
        )
        with patch("httpx.AsyncClient.post") as mock_post, patch.object(
            settings, "openai_api_key", "sk-test-fake"
        ):
            mock_post.return_value = self._mock_openai(rendered)
            res = self.client.post(
                self.assistants_url + "/run",
                json={
                    "project_id": self.project_id,
                    "page_id": self.page_id,
                    "prompt_slug": "content_generator",
                },
            )

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsNotNone(data["draft_id"])

        # Draft persisted with kind texto, prompt source and context snapshot
        draft = self.db.get(ContentDraft, data["draft_id"])
        self.assertIsNotNone(draft)
        self.assertEqual(draft.draft_kind, "texto")
        self.assertEqual(draft.draft_body, rendered)
        self.assertEqual(draft.page_id, self.page_id)
        self.assertEqual(draft.source_prompt_id, self.prompt.id)
        context_used = json.loads(draft.context_used_json)
        self.assertEqual(context_used["page_title"], "Mejores Cafeteras Express 2026")

        # Meta labels extracted from the rendered text
        self.assertEqual(draft.meta_title, "Las Mejores Cafeteras Express de 2026")
        self.assertEqual(
            draft.meta_description,
            "Comparativa honesta con pros, contras y recomendaciones.",
        )

    def test_assistant_run_without_page_has_no_draft(self):
        with patch("httpx.AsyncClient.post") as mock_post, patch.object(
            settings, "openai_api_key", "sk-test-fake"
        ):
            mock_post.return_value = self._mock_openai("Análisis general del proyecto.")
            res = self.client.post(
                self.assistants_url + "/run",
                json={"project_id": self.project_id, "prompt_slug": "seo_architect"},
            )
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.json()["draft_id"])
        self.assertEqual(self.db.query(ContentDraft).count(), 0)

    def test_meta_extraction_label_variants(self):
        text = "**Meta Título SEO**: Mejor Aspiradora 2026\n**Meta Descripción**: Review detallada"
        self.assertEqual(_extract_meta(_META_TITLE_RE, text), "Mejor Aspiradora 2026")
        self.assertEqual(_extract_meta(_META_DESCRIPTION_RE, text), "Review detallada")
        self.assertIsNone(_extract_meta(_META_TITLE_RE, "Sin etiquetas meta aquí"))

    def test_maquetar_saves_maquetado_draft(self):
        with patch.object(settings, "openai_api_key", None):
            res = self.client.post(
                f"{self.ai_url}/maquetar",
                json={"page_id": self.page_id, "save_to_page": True},
            )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["draft"]["draft_kind"], "maquetado")
        self.assertIsNotNone(data["draft"]["content_html"])
        self.assertTrue(data["page_updated"])

        draft = self.db.get(ContentDraft, data["draft"]["id"])
        self.assertEqual(draft.draft_kind, "maquetado")
        self.assertIsNotNone(draft.context_used_json)

    def test_maquetar_replace_existing_false_preserves_page_html(self):
        page = self.db.get(Page, self.page_id)
        page.content_html = "<article><p>HTML ORIGINAL</p></article>"
        page.content_status = "revisado"
        self.db.commit()

        with patch.object(settings, "openai_api_key", None):
            res = self.client.post(
                f"{self.ai_url}/maquetar",
                json={"page_id": self.page_id, "save_to_page": True},
            )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Draft is saved, but the existing page HTML is NOT overwritten
        self.assertEqual(data["draft"]["draft_kind"], "maquetado")
        self.assertFalse(data["page_updated"])
        self.assertIsNotNone(data["message"])
        self.assertIn("NO", data["message"])

        page = self.db.get(Page, self.page_id)
        self.assertEqual(page.content_html, "<article><p>HTML ORIGINAL</p></article>")

    def test_maquetar_replace_existing_true_overwrites_page_html(self):
        page = self.db.get(Page, self.page_id)
        page.content_html = "<article><p>HTML ORIGINAL</p></article>"
        page.content_status = "revisado"
        self.db.commit()

        with patch.object(settings, "openai_api_key", None):
            res = self.client.post(
                f"{self.ai_url}/maquetar",
                json={"page_id": self.page_id, "save_to_page": True, "replace_existing": True},
            )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["page_updated"])
        self.assertIsNone(data["message"])

        page = self.db.get(Page, self.page_id)
        self.assertIn("<article", page.content_html)
        self.assertNotEqual(page.content_html, "<article><p>HTML ORIGINAL</p></article>")


if __name__ == "__main__":
    unittest.main()
