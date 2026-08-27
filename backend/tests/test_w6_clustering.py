import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import Intent, Keyword, Niche, Page, PageType, Project
from app.seed_phase2 import seed_phase2


class TestW6Clustering(unittest.TestCase):
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

        # Create project and niche
        self.project = Project(name="Mundo Café")
        self.db.add(self.project)
        self.db.commit()

        self.niche = Niche(
            project_id=self.project.id,
            name="Cafeteras Espresso",
            topic="Cafeteras manuales y automáticas",
        )
        self.db.add(self.niche)
        self.db.commit()

        self.initial_page = Page(
            project_id=self.project.id,
            niche_id=self.niche.id,
            title="Cafeteras en General",
            type=PageType.TSG,
        )
        self.db.add(self.initial_page)
        self.db.commit()

        # Add keywords with initial unclassified/informational intent
        self.kw1 = Keyword(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.initial_page.id,
            term="como descalcificar cafetera delonghi",
            intent=Intent.informacional,
        )
        self.kw2 = Keyword(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.initial_page.id,
            term="mejores cafeteras delonghi dedica",
            intent=Intent.informacional,
        )
        self.kw3 = Keyword(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.initial_page.id,
            term="comprar delonghi dedica barata amazon",
            intent=Intent.informacional,
        )
        self.kw4 = Keyword(
            project_id=self.project.id,
            niche_id=self.niche.id,
            page_id=self.initial_page.id,
            term="opiniones delonghi dedica ec685",
            intent=Intent.informacional,
        )
        self.db.add_all([self.kw1, self.kw2, self.kw3, self.kw4])
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

    def test_auto_tag_intent(self):
        res = self.client.post(f"{API_PREFIX}/keywords/auto-tag-intent", json={
            "project_id": self.project.id,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["updated_count"], 4)
        self.assertGreaterEqual(data["informational_count"], 1)
        self.assertGreaterEqual(data["commercial_count"], 1)
        self.assertGreaterEqual(data["transactional_count"], 1)

        # Check in DB
        db_kw1 = self.db.get(Keyword, self.kw1.id)
        db_kw2 = self.db.get(Keyword, self.kw2.id)
        db_kw3 = self.db.get(Keyword, self.kw3.id)
        self.assertEqual(db_kw1.intent, Intent.informacional)
        self.assertEqual(db_kw2.intent, Intent.comercial)
        self.assertEqual(db_kw3.intent, Intent.transaccional)

    def test_suggest_clusters(self):
        # Auto tag first
        self.client.post(f"{API_PREFIX}/keywords/auto-tag-intent", json={
            "project_id": self.project.id,
        })

        res = self.client.post(f"{API_PREFIX}/keywords/suggest-clusters", json={
            "project_id": self.project.id,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_keywords_analyzed"], 4)
        self.assertGreaterEqual(data["clusters_count"], 1)

        # Check cluster fields
        multi_kw_cluster = next((cl for cl in data["clusters"] if len(cl["keyword_ids"]) >= 2), None)
        self.assertIsNotNone(multi_kw_cluster)
        self.assertIn("Delonghi", multi_kw_cluster["cluster_name"])
        self.assertTrue(len(multi_kw_cluster["suggested_title"]) > 5)
        self.assertTrue(len(multi_kw_cluster["suggested_h1"]) > 5)

    def test_apply_clusters_creates_pages_and_links_keywords(self):
        # Auto tag first
        self.client.post(f"{API_PREFIX}/keywords/auto-tag-intent", json={
            "project_id": self.project.id,
        })

        suggest_res = self.client.post(f"{API_PREFIX}/keywords/suggest-clusters", json={
            "project_id": self.project.id,
        })
        clusters = suggest_res.json()["clusters"]
        self.assertTrue(len(clusters) >= 1)

        apply_payload = {
            "project_id": self.project.id,
            "clusters": [
                {
                    "cluster_name": c["cluster_name"],
                    "focus_keyword_id": c["keyword_ids"][0],
                    "keyword_ids": c["keyword_ids"],
                    "title": c["suggested_title"],
                    "h1": c["suggested_h1"],
                    "type": c["suggested_type"],
                    "niche_id": self.niche.id,
                }
                for c in clusters
            ]
        }

        res = self.client.post(f"{API_PREFIX}/keywords/apply-clusters", json=apply_payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["created_pages_count"], 1)
        self.assertEqual(data["linked_keywords_count"], 4)

        # Verify created pages exist in DB
        self.assertTrue(len(data["created_page_ids"]) >= 1)
        created_p = self.db.get(Page, data["created_page_ids"][0])
        self.assertIsNotNone(created_p)
        self.assertEqual(created_p.niche_id, self.niche.id)

        # Verify keywords are linked and focus keyword is primary
        kws = self.db.query(Keyword).filter(Keyword.page_id == created_p.id).all()
        self.assertTrue(len(kws) >= 1)
        primary_kws = [k for k in kws if k.is_primary]
        self.assertEqual(len(primary_kws), 1)


if __name__ == "__main__":
    unittest.main()
