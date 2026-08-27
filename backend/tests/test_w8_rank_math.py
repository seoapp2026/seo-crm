import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import Keyword, Page, PageType, Project, Url
from app.seed_phase2 import seed_phase2


class TestW8RankMath(unittest.TestCase):
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

        self.project = Project(name="Cafeteras Top")
        self.db.add(self.project)
        self.db.commit()

        self.page1 = Page(
            project_id=self.project.id,
            niche_id=1,
            title="Cafetera DeLonghi Dedica",
            h1="Cafetera DeLonghi Dedica EC685 Manual",
            type=PageType.TSA,
        )
        self.db.add(self.page1)
        self.db.commit()

        self.url1 = Url(
            project_id=self.project.id,
            niche_id=1,
            page_id=self.page1.id,
            slug="/delonghi-dedica",
        )
        self.db.add(self.url1)

        self.kw1 = Keyword(
            project_id=self.project.id,
            niche_id=1,
            page_id=self.page1.id,
            term="delonghi dedica opiniones",
            is_primary=True,
        )
        self.db.add(self.kw1)
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

    def test_export_rank_math_csv(self):
        res = self.client.get(f"{API_PREFIX}/rank-math/export/csv?project_id={self.project.id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "text/csv; charset=utf-8")
        text = res.text
        self.assertTrue(text.startswith("\ufeff"))
        self.assertIn("rank_math_title", text)
        self.assertIn("rank_math_focus_keyword", text)
        self.assertIn("delonghi dedica opiniones", text)
        self.assertIn("/delonghi-dedica", text)

    def test_bulk_sync_rank_math_metas(self):
        res = self.client.post(
            f"{API_PREFIX}/rank-math/bulk-sync-metas",
            json={
                "project_id": self.project.id,
                "title_suffix": " | Mundo Café",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["analyzed_count"], 1)
        self.assertEqual(data["updated_titles_count"], 1)
        self.assertEqual(data["updated_descriptions_count"], 1)

        # Check in DB
        db_p = self.db.get(Page, self.page1.id)
        self.assertIsNotNone(db_p.seo_title)
        self.assertIsNotNone(db_p.seo_description)
        self.assertTrue(len(db_p.seo_title) <= 60)
        self.assertTrue(len(db_p.seo_description) <= 160)
        self.assertIn("Mundo Café", db_p.seo_title)

    def test_import_rank_math_csv(self):
        csv_payload = f"""id,slug,title,h1,rank_math_title,rank_math_description,rank_math_focus_keyword
{self.page1.id},/delonghi-dedica,Cafetera DeLonghi Dedica,H1 Actualizado RankMath,DeLonghi Dedica: Review 2026,La mejor cafetera express para baristas en casa.,delonghi dedica precio
"""
        res = self.client.post(
            f"{API_PREFIX}/rank-math/import/csv",
            json={
                "project_id": self.project.id,
                "csv_content": csv_payload,
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["updated_count"], 1)

        # Verify DB updated
        db_p = self.db.get(Page, self.page1.id)
        self.assertEqual(db_p.seo_title, "DeLonghi Dedica: Review 2026")
        self.assertEqual(db_p.seo_description, "La mejor cafetera express para baristas en casa.")
        self.assertEqual(db_p.h1, "H1 Actualizado RankMath")

        # Focus keyword updated
        primary_kw = (
            self.db.query(Keyword)
            .filter(Keyword.page_id == self.page1.id, Keyword.is_primary.is_(True))
            .first()
        )
        self.assertIsNotNone(primary_kw)
        self.assertEqual(primary_kw.term, "delonghi dedica precio")


if __name__ == "__main__":
    unittest.main()