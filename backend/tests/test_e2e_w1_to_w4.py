import json
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import API_PREFIX
from app.database import Base, get_db
from app.main import app
from app.models import (
    AiPrompt,
    Competitor,
    ContentDraft,
    DraftStatus,
    InternalLink,
    Keyword,
    Niche,
    Page,
    Project,
)
from app.seed_phase2 import seed_phase2


class TestDetailedE2EW1ToW4(unittest.TestCase):
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

        # URLs
        self.projects_url = f"{API_PREFIX}/projects"
        self.niches_url = f"{API_PREFIX}/niches"
        self.pages_url = f"{API_PREFIX}/pages"
        self.keywords_url = f"{API_PREFIX}/keywords"
        self.prompts_url = f"{API_PREFIX}/ai/prompts"
        self.ai_url = f"{API_PREFIX}/ai"
        self.assistants_url = f"{API_PREFIX}/ai/assistants"

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_complete_phase25_e2e_workflow(self):
        print("\n=== STEP 1: CREATE PROJECT & NICHE WITH LAYOUT TEMPLATE ===")
        # 1. Project
        p_res = self.client.post(self.projects_url, json={
            "name": "Mundo Espresso",
            "description": "Portal especializado en cafeteras y barismo",
            "gsc_site_url": "https://mundoespresso.com/",
        })
        self.assertEqual(p_res.status_code, 201)
        project_id = p_res.json()["id"]

        # 2. Niche with layout rules
        n_res = self.client.post(self.niches_url, json={
            "project_id": project_id,
            "name": "Cafeteras Superautomáticas",
            "topic": "Cafeteras de grano con molinillo integrado",
            "monetization": "afiliacion",
            "layout_template_text": "REGLAS DIVI: Hero H1 > Tabla Comparativa Top 3 > Cajas Producto con Pros/Contras > FAQ Accordion",
        })
        self.assertEqual(n_res.status_code, 201)
        niche_id = n_res.json()["id"]
        self.assertIn("REGLAS DIVI", n_res.json()["layout_template_text"])

        print("=== STEP 2: CREATE SILO HIERARCHY (PILAR & CLUSTER SUBPAGES) ===")
        # 3. Parent Pillar Page
        pilar_res = self.client.post(self.pages_url, json={
            "project_id": project_id,
            "niche_id": niche_id,
            "title": "Mejores Cafeteras Superautomáticas 2026",
            "type": "TSG",
            "h1": "Guía Completa de Cafeteras Superautomáticas",
            "seo_title": "Mejores Cafeteras Superautomáticas 2026 — Guía y Comparativa",
            "seo_description": "Análisis exhaustivo de las mejores cafeteras automáticas de grano.",
            "wp_category": "Cafeteras > Automáticas",
            "breadcrumb_label": "Superautomáticas",
        })
        self.assertEqual(pilar_res.status_code, 201)
        pilar_id = pilar_res.json()["id"]
        self.assertIsNone(pilar_res.json()["parent_page_id"])

        # 4. Child Subpage linked to Pilar
        child_res = self.client.post(self.pages_url, json={
            "project_id": project_id,
            "niche_id": niche_id,
            "parent_page_id": pilar_id,
            "title": "Cafeteras DeLonghi Magnifica S",
            "type": "TSA",
            "h1": "DeLonghi Magnifica S: Opiniones y Análisis a Fondo",
            "seo_title": "DeLonghi Magnifica S (2026) — Opinión y Mejor Precio",
            "seo_description": "Review detallada de la DeLonghi Magnifica S. Ventajas, desventajas y veredicto.",
            "wp_category": "Cafeteras > DeLonghi",
            "breadcrumb_label": "Magnifica S",
            "objective": "Analizar pros/contras y orientar a compra en Amazon",
            "outline_json": json.dumps([
                {"tag": "h2", "text": "Características Principales"},
                {"tag": "h2", "text": "Ventajas y Desventajas"},
                {"tag": "h2", "text": "Preguntas Frecuentes"},
            ]),
        })
        self.assertEqual(child_res.status_code, 201)
        child_data = child_res.json()
        child_id = child_data["id"]
        self.assertEqual(child_data["parent_page_id"], pilar_id)
        self.assertEqual(child_data["parent_title"], "Mejores Cafeteras Superautomáticas 2026")

        print("=== STEP 3: ASSIGN FOCUS & SECONDARY KEYWORDS WITH EXCLUSIVITY ===")
        # 5. Primary Keyword
        kw1_res = self.client.post(self.keywords_url, json={
            "project_id": project_id,
            "niche_id": niche_id,
            "page_id": child_id,
            "term": "delonghi magnifica s opiniones",
            "intent": "comercial",
            "is_primary": True,
        })
        self.assertEqual(kw1_res.status_code, 201)
        self.assertTrue(kw1_res.json()["is_primary"])
        kw1_id = kw1_res.json()["id"]

        # 6. Secondary Keyword
        kw2_res = self.client.post(self.keywords_url, json={
            "project_id": project_id,
            "niche_id": niche_id,
            "page_id": child_id,
            "term": "precio cafetera delonghi magnifica s",
            "intent": "transaccional",
            "is_primary": False,
        })
        self.assertEqual(kw2_res.status_code, 201)
        self.assertFalse(kw2_res.json()["is_primary"])

        # 7. Internal Link child -> parent
        link_res = self.client.post(f"{API_PREFIX}/links", json={
            "project_id": project_id,
            "from_page_id": child_id,
            "to_page_id": pilar_id,
            "anchor": "comparativa de cafeteras superautomáticas",
        })
        self.assertEqual(link_res.status_code, 201)

        print("=== STEP 4: DYNAMIC PROMPT CREATION, REORDERING & DUPLICATION (W1) ===")
        # 8. Create custom prompt
        prompt_res = self.client.post(self.prompts_url, json={
            "name": "Prompt 00 Maestro Arquitecto",
            "slug": "prompt_00_maestro",
            "model_default": "gpt-4o",
            "system_prompt": "Eres el Prompt 00 Maestro. Diseñas la arquitectura de silos y clusters.",
            "description": "Planificación completa de arquitectura antes de redactar",
            "sort_order": 5,
        })
        self.assertEqual(prompt_res.status_code, 201)
        prompt_00_id = prompt_res.json()["id"]

        # 9. Duplicate prompt
        dup_res = self.client.post(f"{self.prompts_url}/{prompt_00_id}/duplicate")
        self.assertEqual(dup_res.status_code, 201)
        self.assertEqual(dup_res.json()["slug"], "prompt_00_maestro_copia")

        # 10. Reorder prompts
        reorder_res = self.client.post(f"{self.prompts_url}/reorder", json=[
            {"id": prompt_00_id, "sort_order": -1},
            {"id": dup_res.json()["id"], "sort_order": 1},
        ])
        self.assertEqual(reorder_res.status_code, 200)
        self.assertEqual(reorder_res.json()[0]["id"], prompt_00_id)

        print("=== STEP 5: PREVIEW FULL CONTEXT (W4 CONTEXT BUILDER) ===")
        # 11. Context Preview
        prev_res = self.client.post(f"{self.assistants_url}/preview-context", json={
            "prompt_id": prompt_00_id,
            "project_id": project_id,
            "page_id": child_id,
            "extra_context": "Destacar la facilidad de limpieza del grupo infusor.",
        })
        self.assertEqual(prev_res.status_code, 200)
        prev_data = prev_res.json()

        # Assert full contextual resolution
        self.assertEqual(prev_data["prompt_name"], "Prompt 00 Maestro Arquitecto")
        self.assertGreater(prev_data["word_count"], 30)
        self.assertGreater(prev_data["estimated_tokens"], 15)

        user_txt = prev_data["user_prompt"]
        self.assertIn("PROYECTO: Mundo Espresso", user_txt)
        self.assertIn("NICHO: Cafeteras Superautomáticas", user_txt)
        self.assertIn("REGLAS DIVI: Hero H1 > Tabla Comparativa", user_txt)
        self.assertIn("PÁGINA: Cafeteras DeLonghi Magnifica S", user_txt)
        self.assertIn("H1 EXPLÍCITO: DeLonghi Magnifica S: Opiniones y Análisis a Fondo", user_txt)
        self.assertIn("JERARQUÍA SILO: Subpágina de «Mejores Cafeteras Superautomáticas 2026»", user_txt)
        self.assertIn("★ KEYWORD PRINCIPAL (Focus): delonghi magnifica s opiniones", user_txt)
        self.assertIn("precio cafetera delonghi magnifica s", user_txt)
        self.assertIn("ENLACES INTERNOS A INCLUIR: Mejores Cafeteras Superautomáticas 2026", user_txt)
        self.assertIn("Destacar la facilidad de limpieza del grupo infusor.", user_txt)

        print("=== STEP 6: EXECUTE MAQUETADOR IA & SAVE FINAL HTML (W3) ===")
        # 12. Run Maquetador
        maq_res = self.client.post(f"{self.ai_url}/maquetar", json={
            "page_id": child_id,
            "save_to_page": True,
        })
        self.assertEqual(maq_res.status_code, 200)
        maq_data = maq_res.json()
        self.assertTrue(maq_data["page_updated"])
        self.assertIn("<article", maq_data["content_html"])
        self.assertIn("DeLonghi Magnifica S", maq_data["content_html"])

        # 13. Verify page record in DB
        get_page_res = self.client.get(f"{self.pages_url}?project_id={project_id}")
        page_refreshed = next(p for p in get_page_res.json() if p["id"] == child_id)
        self.assertEqual(page_refreshed["content_status"], "revisado")
        self.assertIn("<article", page_refreshed["content_html"])

        # 14. Mark as export ready
        patch_page_res = self.client.patch(f"{self.pages_url}/{child_id}", json={
            "content_status": "listo_export",
            "export_ready": True,
        })
        self.assertEqual(patch_page_res.status_code, 200)
        self.assertEqual(patch_page_res.json()["content_status"], "listo_export")
        self.assertTrue(patch_page_res.json()["export_ready"])

        # 15. Check drafts history
        drafts_res = self.client.get(f"{self.ai_url}/drafts?page_id={child_id}")
        self.assertEqual(drafts_res.status_code, 200)
        self.assertGreaterEqual(len(drafts_res.json()), 1)
        self.assertEqual(drafts_res.json()[0]["draft_kind"], "maquetado")

        print("=== ALL WORKSTREAM E2E ASSERTIONS PASSED SUCCESSFULLY! ===")


if __name__ == "__main__":
    unittest.main()
