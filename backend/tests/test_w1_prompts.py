import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import AiPrompt, Project
from app.seed_phase2 import seed_phase2


class TestW1Prompts(unittest.TestCase):
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

        # Create dummy project for assistant runs
        p = Project(name="Test Project", description="Test Description")
        self.db.add(p)
        self.db.commit()
        self.project_id = p.id

        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        self.base_url = f"{API_PREFIX}/ai/prompts"
        self.assistants_url = f"{API_PREFIX}/ai/assistants/run"

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_list_prompts_seeded(self):
        res = self.client.get(self.base_url)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(len(data), 5)
        sort_orders = [p["sort_order"] for p in data]
        self.assertEqual(sort_orders, sorted(sort_orders))
        slugs = [p["slug"] for p in data]
        self.assertIn("seo_architect", slugs)
        self.assertIn("content_generator", slugs)

    def test_create_custom_prompt(self):
        payload = {
            "slug": "prompt_00",
            "name": "Prompt 00 Maestro",
            "description": "Prompt maestro inicial",
            "system_prompt": "Eres el prompt 00 maestro.",
            "model_default": "gpt-4o",
            "sort_order": 5,
            "is_system": False,
        }
        res = self.client.post(self.base_url, json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["slug"], "prompt_00")
        self.assertEqual(data["name"], "Prompt 00 Maestro")
        self.assertEqual(data["sort_order"], 5)
        self.assertFalse(data["is_system"])

    def test_create_duplicate_slug_fails(self):
        payload = {
            "slug": "seo_architect",
            "name": "Duplicated",
            "system_prompt": "test",
        }
        res = self.client.post(self.base_url, json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Ya existe un prompt", res.json()["detail"])

    def test_update_prompt(self):
        res = self.client.get(self.base_url)
        prompt_id = res.json()[0]["id"]
        update_payload = {
            "name": "Arquitecto SEO Modificado",
            "description": "Nueva descripcion",
            "model_default": "gpt-4o",
        }
        patch_res = self.client.patch(f"{self.base_url}/{prompt_id}", json=update_payload)
        self.assertEqual(patch_res.status_code, 200)
        updated = patch_res.json()
        self.assertEqual(updated["name"], "Arquitecto SEO Modificado")
        self.assertEqual(updated["description"], "Nueva descripcion")
        self.assertEqual(updated["model_default"], "gpt-4o")

    def test_duplicate_prompt(self):
        res = self.client.get(self.base_url)
        first = res.json()[0]
        prompt_id = first["id"]
        dup_res = self.client.post(f"{self.base_url}/{prompt_id}/duplicate")
        self.assertEqual(dup_res.status_code, 201)
        copy_data = dup_res.json()
        self.assertNotEqual(copy_data["id"], prompt_id)
        self.assertTrue(copy_data["slug"].startswith(first["slug"] + "_copia"))
        self.assertIn("Copia", copy_data["name"])
        self.assertFalse(copy_data["is_system"])

    def test_reorder_prompts(self):
        res = self.client.get(self.base_url)
        prompts = res.json()
        p1 = prompts[0]
        p2 = prompts[1]
        reorder_payload = [
            {"id": p1["id"], "sort_order": 999},
            {"id": p2["id"], "sort_order": 1},
        ]
        reorder_res = self.client.post(f"{self.base_url}/reorder", json=reorder_payload)
        self.assertEqual(reorder_res.status_code, 200)
        reordered = reorder_res.json()
        self.assertEqual(reordered[0]["id"], p2["id"])
        self.assertEqual(reordered[-1]["id"], p1["id"])

    def test_delete_prompt(self):
        create_res = self.client.post(
            self.base_url,
            json={
                "slug": "custom_to_delete",
                "name": "To Delete",
                "system_prompt": "temporary",
            },
        )
        prompt_id = create_res.json()["id"]
        del_res = self.client.delete(f"{self.base_url}/{prompt_id}")
        self.assertEqual(del_res.status_code, 204)
        get_res = self.client.get(f"{self.base_url}/{prompt_id}")
        self.assertEqual(get_res.status_code, 404)

    def test_delete_system_prompt_requires_force(self):
        res = self.client.get(self.base_url)
        system_prompt = next(p for p in res.json() if p["is_system"])
        del_res = self.client.delete(f"{self.base_url}/{system_prompt['id']}")
        self.assertEqual(del_res.status_code, 400)
        self.assertIn("prompt base", del_res.json()["detail"])
        force_del = self.client.delete(f"{self.base_url}/{system_prompt['id']}?force=true")
        self.assertEqual(force_del.status_code, 204)

    @patch("httpx.AsyncClient.post")
    def test_run_assistant_with_custom_prompt_id(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Respuesta generada por Maquetador"}}]
        }
        mock_post.return_value = mock_response

        # Create custom maquetador prompt
        create_res = self.client.post(
            self.base_url,
            json={
                "slug": "maquetador",
                "name": "Maquetador HTML",
                "system_prompt": "Eres el maquetador HTML.",
                "model_default": "gpt-4o",
            },
        )
        prompt_id = create_res.json()["id"]

        with patch.object(settings, "openai_api_key", "sk-test-fake"):
            run_res = self.client.post(
                self.assistants_url,
                json={
                    "project_id": self.project_id,
                    "prompt_id": prompt_id,
                    "extra_context": "Seccion comparativa",
                },
            )
            self.assertEqual(run_res.status_code, 200)
            data = run_res.json()
            self.assertEqual(data["assistant"], "maquetador")
            self.assertEqual(data["prompt_id"], prompt_id)
            self.assertEqual(data["prompt_name"], "Maquetador HTML")
            self.assertIn("Respuesta generada por Maquetador", data["rendered"])


if __name__ == "__main__":
    unittest.main()
