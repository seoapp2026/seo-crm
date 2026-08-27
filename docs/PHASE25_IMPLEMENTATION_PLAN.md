# Phase 2.5 — Detailed Implementation Plan

**Budget / scope:** one fixed package at €1,200  
**Goal:** prompts library + layout + richer SEO fields + WordPress export pack + light structure import + official Amazon/eBay products into existing CRM catalog  
**Principle:** reuse Phase 1 / Phase 2 / Option 2. Do not rebuild the CRM.

---

## 0. Current baseline (what we reuse)

| Area | Today | Reuse how |
|---|---|---|
| Projects / Niches / Pages (TSA/TSG/TSR) | Done | Keep; extend page fields |
| Keywords + intent | Done | Add primary/secondary flag |
| URLs / slugs | Done | Feed export + audit |
| Internal links + anchors | Done | Include in export |
| Notes | Done | Inject into prompt context |
| Content drafts + meta title/description | Done | Extend for final laid-out HTML |
| Competitors + Option 2 research | Done | Inject latest research into prompts |
| Products catalog (manual) | Done (`products` table + `/products` + UI) | Extend fields + API import into same table |
| AI prompts (5 fixed `AssistantSlug`) | Edit-only | Replace enum with dynamic library |
| WordPress export | Meta-only JSON | Expand schema + include body/SEO pack |
| Assistants runner | Context: niche/page/keywords/competitor/metrics/extra | Expand context builder |

**Out of scope (explicit):**
- Divi visual builder inside CRM
- Live Rank Math score UI
- Exact Divi shortcode cloning before model page
- Blind auto-publish
- Full live WP ↔ CRM sync
- Scraping
- “All marketplaces forever” (Amazon + eBay + extensible base only)

---

## 1. Workstreams overview

| ID | Workstream | Depends on |
|---|---|---|
| W1 | Dynamic prompt library | — |
| W2 | Richer SEO fields + page hierarchy | — |
| W3 | Layout template + Maquetación + save final HTML | W1, W2 |
| W4 | Prompt context enrichment (+ “what used”) | W1, W2, Option 2, Products |
| W5 | Pre-export audit | W2, W3 |
| W6 | WordPress export pack + Rank Math fields + mapping guide | W2, W3, W5 |
| W7 | Light structure import (CSV/JSON → project) | W2 |
| W8 | Official products APIs (Amazon + eBay + provider base) | Existing Products |
| W9 | Frontend screens + nav copy | All backend pieces |
| W10 | Docs, seed data, E2E checklist, deploy | All |

Suggested build order: **W1 → W2 → W7 → W8 → W4 → W3 → W5 → W6 → W9 → W10**

---

## 2. Data model changes

### 2.1 Prompts — dynamic library

**Replace fixed `AssistantSlug` enum usage for user prompts.**

New / changed table `ai_prompts` (evolve existing):

| Column | Type | Notes |
|---|---|---|
| id | int PK | keep |
| slug | string unique | free-form, e.g. `prompt_00`, `maestro_03`, `maquetador` |
| name | string | display name |
| description | text | |
| system_prompt | text | |
| model_default | string | |
| sort_order | int | for numbered library |
| is_system | bool | optional: protect seeded defaults from delete |
| project_id | int nullable | null = global library; optional later per-project overrides |
| updated_at | datetime | keep |

**Migration notes:**
- Migrate existing 5 rows to dynamic slugs (same names).
- Keep `AssistantSlug` only if needed for backward-compat routes; prefer free slug everywhere.
- Add endpoints: create, update, delete, duplicate, reorder.

### 2.2 Page SEO / architecture fields

Extend `pages` (and/or a related `page_seo` table if cleaner):

| Field | Purpose |
|---|---|
| parent_page_id | parent/child / silo |
| breadcrumb_label | optional crumb label |
| h1 | explicit H1 (fallback title) |
| outline_json | H2/H3 structure |
| seo_title | Rank Math / export |
| seo_description | Rank Math / export |
| wp_category | WP taxonomy mapping |
| wp_tags_json | optional |
| content_html | final laid-out HTML (or store on draft) |
| content_status | borrador / revisado / listo_export |
| schema_json | basic structured data payload |
| export_ready | computed or cached bool |

