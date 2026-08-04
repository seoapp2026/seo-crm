# SEO CRM — Platform guide (how everything fits together)

Use this while you click through the app. It explains **what each thing is for**, **how pieces connect**, and **what each screen / option does** — not how to run tests.

---

## 1. The big idea in one sentence

You organize SEO work as a tree:

**Project (one website) → Niche (topic / market) → Page (content piece) → Keywords (search terms) + URL (live slug / index status)**

AI, Google data, links, and WordPress all hang off that tree. You always **review** AI output; the system never publishes alone.

---

## 2. Mental model: hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  PROJECT = one website                                      │
│  • Own Search Console URL + GA4 property                    │
│  • Own Google OAuth connections + sync jobs                 │
│                                                             │
│    ┌─────────────────────────────────────────────────────┐  │
│    │  NICHE = strategic topic (e.g. "best hiking boots") │  │
│    │  • Lifecycle state + monetization model             │  │
│    │                                                     │  │
│    │    ┌─────────────────────────────────────────────┐  │  │
│    │    │  PAGE = one planned article                   │  │  │
│    │    │  Type: TSG / TSR / TSA                        │  │  │
│    │    │  State: draft → review → published → optimized│  │  │
│    │    │                                               │  │  │
│    │    │    • KEYWORDS assigned to this page           │  │  │
│    │    │    • URL(s) with slug + index status          │  │  │
│    │    │    • AI drafts generated for this page        │  │  │
│    │    └─────────────────────────────────────────────┘  │  │
│    └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Also at project level: notes, internal links, competitors  │
└─────────────────────────────────────────────────────────────┘
```

### Why “niche” matters

A **project** is the site (tech + Google accounts). A **niche** is the *business unit* inside that site: one topic you decide to attack, measure, and scale or sleep. Pages and keywords live under a niche so you can run several topics on one site without mixing strategy.

### How AI uses this tree

When you generate content or run an assistant, the system pulls context from the tree automatically:

| What you pick | What the AI receives |
|---|---|
| A **page** | Title, type (TSG/TSR/TSA), objective, niche name/topic, keywords on that page |
| A **niche** (architect / classifier) | Niche name + topic (and related structure) |
| A **competitor** | Domain + notes |
| Content / Optimizer assistants | Same page context **plus** GSC/GA4 metrics if synced |

You do **not** paste keywords into ChatGPT by hand — assign them to the page once; generation reads them.

### How Google data uses this tree

1. You set **GSC site URL** and **GA4 property** on the **project**.
2. You connect OAuth under **Integrations** for that project.
3. **Sync** pulls impressions/clicks/sessions into historical tables.
4. **Performance**, dashboard alerts, and enriched AI assistants read those tables.

So: structure first (project → niche → page → keyword), then data, then AI that can see both.

---

## 3. Recommended order when you use the app

Do this once per new site, then loop for each niche:

| Step | Screen | Why |
|---|---|---|
| 1 | **Proyectos** | Create the website container + GSC/GA4 IDs |
| 2 | **Google OAuth** (Integrations) | Connect GSC → GA4 → Ads (when ready) |
| 3 | **Nichos** | Define topics you will work |
| 4 | **Páginas** | Plan content pieces under each niche |
| 5 | **Palabras clave** | Assign search terms to each page (intent + avoid cannibalization) |
| 6 | **URLs** | Record live slug + index status when published |
| 7 | **Enlazado interno** | Map which pages link to which; fix orphans |
| 8 | **Sincronización** | Pull real Google metrics |
| 9 | **Generador IA** or **Asistentes IA** | Draft / plan / optimize with that context |
| 10 | **WordPress** | Export structure; you publish manually |
| Ongoing | **Panel**, **Rendimiento**, **Notas**, **Competidores** | Monitor and decide next actions |

You can skip Google until later; Phase 1 structure + simple AI draft works without OAuth.

---

## 4. Scope bar (project filter)

On most screens you see a **project filter** (ScopeBar): one project or “all”.

- **One project** — only that site’s niches, pages, keywords, data, jobs.
- **All** — overview across sites (some Phase 2 screens fall back to the first project for actions that need a single site).

Always set the filter before creating or editing so new rows land on the right website.

---

## 5. Sidebar map — every section

### Trabajo (daily structure)

| Menu | Purpose |
|---|---|
| **Panel** | Snapshot: counts, niche states, SEO alerts (orphans + cannibalized keywords), recent pages, 28‑day performance teaser |
| **Proyectos** | Create/edit websites; store GSC URL prefix and GA4 property ID |
| **Nichos** | Strategic topics inside a project (state + monetization) |
| **Páginas** | Planned content units (type + workflow state + objective) |
| **Palabras clave** | Terms assigned to pages; search intent; cannibalization flag |
| **URLs** | Published path/slug and index status for each page |

### SEO

| Menu | Purpose |
|---|---|
| **Enlazado interno** | From-page → to-page links with anchor text; banner of **orphan pages** (no incoming links) |
| **Notas** | Free-form strategy notes per project |

### Asistente

| Menu | Purpose |
|---|---|
| **Generador IA** | One-click content draft for a selected page (uses page type + keywords). Simpler than the 5 assistants. |

### Datos (needs Google sync to be useful)

| Menu | Purpose |
|---|---|
| **Rendimiento** | Winning / declining / needs-work / stable pages (last 28 days) |
| **Search Console** | Impressions, clicks, CTR, position by URL |
| **Analytics** | Sessions, users, bounce, engagement |
| **Keywords Ads** | Keyword Planner volume, competition, CPC (Google Ads account) |
| **Análisis SEO** | Option 2: DataForSEO research job (keywords, SERP, on-page, backlinks, link gap) with hard cost caps |
| **Productos** | Real product facts for AI (no invented prices/stock) |

### Integraciones

| Menu | Purpose |
|---|---|
| **Google OAuth** | Connect / disconnect GSC, GA4, Ads per project |
| **Sincronización** | Scheduled + manual jobs that fill historical tables |
| **Competidores** | Rival domains for the Competitor Analyst assistant |

### IA avanzada

| Menu | Purpose |
|---|---|
| **Asistentes IA** | Five specialized roles with editable prompts; some inject live metrics |
| **Editor de prompts** | Change system prompts / default models without code |

### Publicación

| Menu | Purpose |
|---|---|
| **WordPress** | Export project structure as JSON for manual WP import — **no auto-publish** |

---

## 6. Screen-by-screen: fields and options

### 6.1 Panel (Dashboard)

**What you see**

- Counts: projects, niches, pages, keywords  
- Performance strip (if data exists): total clicks, winning / declining / needs-work  
- Niches by lifecycle state (bar chart)  
- SEO alerts: orphan pages, cannibalized terms  
- Recent pages table  

**What to use it for**  
Morning overview: “Is structure healthy? What’s bleeding traffic?”

---

### 6.2 Proyectos

**Rule:** one project ≈ one website.

| Field | Meaning |
|---|---|
| **Nombre** | Label for the site in the CRM |
| **Descripción** | Optional notes |
| **URL Search Console** | Exact GSC property (usually URL-prefix like `https://www.yoursite.com/`). Required when creating a new project. Needed before GSC OAuth. |
| **GA4 Property ID** | Analytics property (e.g. `123456789`). Needed before GA4 OAuth. |

