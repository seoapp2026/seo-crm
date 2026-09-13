import json
import unittest
from unittest import mock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import Niche, Page, Project, Url


class FakeWpResponse:
    def __init__(self, status_code: int, payload: dict | None = None):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = json.dumps(self._payload)

    def json(self):
        return self._payload


class FakeWpClient:
    """Mínimo compatible con `async with httpx.AsyncClient(...) as client`."""

    def __init__(self, log: list, handler):
        self._log = log
        self._handler = handler

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, json=None, auth=None):
        self._log.append({"method": "POST", "url": url, "json": json})
        return self._handler("POST", url, json)

    async def put(self, url, json=None, auth=None):
        self._log.append({"method": "PUT", "url": url, "json": json})
        return self._handler("PUT", url, json)


WP_LINK = "https://tiendacamping.example.com/tiendas-ultraligeras"


def ok_wp_payload(wp_post_id: int) -> dict:
    return {
        "id": wp_post_id,
        "link": WP_LINK,
        "date_gmt": "2026-09-12T10:00:00",
        "modified_gmt": "2026-09-13T08:30:00",
    }


class TestWpPushUpsert(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = self.Session()

        self.project = Project(
            name="Tienda Camping",
            description="Web de equipamiento de montaña",
            wp_url="https://tiendacamping.example.com",
            wp_username="editor_wp",
            wp_app_password="xxxx-yyyy-zzzz-wwww",
        )
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
            state="publicado",
            content_html="<article><h1>Guía</h1></article>",
        )
        self.db.add(self.page)
        self.db.commit()

        self.db.add(Url(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.page.id,
            slug="/tiendas-ultraligeras",
        ))
        self.db.commit()

        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        self.requests: list[dict] = []

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def _push(self, handler):
        with mock.patch(
            "app.routers.wordpress.httpx.AsyncClient",
            side_effect=lambda *a, **k: FakeWpClient(self.requests, handler),
        ):
            return self.client.post(
                f"{API_PREFIX}/wordpress/push",
                json={"project_id": self.project.id, "page_ids": [self.page.id]},
            )

    def test_create_persists_identity(self):
        def handler(method, url, payload):
            self.assertEqual(method, "POST")
            return FakeWpResponse(201, ok_wp_payload(501))

        res = self._push(handler)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["success_count"], 1)
        item = data["items"][0]
        self.assertEqual(item["page_id"], self.page.id)
        self.assertEqual(item["wp_post_id"], 501)
        self.assertEqual(item["wp_url"], WP_LINK)
        self.assertEqual(item["canonical_url"], WP_LINK)
        self.assertEqual(item["status"], "success")

        self.db.refresh(self.page)
        self.assertEqual(self.page.wordpress_post_id, 501)
        self.assertEqual(self.page.wordpress_url, WP_LINK)
        self.assertEqual(self.page.canonical_url, WP_LINK)
        self.assertIsNotNone(self.page.published_at)

        # WP1: los campos de identidad aparecen en GET /pages
        pages_res = self.client.get(f"{API_PREFIX}/pages?project_id={self.project.id}")
        self.assertEqual(pages_res.status_code, 200)
        row = next(p for p in pages_res.json() if p["id"] == self.page.id)
        self.assertEqual(row["wordpress_post_id"], 501)
        self.assertEqual(row["wordpress_url"], WP_LINK)
        self.assertEqual(row["canonical_url"], WP_LINK)
        self.assertIsNotNone(row["published_at"])

    def test_second_push_updates_and_never_creates(self):
        def create_handler(method, url, payload):
            return FakeWpResponse(201, ok_wp_payload(501))

        first = self._push(create_handler)
        self.assertEqual(first.json()["success_count"], 1)
        self.assertEqual([r["method"] for r in self.requests], ["POST"])

        def update_handler(method, url, payload):
            self.assertEqual(method, "PUT")
            self.assertTrue(url.endswith("/wp-json/wp/v2/pages/501"), url)
            return FakeWpResponse(200, ok_wp_payload(501))

        second = self._push(update_handler)
        self.assertEqual(second.status_code, 200)
        data = second.json()
        self.assertEqual(data["success_count"], 1)
        item = data["items"][0]
        self.assertEqual(item["status"], "success")
        self.assertEqual(item["wp_post_id"], 501)
        self.assertIn("actualizada", item["message"])

        # Solo una llamada de creación en total: la segunda fue un PUT
        methods = [r["method"] for r in self.requests]
        self.assertEqual(methods, ["POST", "PUT"])

        self.db.refresh(self.page)
        self.assertEqual(self.page.wordpress_post_id, 501)

    def test_wp_error_leaves_page_unchanged(self):
        def handler(method, url, payload):
            return FakeWpResponse(500, {"code": "internal_error", "message": "WP caído"})

        res = self._push(handler)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["success_count"], 0)
        self.assertEqual(data["error_count"], 1)
        item = data["items"][0]
        self.assertEqual(item["status"], "error")
        self.assertIn("500", item["message"])

        self.db.refresh(self.page)
        self.assertIsNone(self.page.wordpress_post_id)
        self.assertIsNone(self.page.wordpress_url)
        self.assertIsNone(self.page.canonical_url)
        self.assertIsNone(self.page.published_at)
