import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import AiPrompt, Competitor, InternalLink, Keyword, Niche, Page, Project
from app.seed_phase2 import seed_phase2


class TestW4ContextBuilder(unittest.TestCase):
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

        # Create rich hierarchy and entities
        p = Project(name="Portal Mascotas", description="Web de afiliados caninos")
        self.db.add(p)
        self.db.commit()
        self.project_id = p.id

        n = Niche(
            project_id=self.project_id,
            name="Piensos para Perros",
            topic="Nutricion canina natural y grain free",
            layout_template_text="PLANTILLA DIVI: Header > Tabla Nutricional > Pros/Contras > CTA",
        )
        self.db.add(n)
        self.db.commit()
        self.niche_id = n.id

        parent_page = Page(
            project_id=self.project_id,
            niche_id=self.niche_id,
            title="Mejores Piensos para Perros 2026",
            type="TSG",
        )
        self.db.add(parent_page)
        self.db.commit()
        self.parent_page_id = parent_page.id

        child_page = Page(
            project_id=self.project_id,
            niche_id=self.niche_id,
            parent_page_id=self.parent_page_id,
            title="Pienso Grain Free para Cachorros",
            type="TSA",
            h1="Los 5 Mejores Piensos Grain Free para Cachorros",
            seo_title="Mejores Piensos Grain Free Cachorros (2026)",
            seo_description="Comparativa de piensos sin cereales para cachorros.",
            wp_category="Piensos > Sin Cereales",
            breadcrumb_label="Grain Free",
            objective="Analizar las mejores marcas y recomendar Orijen y Acana",
            outline_json="[{\"tag\": \"h2\", \"text\": \"Top 5 Piensos\"}]",
        )
        self.db.add(child_page)
        self.db.commit()
        self.page_id = child_page.id

        kw1 = Keyword(
            project_id=self.project_id,
            niche_id=self.niche_id,
            page_id=self.page_id,
            term="mejor pienso sin cereales cachorro",
            is_primary=True,
        )
        kw2 = Keyword(
            project_id=self.project_id,
            niche_id=self.niche_id,
            page_id=self.page_id,
            term="pienso natural cachorros opiniones",
            is_primary=False,
        )
        self.db.add_all([kw1, kw2])

        # Link to parent
        link = InternalLink(
            project_id=self.project_id,
            from_page_id=self.page_id,
            to_page_id=self.parent_page_id,
            anchor="guía general de piensos",
        )
        self.db.add(link)

        comp = Competitor(
            project_id=self.project_id,
            domain="expertoanimal.com",
            notes="Líder orgánico en artículos de nutrición canina",
        )
        self.db.add(comp)
        self.db.commit()
        self.competitor_id = comp.id

        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        self.preview_url = f"{API_PREFIX}/ai/assistants/preview-context"

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_preview_context_resolves_all_rich_entities(self):
        payload = {
            "prompt_slug": "content_generator",
            "project_id": self.project_id,
            "page_id": self.page_id,
            "competitor_id": self.competitor_id,
            "extra_context": "Enfocar en razas medianas y grandes.",
        }
        res = self.client.post(self.preview_url, json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Check prompt info
        self.assertEqual(data["prompt_slug"], "content_generator")
        self.assertGreater(data["word_count"], 20)
        self.assertGreater(data["estimated_tokens"], 10)

        # Check user prompt resolution
        user_prompt = data["user_prompt"]
        self.assertIn("PROYECTO: Portal Mascotas", user_prompt)
        self.assertIn("NICHO: Piensos para Perros", user_prompt)
        self.assertIn("PLANTILLA DIVI", user_prompt)
        self.assertIn("Pienso Grain Free para Cachorros", user_prompt)
        self.assertIn("H1 EXPLÍCITO: Los 5 Mejores Piensos Grain Free para Cachorros", user_prompt)
        self.assertIn("Subpágina de «Mejores Piensos para Perros 2026»", user_prompt)
        self.assertIn("★ KEYWORD PRINCIPAL (Focus): mejor pienso sin cereales cachorro", user_prompt)
        self.assertIn("pienso natural cachorros opiniones", user_prompt)
        self.assertIn("Mejores Piensos para Perros 2026", user_prompt)
        self.assertIn("expertoanimal.com", user_prompt)
        self.assertIn("Enfocar en razas medianas y grandes", user_prompt)

        # Check resolved entities dictionary
        entities = data["resolved_entities"]
        self.assertEqual(entities["project_name"], "Portal Mascotas")
        self.assertEqual(entities["niche_name"], "Piensos para Perros")
        self.assertEqual(entities["focus_keyword"], "mejor pienso sin cereales cachorro")
        self.assertEqual(entities["parent_page"], "Mejores Piensos para Perros 2026")
        self.assertEqual(entities["competitor_domain"], "expertoanimal.com")

    def test_preview_context_invalid_prompt_returns_404(self):
        payload = {
            "prompt_slug": "non_existing_slug_12345",
            "project_id": self.project_id,
        }
        res = self.client.post(self.preview_url, json=payload)
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
