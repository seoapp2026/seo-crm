import json
import unittest
from unittest import mock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import ActionLog, ApiKey, Niche, Note, Page, Project

PASSWORD = "clave-test"


class ApiKeyActionsBase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = self.Session()

        self.project = Project(name="Tienda Camping", description="Web de montaña")
        self.db.add(self.project)
        self.db.commit()

        self.niche = Niche(project_id=self.project.id, name="Tiendas Ultraligeras")
        self.db.add(self.niche)
        self.db.commit()

        self.page = Page(
            project_id=self.project.id,
            niche_id=self.niche.id,
            title="Mejores Tiendas Ultraligeras",
            type="TSG",
            state="borrador",
        )
        self.db.add(self.page)
        self.db.commit()

        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db

        # Auth activado y sesión de admin por cookie
        self._auth_patch = mock.patch.object(settings, "app_auth_password", PASSWORD)
        self._auth_patch.start()
        self.addCleanup(self._auth_patch.stop)

        # El middleware abre su propia sesión: apuntarla a la BD de test
        self._session_patch = mock.patch("app.middleware.app_auth.SessionLocal", self.Session)
        self._session_patch.start()
        self.addCleanup(self._session_patch.stop)

        self.client = TestClient(app)
        login = self.client.post(
            f"{API_PREFIX}/auth/login",
            json={"email": "admin@test.com", "password": PASSWORD},
        )
        self.assertEqual(login.status_code, 200)

        # Cliente sin cookie: fuerza la ruta de autenticación por X-API-Key
        self.anon = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def _create_key(self, name="n8n", can_write=True) -> dict:
        res = self.client.post(
            f"{API_PREFIX}/api-keys",
            json={"name": name, "can_write": can_write},
        )
        self.assertEqual(res.status_code, 201, res.text)
        return res.json()

    def _action(self, body: dict, headers: dict | None = None):
        client = self.anon if headers else self.client
        return client.post(f"{API_PREFIX}/external/actions", json=body, headers=headers or {})


class TestApiKeys(ApiKeyActionsBase):
    def test_create_key_returns_full_key_once(self):
        data = self._create_key()
        self.assertTrue(data["api_key"].startswith("seocrm_"))
        self.assertEqual(data["prefix"], data["api_key"][:8])
        self.assertNotIn("key_hash", data)

        listed = self.client.get(f"{API_PREFIX}/api-keys")
        self.assertEqual(listed.status_code, 200)
        rows = listed.json()
        self.assertEqual(len(rows), 1)
        self.assertNotIn("api_key", rows[0])
        self.assertNotIn("key_hash", rows[0])

    def test_protected_get_with_x_api_key(self):
        data = self._create_key()
        res = self.anon.get(
            f"{API_PREFIX}/pages?project_id={self.project.id}",
            headers={"X-API-Key": data["api_key"]},
        )
        self.assertEqual(res.status_code, 200)

        self.db.expire_all()
        key_row = self.db.query(ApiKey).one()
        self.assertIsNotNone(key_row.last_used_at)

    def test_revoked_key_gets_401(self):
        data = self._create_key()
        revoke = self.client.delete(f"{API_PREFIX}/api-keys/{data['id']}")
        self.assertEqual(revoke.status_code, 200)
        self.assertIsNotNone(revoke.json()["revoked_at"])

        res = self.anon.get(
            f"{API_PREFIX}/pages?project_id={self.project.id}",
            headers={"X-API-Key": data["api_key"]},
        )
        self.assertEqual(res.status_code, 401)

    def test_no_key_gets_401(self):
        res = self.anon.get(f"{API_PREFIX}/pages?project_id={self.project.id}")
        self.assertEqual(res.status_code, 401)

    def test_read_only_key_cannot_write(self):
        data = self._create_key(can_write=False)
        headers = {"X-API-Key": data["api_key"]}
        get_res = self.anon.get(f"{API_PREFIX}/pages?project_id={self.project.id}", headers=headers)
        self.assertEqual(get_res.status_code, 200)

        post_res = self.anon.post(
            f"{API_PREFIX}/external/actions",
            json={
                "project_id": self.project.id,
                "page_id": self.page.id,
                "action": "set_priority",
                "payload": {"priority": 1},
            },
            headers=headers,
        )
        self.assertEqual(post_res.status_code, 403)

    def test_cookie_auth_untouched(self):
        res = self.client.get(f"{API_PREFIX}/pages?project_id={self.project.id}")
        self.assertEqual(res.status_code, 200)