**Actions:** + Nuevo proyecto · Editar · Eliminar  

Deleting a project cascades to its niches, pages, keywords, etc. — treat as destructive.

---

### 6.3 Nichos

| Field | Meaning |
|---|---|
| **Nombre** | Niche name (your strategic unit) |
| **Tema** | Short topic description (fed to AI as context) |
| **Proyecto** | Which website owns this niche |
| **Estado** | Lifecycle (see table below) |
| **Monetización** | How this niche earns money |
| **Notas** | Free notes on strategy |

**Niche states**

| State | Meaning (how to use it) |
|---|---|
| **Nuevo** | Just created; not validated yet |
| **En prueba** | Testing content / early signals |
| **Con señales** | Early traffic or ranking signals appear |
| **Escalando** | Working — invest more pages/links |
| **Dormido** | Paused / deprioritized |

**Monetization options:** Afiliación · AdSense · Mixto · Leads  

These do not auto-change money systems; they tag strategy for you (and for future AI context).

---

### 6.4 Páginas

A **page** is planned content, not necessarily live yet.

| Field | Meaning |
|---|---|
| **Título** | Working title (AI uses this as the page name) |
| **Nicho** | Parent niche (sets project automatically) |
| **Tipo** | Content template — drives AI draft shape (see below) |
| **Estado** | Editorial workflow |
| **Objetivo** | Why this page exists (AI reads this) |

