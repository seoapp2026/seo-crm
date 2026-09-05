import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import AiPrompt, Project


class TestProjectPrompts(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = self.Session()

        p1 = Project(name="Proyecto Uno")
        p2 = Project(name="Proyecto Dos")
        self.db.add_all([p1, p2])
        self.db.commit()
        self.project1_id = p1.id
        self.project2_id = p2.id

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

    def _create_prompt(self, slug: str, project_id: int | None = None) -> dict:
        payload = {
            "slug": slug,
            "name": f"Prompt {slug}",
            "system_prompt": "Eres un asistente de pruebas.",
        }
        if project_id is not None:
            payload["project_id"] = project_id
        resp = self.client.post(f"{API_PREFIX}/ai/prompts", json=payload)
        self.assertEqual(resp.status_code, 201)
        return resp.json()

    def test_create_prompt_with_project_id(self):
        data = self._create_prompt("prompt-proyecto", self.project1_id)
        self.assertEqual(data["project_id"], self.project1_id)
        row = self.db.get(AiPrompt, data["id"])
        self.assertEqual(row.project_id, self.project1_id)

    def test_list_with_project_filter_returns_global_and_project_prompts(self):
        self._create_prompt("global-uno")  # global
        self._create_prompt("p1-uno", self.project1_id)
        self._create_prompt("p2-uno", self.project2_id)

        resp = self.client.get(f"{API_PREFIX}/ai/prompts", params={"project_id": self.project1_id})
        self.assertEqual(resp.status_code, 200)
        rows = resp.json()
        slugs = {r["slug"] for r in rows}
        # Global + project1 prompts, but NOT project2 prompts
        self.assertIn("global-uno", slugs)
        self.assertIn("p1-uno", slugs)
        self.assertNotIn("p2-uno", slugs)

    def test_list_without_filter_returns_all_prompts(self):
        self._create_prompt("global-dos")
        self._create_prompt("p1-dos", self.project1_id)

        resp = self.client.get(f"{API_PREFIX}/ai/prompts")
        self.assertEqual(resp.status_code, 200)
        slugs = {r["slug"] for r in resp.json()}
        self.assertIn("global-dos", slugs)
        self.assertIn("p1-dos", slugs)


if __name__ == "__main__":
    unittest.main()