class TestExternalActions(ApiKeyActionsBase):
    def setUp(self):
        super().setUp()
        self.key = self._create_key()["api_key"]
        self.headers = {"X-API-Key": self.key}

    def _logs(self) -> list[ActionLog]:
        self.db.expire_all()
        return self.db.query(ActionLog).order_by(ActionLog.id).all()

    def test_set_priority(self):
        res = self._action(
            {
                "project_id": self.project.id,
                "page_id": self.page.id,
                "action": "set_priority",
                "payload": {"priority": 2},
            },
            self.headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["entity_id"], self.page.id)
        self.assertIn("timestamp", data)

        self.db.expire_all()
        self.assertEqual(self.page.priority, 2)
        logs = self._logs()
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0].action, "set_priority")
        self.assertEqual(logs[0].entity, "page")
        self.assertEqual(logs[0].entity_id, self.page.id)
        self.assertEqual(json.loads(logs[0].payload_json), {"priority": 2})

    def test_set_priority_invalid_payload(self):
        res = self._action(
            {
                "project_id": self.project.id,
                "page_id": self.page.id,
                "action": "set_priority",
                "payload": {"priority": "alta"},
            },
            self.headers,
        )
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()["success"])
        self.assertEqual(self._logs(), [])

    def test_set_approval(self):
        res = self._action(
            {
                "project_id": self.project.id,
                "page_id": self.page.id,
                "action": "set_approval",
                "payload": {
                    "approval_status": "aprobada",
                    "approved_action": "publicar",
                    "notes": "Revisada en Notion",
                },
            },
            self.headers,
        )
        self.assertEqual(res.status_code, 200)
        self.db.expire_all()
        self.assertEqual(self.page.approval_status, "aprobada")
        self.assertEqual(self.page.approved_action, "publicar")
        self.assertEqual(self.page.execution_notes, "Revisada en Notion")
        self.assertEqual(len(self._logs()), 1)

    def test_add_note(self):
        res = self._action(
            {
                "project_id": self.project.id,
                "action": "add_note",
                "payload": {"title": "Idea desde n8n", "body": "Contenido de la nota"},
            },
            self.headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])

        self.db.expire_all()
        note = self.db.query(Note).filter(Note.project_id == self.project.id).one()
        self.assertEqual(note.title, "Idea desde n8n")
        self.assertEqual(note.body, "Contenido de la nota")
        logs = self._logs()
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0].action, "add_note")
        self.assertEqual(logs[0].entity, "note")
        self.assertEqual(logs[0].entity_id, note.id)

    def test_add_note_requires_title(self):
        res = self._action(
            {"project_id": self.project.id, "action": "add_note", "payload": {}},
            self.headers,
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self._logs(), [])

    def test_set_state(self):
        res = self._action(
            {
                "project_id": self.project.id,
                "page_id": self.page.id,
                "action": "set_state",
                "payload": {"state": "publicado"},
            },
            self.headers,
        )
        self.assertEqual(res.status_code, 200)
        self.db.expire_all()
        self.assertEqual(self.page.state.value, "publicado")

    def test_set_state_invalid_value(self):
        res = self._action(
            {
                "project_id": self.project.id,
                "page_id": self.page.id,
                "action": "set_state",
                "payload": {"state": "inventado"},
            },
            self.headers,
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.json())
        self.db.expire_all()
        self.assertEqual(self.page.state.value, "borrador")
        self.assertEqual(self._logs(), [])

    def test_save_external_data(self):
        res = self._action(
            {
                "project_id": self.project.id,
                "page_id": self.page.id,
                "action": "save_external_data",
                "payload": {"data": {"notion_id": "abc123", "score": 9}},
            },
            self.headers,
        )
        self.assertEqual(res.status_code, 200)
        self.db.expire_all()
        self.assertTrue(self.page.execution_notes.startswith("external:"))
        stored = json.loads(self.page.execution_notes[len("external:"):])
        self.assertEqual(stored, {"notion_id": "abc123", "score": 9})

    def test_invalid_action(self):
        res = self._action(
            {
                "project_id": self.project.id,
                "page_id": self.page.id,
                "action": "borrar_todo",
                "payload": {},
            },
            self.headers,
        )
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()["success"])

    def test_unknown_page_and_project(self):
        res = self._action(
            {
                "project_id": self.project.id,
                "page_id": 9999,
                "action": "set_priority",
                "payload": {"priority": 1},
            },
            self.headers,
        )
        self.assertEqual(res.status_code, 404)

        res = self._action(
            {
                "project_id": 9999,
                "page_id": self.page.id,
                "action": "set_priority",
                "payload": {"priority": 1},
            },
            self.headers,
        )
        self.assertEqual(res.status_code, 404)

    def test_actions_also_work_with_cookie_auth(self):
        res = self._action(
            {
                "project_id": self.project.id,
                "page_id": self.page.id,
                "action": "set_priority",
                "payload": {"priority": 5},
            }
        )
        self.assertEqual(res.status_code, 200)
        self.db.expire_all()
        self.assertEqual(self.page.priority, 5)

    def test_actions_require_auth(self):
        anonymous = TestClient(app)
        res = anonymous.post(
            f"{API_PREFIX}/external/actions",
            json={
                "project_id": self.project.id,
                "page_id": self.page.id,
                "action": "set_priority",
                "payload": {"priority": 1},
            },
        )
        self.assertEqual(res.status_code, 401)
