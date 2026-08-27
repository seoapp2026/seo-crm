import io
import unittest
import zipfile
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.seed_phase2 import seed_phase2


class TestFullPhase25E2E(unittest.TestCase):
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

    def test_complete_phase25_end_to_end_journey(self):
        # 1. Project & Niche with layout rules
        p_res = self.client.post(f"{API_PREFIX}/projects", json={"name": "Aspiradoras Pro 2026"})
        self.assertEqual(p_res.status_code, 201)
        project_id = p_res.json()["id"]

        n_res = self.client.post(
            f"{API_PREFIX}/niches",
            json={
                "project_id": project_id,
                "name": "Aspiradoras Sin Cable",
                "layout_template_text": "Plantilla Divi: Encabezados H2 modernos, tabla comparativa, pros y contras.",
            },
        )
        self.assertEqual(n_res.status_code, 201)
        niche_id = n_res.json()["id"]

        # 2. Create Silo Pages (W2)
        pillar_res = self.client.post(
            f"{API_PREFIX}/pages",
            json={
                "project_id": project_id,
                "niche_id": niche_id,
                "title": "Guía Definitiva de Aspiradoras Sin Cable",
                "h1": "Las Mejores Aspiradoras Sin Cable de 2026",
                "type": "TSG",
            },
        )
        self.assertEqual(pillar_res.status_code, 201)
        pillar_id = pillar_res.json()["id"]

        child_res = self.client.post(
            f"{API_PREFIX}/pages",
            json={
                "project_id": project_id,
                "niche_id": niche_id,
                "parent_page_id": pillar_id,
                "title": "Dyson V15 Detect Opiniones",
                "h1": "Review y Opiniones Dyson V15 Detect",
                "type": "TSA",
            },
        )
        self.assertEqual(child_res.status_code, 201)
        child_id = child_res.json()["id"]

        # 3. Keywords auto-intent tagging and clustering (W6)
        kw1_res = self.client.post(
            f"{API_PREFIX}/keywords",
            json={
                "project_id": project_id,
                "niche_id": niche_id,
                "page_id": pillar_id,
                "term": "mejores aspiradoras sin cable",
                "is_primary": True,
            },
        )
        self.assertEqual(kw1_res.status_code, 201)

        kw2_res = self.client.post(
            f"{API_PREFIX}/keywords",
            json={
                "project_id": project_id,
                "niche_id": niche_id,
                "page_id": child_id,
                "term": "comprar aspiradora dyson v15",
                "is_primary": True,
            },
        )
        self.assertEqual(kw2_res.status_code, 201)

        tag_res = self.client.post(f"{API_PREFIX}/keywords/auto-tag-intent", json={"project_id": project_id})
        self.assertEqual(tag_res.status_code, 200)
        self.assertTrue(tag_res.json()["updated_count"] >= 2)

        # 4. Dynamic Prompt & Context preview (W1 + W4)
        ctx_res = self.client.post(
            f"{API_PREFIX}/ai/assistants/preview-context",
            json={"project_id": project_id, "page_id": child_id, "prompt_id": 1},
        )
        self.assertEqual(ctx_res.status_code, 200)
        self.assertEqual(ctx_res.json()["resolved_entities"]["parent_page"], "Guía Definitiva de Aspiradoras Sin Cable")

        # 5. Competitor Scraper & Comparison Table (W7)
        comp_html = """
        <html>
          <head><title>Top Aspiradoras 2026</title></head>
          <body>
            <h1>Comparativa Aspiradoras</h1>
            <h2>1. Dyson V15 Absolute</h2>
            <h2>2. Cecotec Conga RockStar</h2>
          </body>
        </html>
        """
        scrape_res = self.client.post(
            f"{API_PREFIX}/competitors/scrape-structure",
            json={"project_id": project_id, "raw_html": comp_html},
        )
        self.assertEqual(scrape_res.status_code, 200)
        self.assertEqual(len(scrape_res.json()["detected_products"]), 2)

        table_res = self.client.post(
            f"{API_PREFIX}/competitors/generate-comparison-table",
            json={
                "products": [
                    {
                        "name": "Dyson V15 Detect",
                        "brand": "Dyson",
                        "badge": "Nuestra Elección ⭐",
                        "price": "699,00 €",
                        "rating": "4.9/5",
                        "pros": ["Láser detector", "Potencia descomunal"],
                        "cons": ["Precio alto"],
                        "specs": {"Autonomía": "60 min", "Potencia": "240 AW"},
                        "cta_text": "Ver en Amazon",
                        "affiliate_url": "https://amazon.es/dyson-v15",
                    }
                ],
                "target_page_id": child_id,
            },
        )
        self.assertEqual(table_res.status_code, 200)
        self.assertIn("seo-comparison-wrapper", table_res.json()["html_table"])

        # 6. Rank Math Bulk Sync & Export (W8)
        sync_res = self.client.post(
            f"{API_PREFIX}/rank-math/bulk-sync-metas",
            json={"project_id": project_id, "title_suffix": " | Aspiradoras"},
        )
        self.assertEqual(sync_res.status_code, 200)
        self.assertEqual(sync_res.json()["updated_titles_count"], 2)

        rm_export_res = self.client.get(f"{API_PREFIX}/rank-math/export/csv?project_id={project_id}")
        self.assertEqual(rm_export_res.status_code, 200)
        self.assertIn("rank_math_title", rm_export_res.text)

        # 7. Bulk Grid Update (W9)
        bulk_update_res = self.client.post(
            f"{API_PREFIX}/pages/bulk-update",
            json={
                "project_id": project_id,
                "pages": [
                    {"id": pillar_id, "export_ready": True, "state": "publicado"},
                    {"id": child_id, "export_ready": True, "state": "publicado"},
                ],
            },
        )
        self.assertEqual(bulk_update_res.status_code, 200)
        self.assertEqual(bulk_update_res.json()["updated_count"], 2)

        # 8. WordPress Full ZIP Export (W5)
        zip_res = self.client.get(f"{API_PREFIX}/wordpress/export/zip?project_id={project_id}")
        self.assertEqual(zip_res.status_code, 200)
        zf = zipfile.ZipFile(io.BytesIO(zip_res.content))
        self.assertIn("import_all_pages.csv", zf.namelist())


if __name__ == "__main__":
    unittest.main()