**Keywords:** add `is_primary: bool` (exactly one primary per page recommended).

**Niches:** optional `layout_template_text` (maquetación rules) **or** new `layout_templates` table:

| Field | Notes |
|---|---|
| id | |
| project_id / niche_id | scope |
| name | |
| rules_text | CSS classes, section order, CTA rules |
| updated_at | |

### 2.3 Content drafts

Extend `content_drafts`:

| Field | Notes |
|---|---|
| content_html | laid-out output |
| draft_kind | `texto` / `maquetado` |
| source_prompt_id | which prompt produced it |
| context_used_json | “what this prompt used” snapshot |

### 2.4 Products — official API fields

Extend `products`:

| Field | Notes |
|---|---|
| provider | `manual` / `amazon` / `ebay` |
| external_id | ASIN / eBay item id |
| image_url | |
| affiliate_url | keep required params untouched |
| availability | text/enum when API allows |
| raw_payload_json | optional debug/audit (trim PII) |
| last_synced_at | |

### 2.5 Structure import jobs (optional light table)

`structure_imports`:
- project_id, filename, status, rows_created, error_message, created_at

---

## 3. Backend implementation steps

### W1 — Dynamic prompt library

**Files (expected):**
- `backend/app/models.py`
- `backend/app/schemas_phase2.py` / new `schemas_prompts.py`
- `backend/app/routers/prompts.py` (expand)
- `backend/app/routers/assistants.py` (run by prompt id/slug)
- `backend/app/seed_phase2.py`
- `backend/app/migrate.py`

**API:**
- `GET /prompts`
- `POST /prompts`
- `PATCH /prompts/{id}`
- `DELETE /prompts/{id}`
- `POST /prompts/{id}/duplicate`
- `POST /prompts/reorder` body: `[{id, sort_order}]`
- `POST /assistants/run` → accept `prompt_id` (preferred) or slug

**Acceptance:**
- Create Prompt 00 + 11 masters + Maquetador without code deploy
- Duplicate + reorder works
- Existing 5 still runnable after migration

---

### W2 — Richer SEO fields

**Files:**
- `models.py` Page / Keyword
- `schemas.py` Page create/update/out
- `routers/pages.py`, `routers/keywords.py`
- Frontend `PagesPage.tsx`, `KeywordsPage.tsx`

**Steps:**
1. Migration for new page + keyword columns
2. CRUD exposes new fields
3. UI sections: SEO, Outline, Hierarchy, WP taxonomy
4. Validation: at most one primary keyword per page (warn if none)

**Acceptance:**
- Can set parent page, H1, outline, seo title/description, primary keyword
- Data survives reload

---

### W3 — Layout template + Maquetación + save HTML

**Steps:**
1. Add layout template storage (niche or project)
2. UI to edit template rules
3. Maquetación run:
   - input = reviewed draft text + layout template + page SEO context
   - output = `content_html`
4. Save as draft kind `maquetado` and/or `pages.content_html`
5. Mark page content status

**Acceptance:**
- Run Maquetador → HTML saved on page/draft
- Re-run does not destroy previous unless user confirms

---

### W4 — Prompt context enrichment

**Expand** `assistant_runner.py` (or new `prompt_context.py`):

Build context blocks from:
- project, niche, page
- primary/secondary keywords + intent
- competitors (+ notes)
- latest Option 2 research summary (if any)
- linked products for page/project
- notes / extra_context
- layout template (for Maquetador)
- GSC/GA metrics when useful (existing)

Return with run response:
```json
{
  "rendered": "...",
  "context_used": ["niche", "keywords", "competitor:x", "research_job:12", "products:3"]
}
```

**Acceptance:**
- UI shows “Qué contexto usó”
- Missing Option 2 / products simply omitted (no crash)

---

### W5 — Pre-export audit

**New service:** `export_audit.py`

Per page checks (configurable):
- has primary keyword
- has slug
- has seo_title / seo_description (or draft meta)
- has H1
- has content_html (final)
- page type set
- optional: at least one internal link suggestion/warning

**API:** `GET /wordpress/export-audit?project_id=`

