# Option 2 — DataForSEO (Análisis SEO) · Full operator guide

**App screens:** `/research` (Análisis SEO), `/products` (Productos)  
**In-app help:** `/help#option2`  
**Health:** `GET /api/seo-crm/health` → `dataforseo`  
**Last updated:** 2026-08 (live client + stub fallback)

---

## 1. What Option 2 is (and is not)

### Is

A **manual** research workflow inside SEO CRM:

1. You fill a form (site URL optional, ≤3 competitors, seed keywords, country/language, page type).
2. You click **Analizar proyecto**.
3. The backend calls a **fixed, capped** DataForSEO pack (or **stub** if no credentials).
4. Results are **stored** on the project: keywords, SERP, on-page snapshot, backlinks, link gap, opportunities, strategy report.
5. You re-open past runs **for free** (no new API calls).

### Is not

| Out of scope | Why |
|---|---|
| Full multi-page sitewide crawler | Fee/scope limit |
| Ahrefs-style historical charts | Not included |
| Nightly auto-refresh of all projects | Cost control |
| Link-building CRM (contacts, email, sequences) | Later phase |
| Ahrefs / SE Ranking / DinoRANK | Separate vendors |
| Unlimited API loops | Hard caps in code |

**Development fee** for Option 2 build: fixed **€1,000** (agreed).  
**DataForSEO usage** is separate: pay-as-you-go on **your** DataForSEO balance.

---

## 2. How it fits Phase 1 / Phase 2

```
Phase 1  → Store & organize (project → niche → page → keywords → URLs → links)
Phase 2  → Google live data (GSC, GA4, Ads Keyword Planner) + AI assistants
Option 2 → External research (DataForSEO) + products facts + stored analysis jobs
```

| Need | Use |
|---|---|
| Volume for keywords **already in CRM** via Google Ads account | **Keywords Ads** + Ads sync |
| Research from URL + competitors + SERP + backlinks | **Análisis SEO** (Option 2) |
| Real product specs for reviews | **Productos** |
| Organic traffic performance | GSC + Analytics + Rendimiento |

They complement each other; Option 2 does **not** replace GSC/GA4/Ads.

---

## 3. Hard caps (server-enforced)

All limits are validated in `research_caps.py` and env-overridable.

### Per analysis

| Cap | Default | Env override |
|---|---:|---|
| Competitor URLs | **3** | `DATAFORSEO_MAX_COMPETITORS` |
| Seed keywords (user input) | **20** | `DATAFORSEO_MAX_SEED_KEYWORDS` |
| Keywords stored (seed + ideas) | **100** | `DATAFORSEO_MAX_KEYWORDS_STORED` |
| SERP queries | **10** | `DATAFORSEO_MAX_SERP_QUERIES` |
| SERP organic results kept / query | **10** | `DATAFORSEO_MAX_SERP_RESULTS` |
| On-page snapshots | **1** URL | fixed |
| Backlink sample rows / domain | **50** | `DATAFORSEO_MAX_BACKLINKS_PER_DOMAIN` |
| Referring domains fetched / domain | **50** | `DATAFORSEO_MAX_REFERRING_DOMAINS` |
| Link-gap rows stored | **100** | `DATAFORSEO_MAX_LINK_GAPS` |
| Concurrent jobs per project | **1** | fixed |
| Concurrent jobs global | **2** | `DATAFORSEO_MAX_CONCURRENT_GLOBAL` |

### Monthly budget

| Control | Default | Env |
|---|---:|---|
| Soft warning (~80% of soft) | **€50** | `DATAFORSEO_SOFT_MONTHLY_EUR` |
| Hard stop (block new runs) | **€100** | `DATAFORSEO_HARD_MONTHLY_EUR` (`0` = disabled) |

### Cost behaviour

- **Re-open** history / detail → **€0** (DB only).
- **New analyze** → new job → new DataForSEO cost (live mode).
- Stub mode → **€0** API (demo data).
- CRM stores `estimated_cost_eur` and `actual_cost_eur` (API cost USD treated ≈ EUR 1:1 for guards).

