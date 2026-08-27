import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import Page, PageType, Project
from app.seed_phase2 import seed_phase2


class TestW9BulkEdit(unittest.TestCase):
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

        self.project = Project(name="Mundo Espresso")
        self.db.add(self.project)
        self.db.commit()

        self.page1 = Page(
            project_id=self.project.id,
            niche_id=1,
            title="Página 1",
            type=PageType.TSG,
            export_ready=False,
        )
        self.page2 = Page(
            project_id=self.project.id,
            niche_id=1,
            title="Página 2",
            type=PageType.TSR,
            export_ready=False,
        )
        self.db.add_all([self.page1, self.page2])
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
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_bulk_update_pages(self):
        payload = {
            "project_id": self.project.id,
            "pages": [
                {
                    "id": self.page1.id,
                    "title": "Página 1 Editada Masiva",
                    "h1": "H1 Página 1",
                    "seo_title": "Página 1 SEO",
                    "seo_description": "Meta descripción página 1",
                    "export_ready": True,
                    "state": "publicado",
                },
                {
                    "id": self.page2.id,
                    "title": "Página 2 Editada Masiva",
                    "export_ready": True,
                    "parent_page_id": self.page1.id,
                },
            ],
        }

        res = self.client.post(f"{API_PREFIX}/pages/bulk-update", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["updated_count"], 2)

        # Verify DB
        db_p1 = self.db.get(Page, self.page1.id)
        db_p2 = self.db.get(Page, self.page2.id)

        self.assertEqual(db_p1.title, "Página 1 Editada Masiva")
        self.assertEqual(db_p1.h1, "H1 Página 1")
        self.assertEqual(db_p1.seo_title, "Página 1 SEO")
        self.assertTrue(db_p1.export_ready)
        self.assertEqual(db_p1.state, "publicado")

        self.assertEqual(db_p2.title, "Página 2 Editada Masiva")
        self.assertTrue(db_p2.export_ready)
        self.assertEqual(db_p2.parent_page_id, self.page1.id)


if __name__ == "__main__":
    unittest.main()