**Acceptance:**
- Export screen shows ready / missing list before download
- Can still export with warnings (do not hard-block unless user chooses strict mode)

---

### W6 — WordPress export pack

**Expand** `routers/wordpress.py` + schemas:

Per page export object (target shape):

```json
{
  "page_id": 1,
  "title": "...",
  "slug": "/aspiradoras/robot",
  "content_type": "TSG",
  "status": "en_revision",
  "niche_name": "Aspiradoras",
  "wp_category": "Aspiradoras",
  "parent_slug": "/aspiradoras",
  "h1": "...",
  "outline": [{"tag": "h2", "text": "..."}],
  "seo_title": "...",
  "seo_description": "...",
  "primary_keyword": "...",
  "secondary_keywords": ["..."],
  "intent": "comercial",
  "content_html": "<article>...</article>",
  "internal_links": [{"to_slug": "...", "anchor": "..."}],
  "breadcrumbs": ["Inicio", "Aspiradoras", "Robot"],
  "products": [{"name": "...", "affiliate_url": "...", "image_url": "..."}],
  "schema_json": {},
  "rank_math": {
    "focus_keyword": "...",
    "title": "...",
    "description": "..."
  }
}
```

Also ship:
- `docs/wordpress_wp_all_import_mapping.md` (CRM field → WP / Rank Math)

**Acceptance:**
- Download JSON includes full article body
- Mapping guide matches export keys
- Divi guidance: template wraps `content_html`; CRM does not rebuild theme

---

### W7 — Light structure import

**API:**
- `POST /projects/import-structure` multipart CSV or JSON
- Columns: `title, slug, niche_name, parent_slug, page_type` (optional extras)

**Behavior:**
1. Create project if requested, or import into existing project
2. Upsert niches by name
3. Create pages + urls
4. Wire parent_page_id when parent_slug resolves
5. Return summary: created/skipped/errors

**Acceptance:**
- Import 20-row sample creates usable project tree
- Bad rows reported without failing entire file when possible

---

### W8 — Official products APIs

**Architecture:**

```text
ProductProvider (interface)
  ├── AmazonCreatorsProvider  (official authorized API only)
  ├── EbayBrowseProvider      (official authorized API only)
  └── ManualProvider          (existing CRUD)
```

**Config (`config.py` / env):**
- `AMAZON_CREDENTIALS...` (as required by current Creators/affiliate API)
- `EBAY_APP_ID` / OAuth tokens as required
- Marketplace locale (ES/US/etc.)

**API:**
- `GET /products/providers`
- `POST /products/search` `{ provider, query, limit }`
- `POST /products/import` `{ provider, external_id, project_id }` → upsert Product
- Existing CRUD remains for manual edits

**Rules:**
- No scraping fallback
- Preserve affiliate URL parameters exactly
- AI must still only use stored product facts (existing hard rule)
- If API unavailable / account not eligible → clear error, manual entry still works

**Acceptance:**
- Search Amazon + eBay from Products UI
- Import stores image, affiliate URL, external id, price/availability when present
- Extensible provider registry ready for a third provider stub

**Note:** Amazon PA-API 5.0 retirement / Creators API migration — implement against **current authorized docs** at build time; keep provider isolated so auth changes don’t infect the CRM.

---

## 4. Frontend implementation steps

| Screen | Changes |
|---|---|
| Prompts | Create / edit / duplicate / reorder; remove “5 only” copy |
| Assistants | Pick any prompt from library; show context_used |
| Pages | SEO panel, parent, outline, content_html preview |
| Keywords | Primary toggle |
| Niches / Project | Layout template editor |
| Products | Search/import Amazon & eBay + manual CRUD |
| WordPress | Audit panel + richer export download + link to mapping guide |
| New/Extend | Structure import upload UI (Projects or WordPress page) |
| Nav / Help | Update crumbs: dynamic prompts; export completo; productos API |

---

## 5. Step-by-step delivery plan (suggested calendar)

Assume ~10 focused working days after payment + credentials available.

### Days 1–2 — Foundation
1. Freeze field list + export JSON schema in repo (`docs/phase25_export_schema.json`)
2. DB migrations: prompts dynamic, page SEO fields, keyword primary, products provider fields, layout template
3. Migrate seed of 5 prompts → dynamic library
4. Backend CRUD for prompts (create/duplicate/reorder)