### Rough cost bands (vendor, not CRM fee)

| Band | Typical |
|---|---|
| Light | ~€0.50 – €3 |
| Standard | ~€3 – €12 |
| Heavy (many SERPs / deep links) | ~€12 – €40+ |

Caps exist so “standard” stays the normal path.

---

## 4. Live API pack (whitelist only)

Base: `https://api.dataforseo.com`  
Auth: HTTP Basic (`DATAFORSEO_LOGIN` : `DATAFORSEO_PASSWORD`)

| Step | Method + path | Purpose |
|---|---|---|
| 1 | `POST /v3/keywords_data/google_ads/search_volume/live` | Volume, competition, CPC for seeds |
| 2 | `POST /v3/dataforseo_labs/google/related_keywords/live` | Expand ideas from first seed (capped) |
| 3 | `POST /v3/serp/google/organic/live/regular` | Organic SERP (one keyword per call, capped count) |
| 4 | `POST /v3/on_page/instant_pages` | Title, meta, H1–H3 for **one** site URL |
| 5 | `POST /v3/backlinks/summary/live` | Backlink counts for site + each competitor |
| 6 | `POST /v3/backlinks/referring_domains/live` | Referring domains (for summary + link gap) |

Any other path is **rejected** by the client whitelist.

### Location / language

- Country code (e.g. `es`, `us`, `mx`) → DataForSEO `location_code` (Spain default **2724**).
- Language code (e.g. `es`, `en`) → `language_code`.

---

## 5. Stub vs live mode

| Condition | Mode |
|---|---|
| No login/password | **Stub** (fixtures, `used_stub=true`, cost 0) |
| `DATAFORSEO_FORCE_STUB=true` | **Stub** even with credentials |
| Login + password set, force_stub false | **Live** |

UI shows status on **Análisis SEO** and health JSON:

```json
"dataforseo": {
  "login_set": true,
  "password_set": true,
  "credentials_configured": true,
  "force_stub": false,
  "using_stub": false,
  "soft_monthly_eur": 50,
  "hard_monthly_eur": 100
}
```

---

## 6. Railway / environment setup

### Required for live data

