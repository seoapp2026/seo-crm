import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import Product, Project
from app.services.product_providers import (
    AmazonCreatorsProvider,
    EbayBrowseProvider,
    ProductProviderRegistry,
)


class TestProductProviders(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = self.Session()

        p = Project(name="Test Affiliate Project")
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

    def test_providers_status_endpoint(self):
        resp = self.client.get(f"{API_PREFIX}/products/providers")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("providers", data)
        providers = {p["provider"]: p for p in data["providers"]}
        self.assertIn("amazon", providers)
        self.assertIn("ebay", providers)
        self.assertTrue(providers["amazon"]["using_stub"])
        self.assertEqual(providers["amazon"]["partner_tag"], "seocrm-21")

    def test_search_amazon_products(self):
        resp = self.client.post(
            f"{API_PREFIX}/products/search",
            json={"query": "cafetera express", "provider": "amazon", "limit": 4},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["query"], "cafetera express")
        self.assertEqual(data["provider_used"], "amazon")
        self.assertGreaterEqual(len(data["results"]), 1)
        first = data["results"][0]
        self.assertEqual(first["provider"], "amazon")
        self.assertTrue(first["external_id"].startswith("B0"))
        self.assertIn("tag=seocrm-21", first["affiliate_url"])
        self.assertIsNotNone(first["price"])

    def test_search_ebay_products(self):
        resp = self.client.post(
            f"{API_PREFIX}/products/search",
            json={"query": "aspiradora robot", "provider": "ebay", "limit": 3},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["query"], "aspiradora robot")
        self.assertEqual(data["provider_used"], "ebay")
        self.assertGreaterEqual(len(data["results"]), 1)
        first = data["results"][0]
        self.assertEqual(first["provider"], "ebay")
        self.assertTrue(first["external_id"].startswith("v1|"))
        self.assertIn("campid=", first["affiliate_url"])

    def test_search_all_providers(self):
        resp = self.client.post(
            f"{API_PREFIX}/products/search",
            json={"query": "microondas integrable", "provider": "all", "limit": 3},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        providers = {p["provider"] for p in data["results"]}
        self.assertIn("amazon", providers)
        self.assertIn("ebay", providers)

    def test_import_amazon_product_to_catalog(self):
        # 1. Search
        s_resp = self.client.post(
            f"{API_PREFIX}/products/search",
            json={"query": "delonghi dedica", "provider": "amazon", "limit": 1},
        )
        item = s_resp.json()["results"][0]

        # 2. Import
        imp_resp = self.client.post(
            f"{API_PREFIX}/products/import",
            json={
                "project_id": self.project_id,
                "provider": item["provider"],
                "external_id": item["external_id"],
                "name": item["name"],
                "brand": item["brand"],
                "price": item["price"],
                "currency": item["currency"],
                "image_url": item["image_url"],
                "rating": item["rating"],
                "affiliate_url": item["affiliate_url"],
                "features": item["features"],
            },
        )
        self.assertEqual(imp_resp.status_code, 200)
        res_data = imp_resp.json()
        self.assertTrue(res_data["imported"])
        prod = res_data["product"]
        self.assertEqual(prod["provider"], "amazon")
        self.assertEqual(prod["external_id"], item["external_id"])
        self.assertIn("tag=seocrm-21", prod["affiliate_url"])

        # 3. Verify in DB
        db_prod = self.db.query(Product).filter(Product.id == prod["id"]).first()
        self.assertIsNotNone(db_prod)
        self.assertEqual(db_prod.provider, "amazon")

        # 4. Import again -> updates rather than duplicating
        imp_resp2 = self.client.post(
            f"{API_PREFIX}/products/import",
            json={
                "project_id": self.project_id,
                "provider": item["provider"],
                "external_id": item["external_id"],
                "name": item["name"],
                "price": 199.99,
            },
        )
        self.assertEqual(imp_resp2.status_code, 200)
        self.assertFalse(imp_resp2.json()["imported"])
        self.assertEqual(imp_resp2.json()["product"]["id"], prod["id"])
        self.assertEqual(imp_resp2.json()["product"]["price"], 199.99)
