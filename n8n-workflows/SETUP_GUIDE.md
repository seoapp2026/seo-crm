# n8n Setup Guide — CRM ↔ Notion Connection

**What you get:** two workflows.
1. `01 · CRM → Notion · Sync Pages` — every 15 min, pulls all pages from the CRM and creates/updates rows in a Notion database (matched by `crm_page_id`). Never touches your approval columns.
2. `02 · Notion → CRM → WordPress · Approval Push` — every 5 min, finds Notion rows where **approval_status = Approved** and **wp_pushed = false**, pushes that page to WordPress via the CRM (zero duplicates — the CRM updates the existing post), then writes the WP Post ID, WP URL and result back to Notion.

**Prerequisites:** the CRM backend running and reachable from n8n (see step 1).

---

## STEP 1 — Make sure n8n can reach the CRM

- n8n on the same machine as the CRM: use `http://localhost:8000/api/seo-crm` in the CONFIG node.
- n8n in Docker on the same machine: use `http://host.docker.internal:8000/api/seo-crm`.
- n8n Cloud (or another server): the CRM must be publicly reachable (e.g. your Railway URL) — `http://localhost` will NOT work from the cloud.

## STEP 2 — Create the CRM API key

While logged into the CRM (cookie), run once (or use Swagger at `/api/seo-crm/docs`):

```bash
curl -X POST https://YOUR-CRM-URL/api/seo-crm/api-keys \
  -H "Content-Type: application/json" \
  -b "your session cookie" \
  -d '{"name":"n8n"}'
```

The key appears **once** (format `seocrm_…`). Copy it immediately.

## STEP 3 — Create the Notion integration

1. Go to https://www.notion.so/my-integrations → **New integration** → name it "SEO CRM" → copy the **Internal Integration Secret** (starts with `secret_…` or `ntn_…`).
2. In Notion, create a new database (full page) named e.g. **CRM Pages**, with **exactly these properties**:

| Property | Type | Notes |
|---|---|---|
| Name | Title | page title |
| crm_page_id | Number | used as the match key |
| project_id | Number | |
| status | Select | options: borrador, en_revision, publicado, optimizado |
| canonical_url | URL | |
| wp_post_id | Number | |
| wp_url | URL | |
| priority | Number | set manually in Notion or via CRM |
| approval_status | Select | options: **Pending** (set as default), Approved, Rejected |
| wp_pushed | Checkbox | |
| push_status | Rich text | error/success messages land here |
| last_sync | Date | |
| last_push | Date | |

3. Click the **⋯ menu (top right of the DB) → Connections → add your "SEO CRM" integration**.
4. Copy the database ID from the URL: `https://www.notion.so/YOURWORKSPACE/`**`2f9c1...32ab4?`**`v=...` (32 hex chars, no dashes).

## STEP 4 — Create the two credentials in n8n

1. **CRM API Key (X-API-Key):** n8n → Credentials → New → *Header Auth* → Name = `X-API-Key`, Value = your `seocrm_…` key from step 2.
2. **Notion Integration (Authorization):** New → *Header Auth* → Name = `Authorization`, Value = `Bearer secret_…` (yes, include the word `Bearer` and a space). The `Notion-Version` header is already set inside the workflow nodes.

> Security: these live in n8n Credentials only — never paste them into Notion pages.

## STEP 5 — Import and configure the workflows

1. n8n → Workflows → **Import from File** → import both JSON files from `n8n-workflows/`.
2. In each workflow, open the **CONFIG** node and set:
   - `base_url` — from step 1 (must end in `/api/seo-crm`)
   - `project_id` — the CRM project number (GET `/v1/projects` with your key if unsure)
   - `notion_database_id` — the 32-char ID from step 3
3. For every HTTP node showing a credential warning, re-select the matching credential from step 4 (import can't carry credentials).

## STEP 6 — Test, then activate

1. **Workflow 01:** "Execute workflow" manually → check your Notion DB fills with CRM pages. Run again → no duplicates (rows update in place).
2. **Workflow 02:** in Notion, set one row to **Approved** (and make sure `wp_pushed` is unchecked) → execute workflow 02 manually → the page pushes to WordPress and the row updates with WP Post ID + URL + `wp_pushed` ticked. Check WP admin: the post exists. Approve the same row again (uncheck `wp_pushed`) → pushes again but **updates the same post** (no duplicate).
3. Activate both workflows (toggle top right).

## Troubleshooting

| Symptom | Fix |
|---|---|
| CRM calls return 401 | API key wrong/revoked; create a new one |
| Notion calls return 401 | credential needs `Bearer ` prefix |
| Notion calls return 404 | integration not added to the DB (step 3.3), or wrong DB id |
| Notion calls return 400 | property name/type mismatch — check the table in step 3 exactly |
| Push "succeeds" but nothing in WP | CRM project's WP credentials (wp_url, wp_username, wp_app_password) missing — set them in project settings |
| More than 1000 pages | raise `limit` in workflow 01 to 1000 (max) and ask for the pagination-loop variant |

## Notes

- **Notion is the boss for approvals.** Workflow 01 deliberately never writes `approval_status`, `priority`, or `wp_pushed` — change those in Notion only.
- Workflow 02 only processes rows marked Approved + not yet pushed; a failed push logs the error into `push_status` and leaves `wp_pushed` unchecked, so it **retries automatically** next cycle.
- CRM endpoints used: `GET /v1/pages`, `POST /v1/wordpress/push`. Full reference: `docs/API_MAP.md`.
