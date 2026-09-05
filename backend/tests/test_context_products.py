import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import AiPrompt, Niche, Page, Product, Project
from app.schemas_phase2 import ContextPreviewRequest
from app.services.context_builder import build_assistant_context


class TestContextProducts(unittest.TestCase):
    """W4: PRODUCTS context block in the assistant prompt."""

    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = self.Session()

        prompt = AiPrompt(
            slug="content_generator",
            name="Generador de contenido",
            system_prompt="Eres un redactor SEO experto.",
        )
        self.db.add(prompt)

        project = Project(name="Portal Cafeteras", description="Web de afiliación")
        self.db.add(project)
        self.db.commit()
        self.project_id = project.id

        niche = Niche(project_id=self.project_id, name="Cafeteras", topic="Café espresso en casa")
        self.db.add(niche)
        self.db.commit()

        page = Page(project_id=self.project_id, niche_id=niche.id, title="Mejores Cafeteras 2026", type="TSR")
        self.db.add(page)
        self.db.commit()
        self.page_id = page.id

        self.db.add_all(
            [
                Product(
                    project_id=self.project_id,
                    name="De'Longhi Dedica EC685.M",
                    brand="De'Longhi",
                    price=189.0,
                    currency="EUR",
                    rating="4.6/5",
                    stock_notes="Envío en 24h",
                    features="15 bares | Thermoblock",
                    affiliate_url="https://www.amazon.es/dp/B073CRBYNV?tag=seocrm-21",
                ),
                Product(
                    project_id=self.project_id,
                    name="Cecotec Cafelizzia 790",
                    brand="Cecotec",
                    price=79.9,
                    currency="EUR",
                    rating="4.3/5",
                    availability="Sólo quedan 5",
                    affiliate_url="https://www.amazon.es/dp/B08N5N4KCW?tag=seocrm-21",
                ),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def _build(self, project_id, page_id=None):
        payload = ContextPreviewRequest(
            prompt_slug="content_generator",
            project_id=project_id,
            page_id=page_id,
        )
        return build_assistant_context(self.db, payload)

    def test_products_block_included_for_page_run(self):
        _, _, user_prompt, resolved = self._build(self.project_id, self.page_id)

        self.assertIn("PRODUCTS DEL PROYECTO", user_prompt)
        self.assertIn("De'Longhi Dedica EC685.M", user_prompt)
        self.assertIn("Marca: De'Longhi", user_prompt)
        self.assertIn("189.0 EUR", user_prompt)
        self.assertIn("4.6/5", user_prompt)
        self.assertIn("Envío en 24h", user_prompt)
        self.assertIn("15 bares | Thermoblock", user_prompt)
        self.assertIn("tag=seocrm-21", user_prompt)
        # Second product with availability field
        self.assertIn("Cecotec Cafelizzia 790", user_prompt)
        self.assertIn("Sólo quedan 5", user_prompt)

        self.assertIn("products:2", resolved["context_used"])

    def test_products_block_included_without_page(self):
        _, _, user_prompt, resolved = self._build(self.project_id)
        self.assertIn("PRODUCTS DEL PROYECTO", user_prompt)
        self.assertIn("products:2", resolved["context_used"])

    def test_products_omitted_when_project_has_no_products(self):
        empty = Project(name="Proyecto Vacío")
        self.db.add(empty)
        self.db.commit()

        _, _, user_prompt, resolved = self._build(empty.id)
        self.assertNotIn("PRODUCTS DEL PROYECTO", user_prompt)
        self.assertFalse(any(entry.startswith("products:") for entry in resolved["context_used"]))

    def test_products_capped_at_ten(self):
        for i in range(12):
            self.db.add(Product(project_id=self.project_id, name=f"Producto Extra {i}", price=float(i)))
        self.db.commit()

        _, _, user_prompt, resolved = self._build(self.project_id)
        self.assertIn("products:10", resolved["context_used"])
        self.assertNotIn("Producto Extra 10", user_prompt)


if __name__ == "__main__":
    unittest.main()