1. Account at [DataForSEO](https://dataforseo.com/).
2. Open [API Access](https://app.dataforseo.com/api-access).
3. Copy **API login** and **API password** (not the website password).
4. Top up balance (pay-as-you-go).
5. Railway (or `.env`) variables:

```bash
DATAFORSEO_LOGIN=your_api_login
DATAFORSEO_PASSWORD=your_api_password
DATAFORSEO_FORCE_STUB=false
DATAFORSEO_SOFT_MONTHLY_EUR=50
DATAFORSEO_HARD_MONTHLY_EUR=100
```

6. Redeploy.
7. Confirm health: `using_stub: false`.
8. CRM → **Análisis SEO** → should say **DataForSEO live listo**.

### Optional cap overrides

See table in §3 and `.env.example`.

---

## 7. Operator workflow (click-by-click)

### A) Products (before product reviews)

1. Menu **Productos**.
2. Scope = correct project.
3. **+ Producto**: name, brand, features, price, stock notes, approved opinions.
4. Rule: AI must **not invent** missing commercial facts → leave fields empty and drafts should say “needs data”.

### B) Run analysis

1. Menu **Análisis SEO**.
2. Scope = project (e.g. Lumey).
3. Optional: uncheck “sin web” and set **1 main URL**.
4. Up to **3** competitor URLs.
5. Seed keywords: one per line, max **20**.
6. Country / language / main type (TSG / TSR / TSA).
7. **Analizar proyecto**.
8. Wait for job **Listo** (or error toast with message).

### C) Read results (tabs)

| Tab | Content |
|---|---|
| **Informe IA** | Strategy report (architecture, clusters, next steps) |
| **Keywords** | Term, volume, intent, CPC, competition, source (seed/idea) |
| **SERP** | Query, position, title, domain |
| **Snapshot** | On-page title/meta/H1–H3/links JSON |
| **Backlinks** | Per-domain counts + **link gap** table |
| **Oportunidades** | Prioritized actions derived from the pack |

### D) After analysis

1. Create/update niches & pages from the report (manual).
2. Copy priority terms into **Palabras clave**.
3. Optionally run **Keywords Ads** sync for Google Planner volumes on those CRM keywords.
4. Use **Asistentes IA** / **Generador** with structure + (for products) Productos facts.
5. Export **WordPress** when ready; publish yourself.

---

## 8. Data model (what is stored)

| Table | Role |
|---|---|
| `research_jobs` | One row per run (inputs, status, costs, ai_report, used_stub) |
| `research_keywords` | Keyword metrics snapshot |
| `research_serp_rows` | SERP organic rows |
| `research_page_snapshots` | On-page snapshot |
| `research_backlink_summaries` | Backlink totals per domain |
| `research_link_gaps` | Domains linking to competitor not you |
| `research_opportunities` | Derived action list |
| `products` | Product facts for AI |

Deleting a **project** should cascade research data (FK ondelete CASCADE).

### Job statuses

`queued` → `running` → `done` | `error`

---

## 9. API surface (CRM)

Prefix: `/api/seo-crm`

| Method | Path | Description |
|---|---|---|
| GET | `/research/caps` | Active caps + credentials/stub flags |
| GET | `/research/budget` | Month spend, soft/hard flags |
| GET | `/research/jobs?project_id=` | History (list) |
| GET | `/research/jobs/{id}` | Full detail + child rows |
| POST | `/research/jobs` | Create + run analysis (body: project, urls, keywords, …) |
| GET/POST/PATCH/DELETE | `/products` | Product CRUD |

Auth: same session cookie as the rest of the CRM.

---

## 10. Troubleshooting

| Symptom | Check |
|---|---|
| Always “stub” | `DATAFORSEO_LOGIN` / `PASSWORD` on Railway; redeploy; health `credentials_configured` |
| 400 max competitors / keywords | Reduce to ≤3 / ≤20 unique seeds |
| “Ya hay un análisis en curso” | Wait for previous job to finish |
| Hard monthly block | Raise `DATAFORSEO_HARD_MONTHLY_EUR` or wait next month |
| Live job error | Message on job; Railway logs; DataForSEO balance; API password correct |
| Empty SERP/keywords | Seeds empty? Location/language? Vendor error in logs |
| Expensive runs | Lower seed count and SERP queries; don’t re-run casually |
| AI invents product price | Fill **Productos**; re-generate after facts exist |

---

## 11. Code map

| Piece | Path |
|---|---|
| Caps | `backend/app/services/research_caps.py` |
| HTTP client + whitelist | `backend/app/services/dataforseo_client.py` |
| Live pack → DB | `backend/app/services/research_live.py` |
| Orchestration | `backend/app/services/research_runner.py` |
| API | `backend/app/routers/research.py`, `products.py` |
| Models | `backend/app/models.py` (`Research*`, `Product`) |
| Config | `backend/app/config.py`, `.env.example` |
| UI | `frontend/src/pages/phase2/ResearchPage.tsx`, `ProductsPage.tsx` |
| In-app help | `frontend/src/pages/HelpPage.tsx` `#option2` |

---

## 12. Security notes

- Never put DataForSEO password in the frontend or git.
- Prefer Railway secrets; rotate if leaked in chat/logs.
- API password from DataForSEO dashboard is **not** the login password for the website.

---

## 13. Checklist before first live run

- [ ] DataForSEO account funded  
- [ ] API login + password in Railway  
- [ ] `DATAFORSEO_FORCE_STUB=false`  
- [ ] Health shows `using_stub: false`  
- [ ] Project selected in CRM  
- [ ] ≤20 seed keywords, ≤3 competitors  
- [ ] Start with a **small** run to verify cost  
- [ ] Review stored job before re-running  

Done when: live job shows `used_stub: false`, keywords/SERP/backlinks tabs have real-looking data, and re-opening the job does not charge again.
