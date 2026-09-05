import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import Keyword, Niche, Page, Project, Url


class TestStructureImport(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = self.Session()

        p = Project(name="Test Silo Project")
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

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_import_structure_csv_with_parent_silos_and_keywords(self):
        csv_sample = """title,slug,niche_name,parent_slug,page_type,h1,seo_title,seo_description,focus_keyword
Cafeteras Espresso,/cafeteras-espresso,Cafeteras,,TSG,Guía Completa de Cafeteras Espresso,Mejores Cafeteras Espresso 2026,Comparativa y análisis de cafeteras espresso,cafeteras espresso
Cafeteras Superautomáticas,/cafeteras-espresso/superautomaticas,Cafeteras,/cafeteras-espresso,TSR,Mejores Cafeteras Superautomáticas,Cafeteras Superautomáticas Top,Guía de compra de cafeteras con molinillo,cafeteras superautomaticas
Cafeteras Manuales,/cafeteras-espresso/manuales,Cafeteras,/cafeteras-espresso,TSR,Cafeteras Manuales para Baristas,Cafeteras Manuales Profesionales,Análisis de cafeteras de brazo manual,cafeteras manuales
Robot Aspirador Cecotec,/aspiradoras/cecotec,Aspiradoras,,TSA,Análisis Cecotec Conga,Opiniones Cecotec Conga 2026,Review detallada con pros y contras,robot aspirador cecotec
"""
        resp = self.client.post(
            f"{API_PREFIX}/projects/import-structure",
            json={
                "project_id": self.project_id,
                "csv_content": csv_sample,
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["niches_created"], 2)  # Cafeteras, Aspiradoras
        self.assertEqual(data["pages_created"], 4)
        self.assertEqual(data["urls_created"], 4)
        self.assertEqual(data["silos_linked"], 2)  # 2 children linked to /cafeteras-espresso
        self.assertEqual(data["keywords_linked"], 4)
        self.assertEqual(len(data["errors"]), 0)

        # Verify DB hierarchy
        parent_page = self.db.query(Page).filter(Page.title == "Cafeteras Espresso").first()
        child1 = self.db.query(Page).filter(Page.title == "Cafeteras Superautomáticas").first()
        child2 = self.db.query(Page).filter(Page.title == "Cafeteras Manuales").first()

        self.assertIsNotNone(parent_page)
        self.assertIsNone(parent_page.parent_page_id)
        self.assertEqual(child1.parent_page_id, parent_page.id)
        self.assertEqual(child2.parent_page_id, parent_page.id)

        # Verify Focus Keywords
        kws = self.db.query(Keyword).filter(Keyword.project_id == self.project_id).all()
        self.assertEqual(len(kws), 4)
        for kw in kws:
            self.assertTrue(kw.is_primary)

    def test_import_structure_json_items(self):
        items = [
            {
                "title": "Smartphones Gama Alta",
                "slug": "/smartphones/gama-alta",
                "niche_name": "Móviles",
                "page_type": "TSG",
                "h1": "Los Mejores Móviles Top",
                "focus_keyword": "mejores moviles",
            }
        ]
        resp = self.client.post(
            f"{API_PREFIX}/projects/import-structure",
            json={
                "project_name": "Nuevo Proyecto Tech",
                "items": items,
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["project_name"], "Nuevo Proyecto Tech")
        self.assertEqual(data["pages_created"], 1)
        self.assertEqual(data["keywords_linked"], 1)

    def test_import_structure_json_hierarchy_resolves_parents(self):
        import json as jsonlib

        rows = [
            {
                "title": "Cafeteras Espresso",
                "slug": "/cafeteras-espresso",
                "niche_name": "Cafeteras",
                "page_type": "TSG",
                "focus_keyword": "cafeteras espresso",
            },
            {
                "title": "Cafeteras Superautomáticas",
                "slug": "/cafeteras-espresso/superautomaticas",
                "niche_name": "Cafeteras",
                "parent_slug": "cafeteras-espresso",
                "page_type": "TSR",
                "focus_keyword": "cafeteras superautomaticas",
            },
            {
                "title": "Cecotec Power Matic",
                "slug": "/cafeteras-espresso/superautomaticas/cecotec",
                "niche_name": "Cafeteras",
                "parent_slug": "/cafeteras-espresso/superautomaticas",
                "page_type": "TSA",
            },
        ]
        resp = self.client.post(
            f"{API_PREFIX}/projects/import-structure",
            json={
                "project_id": self.project_id,
                "json_content": jsonlib.dumps(rows),
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["niches_created"], 1)
        self.assertEqual(data["pages_created"], 3)
        self.assertEqual(data["urls_created"], 3)
        self.assertEqual(data["silos_linked"], 2)
        self.assertEqual(data["keywords_linked"], 2)
        self.assertEqual(len(data["errors"]), 0)

        parent = self.db.query(Page).filter(Page.title == "Cafeteras Espresso").first()
        mid = self.db.query(Page).filter(Page.title == "Cafeteras Superautomáticas").first()
        leaf = self.db.query(Page).filter(Page.title == "Cecotec Power Matic").first()
        self.assertIsNone(parent.parent_page_id)
        self.assertEqual(mid.parent_page_id, parent.id)
        self.assertEqual(leaf.parent_page_id, mid.id)

    def test_import_structure_rejects_csv_and_json_together(self):
        resp = self.client.post(
            f"{API_PREFIX}/projects/import-structure",
            json={
                "project_id": self.project_id,
                "csv_content": "title,slug\nA,/a\n",
                "json_content": '[{"title": "B", "slug": "/b"}]',
            },
        )
        self.assertEqual(resp.status_code, 422)

    def test_import_structure_rejects_missing_content(self):
        resp = self.client.post(
            f"{API_PREFIX}/projects/import-structure",
            json={"project_id": self.project_id},
        )
        self.assertEqual(resp.status_code, 422)