**Page types (TSG / TSR / TSA)**

| Code | Label | Use when |
|---|---|---|
| **TSG** | Guía | Informational / pillar guide |
| **TSR** | Comparativa | Comparison / commercial roundup |
| **TSA** | Reseña | Single product review |

The simple **Generador IA** uses a different prompt per type (meta + H1 + body + FAQ; TSR adds comparison structure, TSA review structure).

**Page states**

| State | Meaning |
|---|---|
| **Borrador** | Idea / not ready |
| **En revisión** | Being checked |
| **Publicado** | Live on the site |
| **Optimizado** | Live and improved after data |

---

### 6.5 Palabras clave (Keywords)

| Field | Meaning |
|---|---|
| **Término** | The search query you target |
| **Página** | Which page owns this keyword (also sets niche + project) |
| **Intención** | Search intent |
| **Nota** | Optional note |

**Intent options**

| Intent | Typical use |
|---|---|
| **Informacional** | Learn / how-to (often TSG) |
| **Comercial** | Compare / research before buy (often TSR) |
| **Transaccional** | Ready to buy / convert (often TSA or landing) |

**Canibalización**  
If the same term is assigned to more than one page, the UI flags **Canibalización**. That means two pages fight for the same query — usually bad. Fix by reassigning or merging intent.

**How this feeds AI**  
Keywords on the selected page are listed in the generation prompt. Empty keywords → weaker, more generic drafts.

---

### 6.6 URLs

| Field | Meaning |
|---|---|
| **Slug** | Path, e.g. `/mejores-botas-senderismo` |
| **Página** | Which planned page this live URL maps to |
| **Indexación** | Index status in Google |
| **Estado** | Free text status note |

**Indexation**

| Value | Meaning |
|---|---|
| **Indexada** | In Google’s index |
| **Pendiente** | Waiting / not confirmed |
| **No index** | Intentionally or currently not indexed |

This is your **execution layer**: structure (page) vs what is actually live (URL).

---

### 6.7 Enlazado interno

| Field | Meaning |
|---|---|
| **Desde** | Source page |
| **Hacia** | Target page |
| **Ancla** | Anchor text (optional) |

**Páginas huérfanas** banner lists pages with **no incoming** internal links — hard for users and crawlers to find. Plan links so money/important pages get internal equity.

---

### 6.8 Notas

Simple project notes (title + body). Use for strategy, client decisions, campaign logs — not for page content.

---

### 6.9 Generador IA (simple)

| Control | Meaning |
|---|---|
| **Página de destino** | Page to draft for (shows type, niche, keywords under the selector) |
| **Modelo** | `gpt-4o-mini` (fast/cheap) or `gpt-4o` (higher quality) |
| **Generar borrador** | Calls OpenAI with type-specific system prompt + page/niche/keyword context |
| **Copiar** | Copy result for WordPress / docs |

**Important**

- Draft is stored as a content draft (status: borrador).  
- You always review/edit; nothing is published.  
- Needs `OPENAI_API_KEY` on the server.  
- Does **not** inject GSC/GA4 metrics (that’s the advanced Content Generator assistant).

---

### 6.10 Rendimiento

Uses synced GSC + Analytics history (28-day window).

