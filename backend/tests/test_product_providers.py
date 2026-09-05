import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import Product, Project
from app.services.product_providers import (
    AmazonCreatorsProvider,
    BaseProductProvider,
    EbayBrowseProvider,
    ProductProviderRegistry,
    ProviderError,
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
        # Unconfigured provider -> documented demo mode (is_stub fixtures)
        self.assertTrue(data["is_stub"])
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
        self.assertTrue(data["is_stub"])
        self.assertGreaterEqual(len(data["results"]), 1)
        first = data["results"][0]
        self.assertEqual(first["provider"], "ebay")
        self.assertTrue(first["external_id"].startswith("v1|"))
        self.assertIn("campid=", first["affiliate_url"])

    def test_search_all_providers_unconfigured_is_stub(self):
        resp = self.client.post(
            f"{API_PREFIX}/products/search",
            json={"query": "microondas integrable", "provider": "all", "limit": 3},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["is_stub"])

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


AMAZON_LIVE_JSON = {
    "SearchResult": {
        "Items": [
            {
                "ASIN": "B0LIVETEST1",
                "ItemInfo": {
                    "Title": {"DisplayValue": "Cafetera Live Uno"},
                    "ByLineInfo": {"Brand": {"DisplayValue": "MarcaLive"}},
                    "Features": {"DisplayValues": ["15 bares", "Thermoblock", "Depósito 1.1L", "Extra"]},
                },
                "Images": {"Primary": {"Large": {"URL": "https://img.example/x.jpg"}}},
                "Offers": {
                    "Listings": [
                        {
                            "Price": {"Amount": 123.45},
                            "Availability": {"Message": "Sólo quedan 3 en stock", "Type": "Now"},
                            "Condition": {"Value": "New", "DisplayValue": "Nuevo"},
                            "DeliveryInfo": {"IsPrime": True},
                        }
                    ]
                },
                "CustomerReviews": {"StarRating": {"Value": "4.3"}},
            },
            {
                "ASIN": "B0LIVETEST2",
                "ItemInfo": {"Title": {"DisplayValue": "Cafetera Sin Datos"}},
                "Offers": {"Listings": [{}]},
            },
        ]
    }
}

EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token"
EBAY_SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"


class _FakeResponse:
    def __init__(self, status_code=200, json_data=None, text=""):
        self.status_code = status_code
        self._json = json_data or {}
        self.text = text

    def json(self):
        return self._json


class _FakeHttpxClient:
    """Routes calls by URL; can simulate a network failure."""

    def __init__(self, responses=None, raise_on_call=False):
        self.responses = responses or {}
        self.raise_on_call = raise_on_call

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def _resolve(self, url):
        if self.raise_on_call:
            raise ConnectionError("vendor unreachable")
        return self.responses[url]

    def post(self, url, **kwargs):
        return self._resolve(url)

    def get(self, url, **kwargs):
        return self._resolve(url)


class TestProviderFailClosed(unittest.TestCase):
    """W8 rules: configured+failing => ProviderError/502; unconfigured => is_stub demo."""

    SETTINGS_KEYS = (
        "amazon_paapi_access_key",
        "amazon_paapi_secret_key",
        "amazon_paapi_partner_tag",
        "ebay_app_id",
        "ebay_cert_id",
    )

    def setUp(self):
        self._orig = {k: getattr(settings, k) for k in self.SETTINGS_KEYS}

    def tearDown(self):
        for k, v in self._orig.items():
            setattr(settings, k, v)

    def _configure_amazon(self):
        settings.amazon_paapi_access_key = "AKIAIOSFODNN7EXAMPLE"
        settings.amazon_paapi_secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        settings.amazon_paapi_partner_tag = "seocrm-21"

    def _configure_ebay(self):
        settings.ebay_app_id = "EXAMPLE-APP-ID"
        settings.ebay_cert_id = "EXAMPLE-CERT-ID"

    def test_unconfigured_provider_returns_stub_demo(self):
        registry = ProductProviderRegistry()
        resp = registry.search("cafetera", provider="amazon", limit=2)
        self.assertTrue(resp.is_stub)
        self.assertGreaterEqual(len(resp.results), 1)

    def test_configured_amazon_failure_raises_provider_error(self):
        self._configure_amazon()
        fake = _FakeHttpxClient(raise_on_call=True)
        with patch("app.services.product_providers.httpx.Client", return_value=fake):
            with self.assertRaises(ProviderError):
                ProductProviderRegistry().search("cafetera", provider="amazon")

    def test_configured_amazon_http_error_raises_provider_error(self):
        self._configure_amazon()
        fake = _FakeHttpxClient(
            responses={"https://webservices.amazon.es/paapi5/searchitems": _FakeResponse(429, text="Too Many Requests")}
        )
        with patch("app.services.product_providers.httpx.Client", return_value=fake):
            with self.assertRaises(ProviderError) as ctx:
                ProductProviderRegistry().search("cafetera", provider="amazon")
        self.assertIn("429", str(ctx.exception))

    def test_configured_amazon_failure_returns_502_via_api(self):
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        db = sessionmaker(bind=engine)()
        p = Project(name="P")
        db.add(p)
        db.commit()

        def override_get_db():
            try:
                yield db
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)
        try:
            self._configure_amazon()
            fake = _FakeHttpxClient(raise_on_call=True)
            with patch("app.services.product_providers.httpx.Client", return_value=fake):
                resp = client.post(
                    f"{API_PREFIX}/products/search",
                    json={"query": "cafetera", "provider": "amazon"},
                )
            self.assertEqual(resp.status_code, 502)
            self.assertIn("proveedor", resp.json()["detail"].lower())
        finally:
            app.dependency_overrides.clear()
            db.close()
            Base.metadata.drop_all(bind=engine)

    def test_configured_ebay_token_failure_raises_provider_error(self):
        self._configure_ebay()
        fake = _FakeHttpxClient(responses={EBAY_TOKEN_URL: _FakeResponse(401, text="Unauthorized")})
        with patch("app.services.product_providers.httpx.Client", return_value=fake):
            with self.assertRaises(ProviderError) as ctx:
                ProductProviderRegistry().search("cafetera", provider="ebay")
        self.assertIn("401", str(ctx.exception))

    def test_amazon_live_uses_real_fields_no_hardcoded_values(self):
        self._configure_amazon()
        fake = _FakeHttpxClient(
            responses={
                "https://webservices.amazon.es/paapi5/searchitems": _FakeResponse(200, json_data=AMAZON_LIVE_JSON)
            }
        )
        with patch("app.services.product_providers.httpx.Client", return_value=fake):
            items = AmazonCreatorsProvider().search("cafetera", limit=5)

        self.assertEqual(len(items), 2)
        full, sparse = items
        # Real values mapped from the PA-API response
        self.assertEqual(full.availability, "Sólo quedan 3 en stock")
        self.assertEqual(full.condition, "New")
        self.assertTrue(full.is_prime)
        self.assertEqual(full.rating, "4.3/5")
        self.assertEqual(full.price, 123.45)
        self.assertEqual(full.brand, "MarcaLive")
        # No data in the response -> None, never invented defaults
        self.assertIsNone(sparse.availability)
        self.assertIsNone(sparse.condition)
        self.assertFalse(sparse.is_prime)
        self.assertIsNone(sparse.rating)
        self.assertIsNone(sparse.price)
        self.assertIsNone(sparse.features)

    def test_ebay_live_never_invents_rating_or_availability(self):
        self._configure_ebay()
        fake = _FakeHttpxClient(
            responses={
                EBAY_TOKEN_URL: _FakeResponse(200, json_data={"access_token": "tok"}),
                EBAY_SEARCH_URL: _FakeResponse(
                    200,
                    json_data={
                        "itemSummaries": [
                            {
                                "itemId": "v1|999888777|0",
                                "title": "Artículo eBay Live",
                                "price": {"value": "55.5"},
                                "condition": "Nuevo",
                                "image": {"imageUrl": "https://img.example/y.jpg"},
                                "itemWebUrl": "https://www.ebay.es/itm/v1|999888777|0",
                            }
                        ]
                    },
                ),
            }
        )
        with patch("app.services.product_providers.httpx.Client", return_value=fake):
            items = EbayBrowseProvider().search("cafetera", limit=5)

        self.assertEqual(len(items), 1)
        item = items[0]
        self.assertIsNone(item.rating)
        self.assertIsNone(item.availability)
        self.assertEqual(item.condition, "Nuevo")
        self.assertEqual(item.price, 55.5)


