from sqlalchemy import inspect, text

from app.database import engine


def run_light_migrations():
    """Add columns to existing DBs without Alembic."""
    insp = inspect(engine)
    is_pg = engine.dialect.name == "postgresql"
    statements = []

    if "projects" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("projects")}
        if "gsc_site_url" not in cols:
            statements.append("ALTER TABLE projects ADD COLUMN gsc_site_url TEXT")
        if "ga4_property_id" not in cols:
            statements.append("ALTER TABLE projects ADD COLUMN ga4_property_id TEXT")
        if "wp_url" not in cols:
            statements.append("ALTER TABLE projects ADD COLUMN wp_url TEXT")
        if "wp_username" not in cols:
            statements.append("ALTER TABLE projects ADD COLUMN wp_username TEXT")
        if "wp_app_password" not in cols:
            statements.append("ALTER TABLE projects ADD COLUMN wp_app_password TEXT")

    if "ai_prompts" in insp.get_table_names():
        prompt_cols = {c["name"] for c in insp.get_columns("ai_prompts")}
        if "sort_order" not in prompt_cols:
            statements.append("ALTER TABLE ai_prompts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
        if "is_system" not in prompt_cols:
            statements.append("ALTER TABLE ai_prompts ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE")
        if "project_id" not in prompt_cols:
            statements.append("ALTER TABLE ai_prompts ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE")
        if is_pg:
            statements.append("ALTER TABLE ai_prompts ALTER COLUMN slug TYPE TEXT USING slug::text")

    if "pages" in insp.get_table_names():
        page_cols = {c["name"] for c in insp.get_columns("pages")}
        if "parent_page_id" not in page_cols:
            statements.append("ALTER TABLE pages ADD COLUMN parent_page_id INTEGER REFERENCES pages(id) ON DELETE SET NULL")
        if "breadcrumb_label" not in page_cols:
            statements.append("ALTER TABLE pages ADD COLUMN breadcrumb_label TEXT")
        if "h1" not in page_cols:
            statements.append("ALTER TABLE pages ADD COLUMN h1 TEXT")
        if "outline_json" not in page_cols:
            statements.append("ALTER TABLE pages ADD COLUMN outline_json TEXT")
        if "seo_title" not in page_cols:
            statements.append("ALTER TABLE pages ADD COLUMN seo_title TEXT")
        if "seo_description" not in page_cols:
            statements.append("ALTER TABLE pages ADD COLUMN seo_description TEXT")
        if "wp_category" not in page_cols:
            statements.append("ALTER TABLE pages ADD COLUMN wp_category TEXT")
        if "wp_tags_json" not in page_cols:
            statements.append("ALTER TABLE pages ADD COLUMN wp_tags_json TEXT")
        if "content_html" not in page_cols:
            statements.append("ALTER TABLE pages ADD COLUMN content_html TEXT")
        if "content_status" not in page_cols:
            statements.append("ALTER TABLE pages ADD COLUMN content_status TEXT NOT NULL DEFAULT 'borrador'")
        if "schema_json" not in page_cols:
            statements.append("ALTER TABLE pages ADD COLUMN schema_json TEXT")
        if "export_ready" not in page_cols:
            statements.append("ALTER TABLE pages ADD COLUMN export_ready BOOLEAN NOT NULL DEFAULT FALSE")

    if "keywords" in insp.get_table_names():
        kw_cols = {c["name"] for c in insp.get_columns("keywords")}
        if "is_primary" not in kw_cols:
            statements.append("ALTER TABLE keywords ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT FALSE")

    if "niches" in insp.get_table_names():
        niche_cols = {c["name"] for c in insp.get_columns("niches")}
        if "layout_template_text" not in niche_cols:
            statements.append("ALTER TABLE niches ADD COLUMN layout_template_text TEXT")

    if "content_drafts" in insp.get_table_names():
        draft_cols = {c["name"] for c in insp.get_columns("content_drafts")}
        if "content_html" not in draft_cols:
            statements.append("ALTER TABLE content_drafts ADD COLUMN content_html TEXT")
        if "draft_kind" not in draft_cols:
            statements.append("ALTER TABLE content_drafts ADD COLUMN draft_kind TEXT NOT NULL DEFAULT 'texto'")
        if "source_prompt_id" not in draft_cols:
            statements.append("ALTER TABLE content_drafts ADD COLUMN source_prompt_id INTEGER REFERENCES ai_prompts(id) ON DELETE SET NULL")
        if "context_used_json" not in draft_cols:
            statements.append("ALTER TABLE content_drafts ADD COLUMN context_used_json TEXT")

    if "products" in insp.get_table_names():
        prod_cols = {c["name"] for c in insp.get_columns("products")}
        if "provider" not in prod_cols:
            statements.append("ALTER TABLE products ADD COLUMN provider TEXT NOT NULL DEFAULT 'manual'")
        if "external_id" not in prod_cols:
            statements.append("ALTER TABLE products ADD COLUMN external_id TEXT")
        if "image_url" not in prod_cols:
            statements.append("ALTER TABLE products ADD COLUMN image_url TEXT")
        if "affiliate_url" not in prod_cols:
            statements.append("ALTER TABLE products ADD COLUMN affiliate_url TEXT")
        if "rating" not in prod_cols:
            statements.append("ALTER TABLE products ADD COLUMN rating TEXT")
        if "raw_payload_json" not in prod_cols:
            statements.append("ALTER TABLE products ADD COLUMN raw_payload_json TEXT")
        if "last_synced_at" not in prod_cols:
            statements.append("ALTER TABLE products ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE" if is_pg else "ALTER TABLE products ADD COLUMN last_synced_at DATETIME")

    if not statements:
        return

    for sql in statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
        except Exception as e:
            print(f"[migrate] Skipped SQL '{sql}': {e}")