### Days 3–4 — SEO + structure import
5. Pages/keywords API + UI for new fields
6. Structure import CSV/JSON endpoint + UI
7. Basic hierarchy (parent) + breadcrumbs builder helper

### Days 5–6 — Products APIs
8. Provider interface + Amazon connector
9. eBay connector
10. Products search/import UI
11. Wire products into prompt context

### Days 7–8 — Layout + assistants context
12. Layout template storage + UI
13. Maquetación flow → save `content_html`
14. Context builder + “what used” on run response
15. Assistants/Prompts UI polish

### Days 9–10 — Export + audit + docs
16. Pre-export audit API + WordPress UI warnings
17. Full export JSON
18. WP All Import mapping guide + Divi/Rank Math handoff notes in Help
19. E2E checklist run
20. Deploy + smoke test on production

**Buffer:** small fixes after client testing (included in “after delivery support within scope”).

---

## 6. Credentials / client dependencies (blockers)

Before W8 can go live, client must provide:
- Amazon Associates / Creators API access (eligible account)
- eBay developer/affiliate credentials as required
- Confirmation of marketplaces (e.g. Amazon.es, eBay.es)

Phase 2.5 other streams can proceed without those; Products API features stay disabled with clear UI until keys exist.

---

## 7. Testing checklist (E2E)

1. Create 3 new prompts, duplicate one, reorder
2. Create niche “Aspiradoras”, pages with parent/child, primary/secondary keywords
3. Paste/run Prompt 00 → see context_used
4. Save layout template → run Maquetador → `content_html` saved
5. Import 2 Amazon + 1 eBay products (or stub mode if no creds)
6. Run export audit → fix missing fields → warnings clear
7. Download WordPress JSON → verify body + SEO + links + products present
8. Import structure CSV into new project → pages/slugs/niches created
9. Regression: Option 2 research, GSC sync, manual products CRUD still work

---

## 8. Documentation to produce

| Doc | Purpose |
|---|---|
| `docs/PHASE25_IMPLEMENTATION_PLAN.md` | this file |
| `docs/phase25_export_schema.json` | frozen export contract |
| `docs/wordpress_wp_all_import_mapping.md` | field map CRM → WP/Rank Math |
| `docs/phase25_divi_rankmath_handoff.md` | what CRM fills vs Divi template |
| Update `docs/PLATFORM_USER_GUIDE.md` | operator steps |
| Update `docs/E2E_TEST_GUIDE.txt` | Phase 2.5 cases |

---

## 9. Definition of done

Phase 2.5 is done when:
- [ ] Dynamic prompt library live (create/edit/duplicate/order)
- [ ] Layout template + Maquetación saves final HTML
- [ ] Page SEO fields + primary/secondary keywords usable
- [ ] Prompt context uses CRM + Option 2 + products; shows what was used
- [ ] Pre-export audit warns on incomplete pages
- [ ] WordPress JSON includes full article + SEO pack
- [ ] Mapping guide published
- [ ] Light CSV/JSON structure import works
- [ ] Amazon + eBay official import into products works (or clearly gated until credentials)
- [ ] No scraping paths exist
- [ ] Help/Divi notes explain template-fills-content model
- [ ] Deployed + smoke-tested
- [ ] Client can complete: import/structure → prompts → content → products → audit → export

---

## 10. Risk notes (honest)

| Risk | Mitigation |
|---|---|
| Amazon API auth/eligibility changes | Isolate provider; manual products always work |
| eBay affiliate field differences by region | Store what API returns; don’t invent |
| Scope creep (full WP sync, Divi shortcodes) | Keep out-of-scope list frozen |
| Export too large | Paginate/filter by niche; optional “ready only” |
| Prompt library UX confusion | Numbered sort_order + duplicate from masters |

---

## 11. Immediate next actions (when build starts)

1. Confirm payment for pending + Phase 2.5 approval at €1,200  
2. Freeze export JSON schema file in repo  
3. Start W1 migrations (dynamic prompts)  
4. Request Amazon/eBay API credentials in parallel (non-blocking for W1–W7)