| Pill filter | Meaning |
|---|---|
| **Ganadoras** | Performing well / uptrend |
| **En caída** | Losing clicks/position |
| **Necesitan trabajo** | Priority to improve |
| **Estables** | Flat |

Use this to choose **which page** to send into **Optimizador Continuo** or to update manually.

---

### 6.11 Search Console / Analytics / Keywords Ads

Read-only data browsers for synced tables:

- **GSC** — query/URL performance from Search Console  
- **Analytics** — on-site behavior from GA4  
- **Keywords Ads** — volumes/CPC from Keyword Planner (when Ads is connected and configured)

Empty tables usually mean: OAuth not connected, wrong project scope, or sync not run yet → go to **Integraciones** then **Sincronización**.

### Keywords Ads vs Análisis SEO (Option 2)

| | **Keywords Ads** | **Análisis SEO (Option 2)** |
|---|---|---|
| Source | Google Ads Keyword Planner (your Ads account) | DataForSEO API pack |
| Input | CRM **keywords** only | Site URL + up to 3 competitors + seed keywords |
| Output | volume / competition / CPC in `ads_keywords` | Full research job history + SERP + backlinks + report |
| Cost control | Google Ads account | Hard caps + monthly soft/hard EUR budget |

See also in-app **Ayuda → Option 2** and `docs/OPTION2_DATAFORSEO_GUIDE.md`.

---

### 6.12 Google OAuth (Integrations)

Per **project**, connect:

1. **Search Console** — requires GSC URL on the project  
2. **Analytics** — requires GA4 property ID on the project  
3. **Ads** — needs OAuth + developer token on server for Keyword Planner  

**Actions:** Connect (browser OAuth) · Disconnect  

Tokens live in the backend (`google_auth`). Priority recommended: GSC → GA4 → Ads.

---

### 6.13 Sincronización

Background jobs per project:

| Job type | Typical schedule (seeded) | Fills |
|---|---|---|
| **gsc** | Daily | GSC historical metrics |
| **ga4** | Daily | Analytics historical metrics |
| **ads** | Weekly | Ads keyword metrics |

**Options on each job**

- **Run now** — pull immediately  
- **Enable / pause** — scheduled runs on/off  

Flow: OAuth → jobs → adapters → historical tables → Performance + AI metrics.

---

### 6.14 Competidores

| Field | Meaning |
|---|---|
| **Dominio** | Rival domain |
| **Proyecto** (and optional niche) | Where this rival applies |
| **Notas** | What you care about |

Used by **Analista de Competencia**. No automatic scrape of Ahrefs/Semrush yet — you store domains and notes; AI reasons from that + your structure.

---

### 6.15 Asistentes IA (5 roles)

Pick a tab, set inputs, run. Always supervised output.

| Assistant | Best input | What it does |
|---|---|---|
| **Arquitecto SEO** | Niche | Propose pillars/clusters, priorities, internal linking |
| **Clasificador de Keywords** | Niche | Intent, priority, suggested page, cannibalization warnings |
| **Generador de Contenido (enriquecido)** | Page | Draft like Generador IA but can include **GSC/GA4 metrics** if synced |
| **Analista de Competencia** | Competitor (+ project context) | Gaps and differentiation vs rival |
| **Optimizador Continuo** | Page | Concrete fixes when metrics show decline or underperformance |

**Shared controls**

- **Modelo** — overrides prompt default for this run  
- **Contexto extra** — free text you add to the user prompt  
- Link to **Editor de prompts**

---

### 6.16 Editor de prompts

Each assistant has a row in the database (`ai_prompts`):

- **Descripción**  
- **Modelo por defecto**  
- **System prompt** (full instructions)  

Edit → save → next assistant run uses the new text. No deploy needed. This is how you tune tone, language, and rules for the whole team.

---

### 6.17 WordPress

**Generar export WP** builds a JSON bundle for the selected project: titles, slugs, meta fields, types, states, etc.

- **Copy / download JSON** for your own import process  
- CRM does **not** post to WordPress for you  

---

## 7. How niches + projects + keywords + AI connect (story)

