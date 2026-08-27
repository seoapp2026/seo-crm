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


class TestW7CompetitorComparison(unittest.TestCase):
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

        # Create project and page
        self.project = Project(name="Cafeteras Top")
        self.db.add(self.project)
        self.db.commit()

        self.page = Page(
            project_id=self.project.id,
            niche_id=1,
            title="Mejores Cafeteras Espresso 2026",
            type=PageType.TSR,
        )
        self.db.add(self.page)
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

    def test_generate_comparison_table_html(self):
        payload = {
            "products": [
                {
                    "name": "DeLonghi Dedica EC685",
                    "brand": "DeLonghi",
                    "badge": "Mejor Calidad-Precio ⭐",
                    "price": "189,00 €",
                    "rating": "4.8/5",
                    "pros": ["Diseño ultracompacto", "15 bares de presión", "Calentamiento rápido"],
                    "cons": ["Bandeja de goteo algo pequeña"],
                    "specs": {
                        "Presión": "15 Bares",
                        "Potencia": "1350 W",
                        "Capacidad": "1.1 Litros",
                        "Sistema": "Thermoblock",
                    },
                    "cta_text": "Ver Precio en Amazon",
                    "affiliate_url": "https://amazon.es/dp/B073CRBYNV?tag=seocrm-21",
                },
                {
                    "name": "Cecotec Cafelizzia 790",
                    "brand": "Cecotec",
                    "badge": "Opción Económica",
                    "price": "79,90 €",
                    "rating": "4.3/5",
                    "pros": ["Muy económica", "20 bares de presión", "Manómetro frontal"],
                    "cons": ["Materiales de plástico", "Más ruidosa"],
                    "specs": {
                        "Presión": "20 Bares",
                        "Potencia": "1350 W",
                        "Capacidad": "1.2 Litros",
                        "Sistema": "Thermoblock",
                    },
                    "cta_text": "Ver en Cecotec",
                    "affiliate_url": "https://cecotec.es/cafelizzia",
                }
            ],
            "table_title": "Comparativa Cafeteras Espresso Manuales",
            "show_badges": True,
            "show_pros_cons": True,
            "show_ratings": True,
        }

        res = self.client.post(f"{API_PREFIX}/competitors/generate-comparison-table", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["products_count"], 2)
        self.assertIn("DeLonghi Dedica EC685", data["html_table"])
        self.assertIn("Cecotec Cafelizzia 790", data["html_table"])
        self.assertIn("Mejor Calidad-Precio", data["html_table"])
        self.assertIn("Presión", data["spec_columns"])
        self.assertIn("Potencia", data["spec_columns"])
        self.assertIn("nofollow sponsored", data["html_table"])
        self.assertIn("seo-comparison-cards", data["preview_cards_html"])

    def test_attach_comparison_table_to_page(self):
        payload = {
            "products": [
                {
                    "name": "Philips Serie 2200",
                    "price": "299,00 €",
                    "rating": "4.7/5",
                    "specs": {"Presión": "15 Bares"},
                }
            ],
            "table_title": "Tabla Philips",
            "target_page_id": self.page.id,
        }

        res = self.client.post(f"{API_PREFIX}/competitors/generate-comparison-table", json=payload)
        self.assertEqual(res.status_code, 200)

        # Verify page content updated in DB
        db_page = self.db.get(Page, self.page.id)
        self.assertIsNotNone(db_page.content_html)
        self.assertIn("<!-- TABLA COMPARATIVA SEO CRM - INICIO -->", db_page.content_html)
        self.assertIn("Philips Serie 2200", db_page.content_html)

    def test_scrape_competitor_structure_from_html(self):
        sample_html = """<!DOCTYPE html>
        <html>
        <head>
            <title>Las 7 Mejores Cafeteras Superautomáticas de 2026</title>
            <meta name="description" content="Guía y comparativa definitiva para comprar la mejor cafetera automática.">
        </head>
        <body>
            <h1>Las 7 Mejores Cafeteras Superautomáticas</h1>
            <p>Si buscas el mejor café en grano molido al instante, estás en el lugar correcto. En esta guía analizamos los modelos top.</p>
            
            <table>
                <tr><th>Modelo</th><th>Precio</th></tr>
                <tr><td>DeLonghi Magnifica S</td><td>299 €</td></tr>
            </table>

            <h2>1. DeLonghi Magnifica S ECAM22.110.B</h2>
            <p>La cafetera superautomática más vendida de Amazon. Precio aproximado: 299 €. Valoración: 4.6 / 5 estrellas.</p>
            <ul>
                <li>Molinillo cónico integrado de acero</li>
                <li>Sistema cappuccino manual</li>
            </ul>

            <h2>2. Cecotec Power Matic-ccino 8000</h2>
            <p>Una gran opción nacional con depósito de leche integrado.</p>

            <h2>Factores Clave antes de Comprar</h2>
            <h3>Capacidad del Depósito</h3>
            <h3>Presión de la Bomba</h3>
        </body>
        </html>
        """

        payload = {
            "project_id": self.project.id,
            "raw_html": sample_html,
        }

        res = self.client.post(f"{API_PREFIX}/competitors/scrape-structure", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertIn("Las 7 Mejores Cafeteras", data["title"])
        self.assertIn("Guía y comparativa definitiva", data["meta_description"])
        self.assertEqual(data["h1"], "Las 7 Mejores Cafeteras Superautomáticas")
        self.assertTrue(len(data["headings"]) >= 4)
        self.assertTrue(data["has_comparison_table"])
        self.assertGreaterEqual(data["word_count"], 40)
        self.assertTrue(len(data["detected_products"]) >= 1)
        self.assertIn("DeLonghi", data["detected_products"][0]["name"])


if __name__ == "__main__":
    unittest.main()