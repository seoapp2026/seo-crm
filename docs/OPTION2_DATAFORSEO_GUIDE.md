# Option 2 — DataForSEO (Análisis SEO)

## What it is

Manual **Analyze project** jobs that pull a **fixed, capped** pack of DataForSEO data into the CRM:

- Keyword search volume + CPC (Google Ads)
- Related keyword ideas (Labs, limited)
- Google organic SERP (regular live, limited queries)
- On-page instant snapshot (1 URL)
- Backlinks summary + referring domains
- Link-gap table (domains linking to competitors but not you)
- Stored AI-style strategy report + history

**Not** an Ahrefs clone: no multi-page crawler, no nightly auto-refresh, no outreach CRM.

## Hard caps (server-enforced)

| Cap | Default |
|---|---:|
| Competitors per run | 3 |
| Seed keywords | 20 |
| Keywords stored | 100 |
| SERP queries | 10 |
| SERP results / query | 10 |
| On-page URLs | 1 |
| Referring domains / domain | 50 |
| Link-gap rows | 100 |
| Concurrent jobs / project | 1 |
| Soft monthly budget | €50 |
| Hard monthly budget | €100 (0 = off) |

Re-open past runs = **free**. Re-run = **new API spend**.

## Whitelisted API paths

Only these are called:

1. `POST /v3/keywords_data/google_ads/search_volume/live`
2. `POST /v3/dataforseo_labs/google/related_keywords/live`
3. `POST /v3/serp/google/organic/live/regular`
4. `POST /v3/on_page/instant_pages`
5. `POST /v3/backlinks/summary/live`
6. `POST /v3/backlinks/referring_domains/live`

## Railway / env setup

From [DataForSEO API Access](https://app.dataforseo.com/api-access):

```
DATAFORSEO_LOGIN=your_api_login
DATAFORSEO_PASSWORD=your_api_password
DATAFORSEO_FORCE_STUB=false
DATAFORSEO_SOFT_MONTHLY_EUR=50
DATAFORSEO_HARD_MONTHLY_EUR=100
```

Without login/password, the app uses **stub mode** (demo snapshot, €0 API) so the UI still works.

Check: `GET /api/seo-crm/health` → `dataforseo.credentials_configured` and `using_stub`.

## How to run (operator)

1. Log in to CRM → project filter (e.g. Lumey)
2. **Análisis SEO** → fill site URL (optional), up to 3 competitors, seed keywords
3. **Analizar proyecto**
4. Review tabs: Informe · Keywords · SERP · Snapshot · Backlinks · Oportunidades
5. Add real facts under **Productos** before AI product reviews

## Cost notes

- Charged by DataForSEO pay-as-you-go on **your** balance
- CRM tracks `actual_cost_eur` per job (USD cost treated ≈ EUR 1:1 for budget guards)
- Soft warning near monthly soft cap; hard stop blocks new runs at hard cap

## Code map

| Piece | Path |
|---|---|
| Caps | `backend/app/services/research_caps.py` |
| Client | `backend/app/services/dataforseo_client.py` |
| Live pack | `backend/app/services/research_live.py` |
| Runner | `backend/app/services/research_runner.py` |
| API | `backend/app/routers/research.py`, `products.py` |
| UI | `frontend/src/pages/phase2/ResearchPage.tsx`, `ProductsPage.tsx` |