Example: you own `hiking-gear.es`.

1. **Proyecto** “Hiking Gear ES” with GSC `https://www.hiking-gear.es/` and GA4 ID.  
2. **Nicho** “Botas de montaña”, state *En prueba*, monetization *Afiliación*.  
3. **Páginas** under that niche:  
   - TSG “Guía de botas de trekking”  
   - TSR “Mejores botas 2026”  
   - TSA “Reseña Salomon X Ultra”  
4. **Keywords**:  
   - “cómo elegir botas de trekking” → guide (informacional)  
   - “mejores botas de montaña” → comparison (comercial)  
   - “salomon x ultra opinión” → review (transaccional)  
5. **Generador IA** on the guide page → draft using title, TSG template, niche topic, and those keywords.  
6. You publish on WP, add **URL** `/guia-botas-trekking`, mark index **Pendiente** then **Indexada**.  
7. Connect Google, **sync**, watch **Rendimiento**.  
8. If the guide drops, run **Optimizador Continuo** on that page — it sees 28‑day metrics + keywords and suggests title/snippet/link fixes.  
9. **Arquitecto SEO** on the niche when you want the next cluster of pages.

Nothing requires you to chain GPTs in Make/Zapier: context is the CRM database.

---

## 8. Two AI paths (don’t confuse them)

| | Generador IA (`/ai`) | Asistentes IA (`/assistants`) |
|---|---|---|
| **Focus** | One content draft | Strategy, classification, content, competitors, optimization |
| **Prompt source** | Hard-coded by page type in backend | Editable rows in **Editor de prompts** |
| **Metrics** | No | Content Generator + Optimizer yes (if synced) |
| **When to use** | Fast draft for a known page | Full SEO workflow |

---

## 9. What the system does *not* do alone

- Does not publish to WordPress  
- Does not invent traffic numbers without real metrics (prompts instruct honesty)  
- Does not fix cannibalization automatically — only flags it  
- Does not create niches/pages from assistants automatically — assistants **propose**; you create records if you accept  

You remain the editor-in-chief.

---

## 10. Quick glossary

| Term | Meaning |
|---|---|
| **Project** | One website + its Google properties |
| **Niche** | Strategic topic/market inside a project |
| **Page** | Planned content unit (TSG/TSR/TSA) |
| **Keyword** | Search term owned by one page |
| **URL** | Live slug + index state for a page |
| **Cannibalization** | Same keyword on multiple pages |
| **Orphan page** | Page with no internal links pointing to it |
| **Scope** | Filter “which project am I looking at” |
| **Sync** | Job that copies Google data into CRM tables |
| **Supervised AI** | AI proposes text; human approves and publishes |

---

## 11. If something looks empty

| Symptom | Likely fix |
|---|---|
| No niches/pages | Create project first, then niches, then pages |
| AI weak or generic | Add keywords + objective on the page |
| AI error / 503 | Server missing OpenAI API key |
| No GSC/GA data | Set GSC URL / GA4 ID → OAuth → Sync run |
| Performance all zeros | Wait for successful sync; check project scope |
| Ads keywords empty | Ads OAuth + developer token + ads sync job |
| Wrong site’s data | Change ScopeBar to the correct project |

---

## 12. One-page cheat sheet

```
PROJECT  = website + Google IDs
NICHE    = topic you attack (state + money model)
PAGE     = content plan (type TSG/TSR/TSA + workflow state)
KEYWORD  = query owned by one page (intent; watch cannibalization)
URL      = live path + index flag
LINKS    = internal graph; fix orphans
NOTES    = strategy scratchpad

GOOGLE   = OAuth on project → Sync → tables
DATA UI  = GSC / Analytics / Ads / Performance
AI SIMPLE = Generador (page + keywords → draft)
AI PRO   = 5 assistants (prompts editable; some use metrics)
WP       = export only; you publish

Always: structure first → assign keywords → then AI → then human review.
```

---

If a screen label or option still feels unclear while you click through, note the menu name + field label and we can extend this guide in the same plain style.
