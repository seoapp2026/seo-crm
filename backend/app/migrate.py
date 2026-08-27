from sqlalchemy import inspect, text

from app.database import engine


def run_light_migrations():
    """Add columns to existing DBs without Alembic."""
    insp = inspect(engine)
    statements = []
    if "projects" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("projects")}
        if "gsc_site_url" not in cols:
            statements.append("ALTER TABLE projects ADD COLUMN gsc_site_url TEXT")
        if "ga4_property_id" not in cols:
            statements.append("ALTER TABLE projects ADD COLUMN ga4_property_id TEXT")

    if "ai_prompts" in insp.get_table_names():
        prompt_cols = {c["name"] for c in insp.get_columns("ai_prompts")}
        if "sort_order" not in prompt_cols:
            statements.append("ALTER TABLE ai_prompts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
        if "is_system" not in prompt_cols:
            statements.append("ALTER TABLE ai_prompts ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT 0")
        if "project_id" not in prompt_cols:
            statements.append("ALTER TABLE ai_prompts ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE")

    if not statements:
        return

    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))