class _DummyProvider(BaseProductProvider):
    @property
    def provider_id(self) -> str:
        return "dummy"

    @property
    def display_name(self) -> str:
        return "Dummy Provider"

    def is_configured(self) -> bool:
        return True

    def get_marketplace(self) -> str:
        return "TEST"

    def search(self, query: str, limit: int = 10, affiliate_tag: str | None = None):
        return []


class TestProviderRegistryDynamic(unittest.TestCase):
    def test_register_adds_provider_and_is_iterated(self):
        registry = ProductProviderRegistry()
        registry.register(_DummyProvider())

        status_ids = [p.provider for p in registry.get_status().providers]
        self.assertIn("amazon", status_ids)
        self.assertIn("ebay", status_ids)
        self.assertIn("dummy", status_ids)

        resp = registry.search("cafetera", provider="dummy")
        self.assertEqual(resp.provider_used, "dummy")
        self.assertEqual(resp.total_found, 0)
        self.assertFalse(resp.is_stub)

    def test_register_replaces_same_provider_id(self):
        registry = ProductProviderRegistry()
        registry.register(_DummyProvider())
        replacement = _DummyProvider()
        registry.register(replacement)
        self.assertIs(registry.providers["dummy"], replacement)
        self.assertEqual(len(registry.providers), 3)
