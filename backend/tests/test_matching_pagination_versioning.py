"""WP4 (canonical matching + url_id en sync GSC), WP7 (paginación) y WP8 (/v1 + updated_at)."""

import datetime as dt
import unittest
from unittest import mock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import (
    AnalyticsData,
    GscData,
    GoogleAuth,
    GoogleServiceType,
    Niche,
    Page,
    Project,
    Url,
)


class TestMatchingPaginationVersioning(unittest.TestCase):
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
            wp_url="https://tiendacamping.example.com",
            gsc_site_url="https://tiendacamping.example.com",
        )
        self.db.add(self.project)
        self.db.commit()

        self.niche = Niche(project_id=self.project.id, name="Tiendas")
        self.db.add(self.niche)
        self.db.commit()

        # Página con canonical explícito
        self.page_canonical = Page(
            project_id=self.project.id,
            niche_id=self.niche.id,
            title="Tiendas Ultraligeras",
            type="TSG",
            canonical_url="https://tiendacamping.example.com/tiendas-ultraligeras",
        )
        # Página sin canonical: el matching cae a wp_url + slug
        self.page_slug = Page(
            project_id=self.project.id,
            niche_id=self.niche.id,
            title="Sacos de Dormir",
            type="TSG",
        )
        # Página sin canonical ni urls: no resuelve clave
        self.page_orphan = Page(
            project_id=self.project.id,
            niche_id=self.niche.id,
            title="Página Huérfana",
            type="TSG",
        )
        self.db.add_all([self.page_canonical, self.page_slug, self.page_orphan])
        self.db.commit()

        self.url_canonical = Url(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.page_canonical.id,
            slug="/tiendas-ultraligeras",
        )
        self.url_slug = Url(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.page_slug.id,
            slug="/sacos-de-dormir",
        )
        self.db.add_all([self.url_canonical, self.url_slug])
        self.db.commit()

        self.db.add_all([
            GscData(
                project_id=self.project.id,
                page_url="https://tiendacamping.example.com/tiendas-ultraligeras",
                date="2026-09-10",
                impressions=100,
                clicks=10,
            ),
            GscData(
                project_id=self.project.id,
                page_url="https://tiendacamping.example.com/sacos-de-dormir/",
                date="2026-09-11",
                impressions=50,
                clicks=5,
            ),
            GscData(
                project_id=self.project.id,
                page_url="https://tiendacamping.example.com/otra-cosa",
                date="2026-09-11",
                impressions=999,
                clicks=99,
            ),
            AnalyticsData(
                project_id=self.project.id,
                page_path="/tiendas-ultraligeras",
                date="2026-09-10",
                sessions=30,
                users=25,
            ),
            AnalyticsData(
                project_id=self.project.id,
                page_path="/sacos-de-dormir",
                date="2026-09-11",
                sessions=15,
                users=12,
            ),
        ])
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

    def test_get_page_by_id(self):
        resp = self.client.get(f"{API_PREFIX}/pages/{self.page_canonical.id}")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["id"], self.page_canonical.id)
        self.assertEqual(body["canonical_url"], "https://tiendacamping.example.com/tiendas-ultraligeras")
        self.assertIn("created_at", body)
        self.assertIn("updated_at", body)

    def test_get_page_by_id_not_found(self):
        resp = self.client.get(f"{API_PREFIX}/pages/999999")
        self.assertEqual(resp.status_code, 404)
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    # ── WP4: by-page ────────────────────────────────────────────────────────

    def test_gsc_by_page_canonical(self):
        res = self.client.get(f"{API_PREFIX}/gsc/by-page", params={"page_id": self.page_canonical.id})
        self.assertEqual(res.status_code, 200)
        rows = res.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["page_url"], "https://tiendacamping.example.com/tiendas-ultraligeras")
        self.assertEqual(rows[0]["clicks"], 10)

    def test_gsc_by_page_slug_fallback_and_trailing_slash(self):
        # Sin canonical: clave = wp_url + slug; el dato GSC tiene barra final
        res = self.client.get(f"{API_PREFIX}/gsc/by-page", params={"page_id": self.page_slug.id})
        self.assertEqual(res.status_code, 200)
        rows = res.json()
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["page_url"].endswith("/sacos-de-dormir/"))

    def test_gsc_by_page_date_filter(self):
        res = self.client.get(
            f"{API_PREFIX}/gsc/by-page",
            params={"page_id": self.page_canonical.id, "from": "2026-09-11"},
        )
        self.assertEqual(res.json(), [])

    def test_analytics_by_page_matches_page_path(self):
        # La canonical absoluta también matchea page_path relativo (parte de ruta)
        res = self.client.get(f"{API_PREFIX}/analytics/by-page", params={"page_id": self.page_canonical.id})
        self.assertEqual(res.status_code, 200)
        rows = res.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["page_path"], "/tiendas-ultraligeras")
        self.assertEqual(rows[0]["sessions"], 30)

    def test_analytics_by_page_slug_fallback(self):
        # Sin canonical: clave = wp_url + slug; page_path de GA4 es relativo
        res = self.client.get(f"{API_PREFIX}/analytics/by-page", params={"page_id": self.page_slug.id})
        self.assertEqual(res.status_code, 200)
        rows = res.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["page_path"], "/sacos-de-dormir")

    def test_by_page_unknown_page_404(self):
        res = self.client.get(f"{API_PREFIX}/gsc/by-page", params={"page_id": 99999})
        self.assertEqual(res.status_code, 404)
        res = self.client.get(f"{API_PREFIX}/analytics/by-page", params={"page_id": 99999})
        self.assertEqual(res.status_code, 404)

    def test_by_page_unmatched_page_empty(self):
        res = self.client.get(f"{API_PREFIX}/gsc/by-page", params={"page_id": self.page_orphan.id})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), [])
        res = self.client.get(f"{API_PREFIX}/analytics/by-page", params={"page_id": self.page_orphan.id})
        self.assertEqual(res.json(), [])

    # ── WP4: sync GSC rellena url_id ─────────────────────────────────────────

    def _run_gsc_sync(self, rows):
        auth = GoogleAuth(
            project_id=self.project.id,
            service=GoogleServiceType.gsc,
            account_email="seo@example.com",
            refresh_token="enc-token",
        )
        self.db.add(auth)
        self.db.commit()

        fake_service = mock.MagicMock()
        fake_service.searchanalytics.return_value.query.return_value.execute.return_value = {"rows": rows}
        with (
            mock.patch("app.services.gsc_sync.build", return_value=fake_service),
            mock.patch("app.services.gsc_sync.credentials_from_auth", return_value=mock.MagicMock()),
            mock.patch("app.services.gsc_sync.save_credentials"),
            mock.patch("app.services.gsc_sync.validate_gsc_site_access"),
            mock.patch("app.services.gsc_sync.read_secret", return_value="token"),
            mock.patch("app.services.gsc_sync.resolve_gsc_site", return_value="https://tiendacamping.example.com"),
        ):
            from app.services.gsc_sync import sync_gsc_for_project

            return sync_gsc_for_project(self.db, self.project.id)

    def test_gsc_sync_fills_url_id_when_matched(self):
        count = self._run_gsc_sync([
            {"keys": ["2026-09-12", "https://tiendacamping.example.com/tiendas-ultraligeras"],
             "impressions": 80, "clicks": 8, "ctr": 0.1, "position": 3.2},
            {"keys": ["2026-09-12", "https://sin-match.example.com/nada"],
             "impressions": 10, "clicks": 1, "ctr": 0.1, "position": 9.0},
        ])
        self.assertEqual(count, 2)
        matched = (
            self.db.query(GscData)
            .filter(GscData.page_url == "https://tiendacamping.example.com/tiendas-ultraligeras", GscData.date == "2026-09-12")
            .one()
        )
        self.assertEqual(matched.url_id, self.url_canonical.id)
        unmatched = (
            self.db.query(GscData)
            .filter(GscData.page_url == "https://sin-match.example.com/nada")
            .one()
        )
        self.assertIsNone(unmatched.url_id)

    def test_gsc_sync_updates_existing_row_url_id(self):
        existing = (
            self.db.query(GscData)
            .filter(GscData.page_url == "https://tiendacamping.example.com/tiendas-ultraligeras", GscData.date == "2026-09-10")
            .one()
        )
        self.assertIsNone(existing.url_id)
        self._run_gsc_sync([
            {"keys": ["2026-09-10", "https://tiendacamping.example.com/tiendas-ultraligeras"],
             "impressions": 120, "clicks": 12, "ctr": 0.1, "position": 2.0},
        ])
        self.db.refresh(existing)
        self.assertEqual(existing.url_id, self.url_canonical.id)
        self.assertEqual(existing.clicks, 12)

    # ── WP7: paginación ──────────────────────────────────────────────────────

    def _seed_pages(self, n: int):
        pages = [
            Page(project_id=self.project.id, niche_id=self.niche.id, title=f"Página {i}", type="TSG")
            for i in range(n)
        ]
        self.db.add_all(pages)
        self.db.commit()

    def test_pagination_limit_and_total_header(self):
        self._seed_pages(15)
        res = self.client.get(f"{API_PREFIX}/pages", params={"project_id": self.project.id, "limit": 10})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 10)
        self.assertEqual(res.headers["X-Total-Count"], "18")  # 3 iniciales + 15
        self.assertEqual(res.headers["X-Limit"], "10")
        self.assertEqual(res.headers["X-Skip"], "0")

    def test_pagination_skip(self):
        self._seed_pages(15)
        res = self.client.get(
            f"{API_PREFIX}/pages", params={"project_id": self.project.id, "skip": 10, "limit": 10}
        )
        self.assertEqual(len(res.json()), 8)
        self.assertEqual(res.headers["X-Total-Count"], "18")
        self.assertEqual(res.headers["X-Skip"], "10")

    def test_pagination_default_returns_first_page(self):
        self._seed_pages(15)
        res = self.client.get(f"{API_PREFIX}/pages", params={"project_id": self.project.id})
        self.assertEqual(len(res.json()), 18)  # por debajo del límite por defecto (200)
        self.assertEqual(res.headers["X-Total-Count"], "18")
        self.assertEqual(res.headers["X-Limit"], "200")

    def test_pagination_limit_capped(self):
        res = self.client.get(f"{API_PREFIX}/pages", params={"limit": 5000})
        self.assertEqual(res.status_code, 422)

    def test_pagination_on_projects(self):
        self.db.add(Project(name="Otro proyecto"))
        self.db.commit()
        res = self.client.get(f"{API_PREFIX}/projects", params={"limit": 1})
        self.assertEqual(len(res.json()), 1)
        self.assertEqual(res.headers["X-Total-Count"], "2")

    def test_pagination_gsc_data_keeps_5000_cap(self):
        res = self.client.get(f"{API_PREFIX}/gsc/data", params={"limit": 10})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 3)  # las 3 filas GSC del setUp caben en la página
        self.assertEqual(res.headers["X-Total-Count"], "3")
        # skip funciona
        res = self.client.get(f"{API_PREFIX}/gsc/data", params={"skip": 2, "limit": 10})
        self.assertEqual(len(res.json()), 1)
        # el cap sigue siendo 5000: limit por encima se rechaza
        res = self.client.get(f"{API_PREFIX}/gsc/data", params={"limit": 5001})
        self.assertEqual(res.status_code, 422)

    # ── WP8: versionado /v1 ──────────────────────────────────────────────────

    def test_v1_health(self):
        res = self.client.get(f"{API_PREFIX}/v1/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

    def test_v1_projects_and_pages_match_unversioned(self):
        plain = self.client.get(f"{API_PREFIX}/projects")
        v1 = self.client.get(f"{API_PREFIX}/v1/projects")
        self.assertEqual(v1.status_code, 200)
        self.assertEqual(v1.json(), plain.json())

        plain = self.client.get(f"{API_PREFIX}/pages", params={"project_id": self.project.id})
        v1 = self.client.get(f"{API_PREFIX}/v1/pages", params={"project_id": self.project.id})
        self.assertEqual(v1.status_code, 200)
        self.assertEqual(v1.json(), plain.json())

    def test_v1_gsc_by_page(self):
        res = self.client.get(f"{API_PREFIX}/v1/gsc/by-page", params={"page_id": self.page_canonical.id})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 1)

    # ── WP8: updated_at en Page ──────────────────────────────────────────────

    def test_page_updated_at_set_on_patch(self):
        self.db.refresh(self.page_canonical)
        self.assertIsNotNone(self.page_canonical.updated_at)
        before = self.page_canonical.updated_at
        res = self.client.patch(
            f"{API_PREFIX}/pages/{self.page_canonical.id}", json={"title": "Nuevo título"}
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIsNotNone(body["updated_at"])
        self.db.refresh(self.page_canonical)
        after = self.page_canonical.updated_at
        self.assertGreaterEqual(after, before)

    def test_page_updated_at_bumped_by_external_action(self):
        self.db.refresh(self.page_slug)
        before = self.page_slug.updated_at
        res = self.client.post(
            f"{API_PREFIX}/external/actions",
            json={
                "project_id": self.project.id,
                "page_id": self.page_slug.id,
                "action": "set_priority",
                "payload": {"priority": 5},
            },
        )
        self.assertEqual(res.status_code, 200)
        self.db.refresh(self.page_slug)
        self.assertGreaterEqual(self.page_slug.updated_at, before)


if __name__ == "__main__":
    unittest.main()
