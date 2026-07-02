from sqlalchemy import inspect, text

from app.database import engine


def run_light_migrations():
    """Add columns to existing DBs without Alembic."""
    insp = inspect(engine)
    if "projects" not in insp.get_table_names():
        return

    cols = {c["name"] for c in insp.get_columns("projects")}
    statements = []
    if "gsc_site_url" not in cols:
        statements.append("ALTER TABLE projects ADD COLUMN gsc_site_url TEXT")
    if "ga4_property_id" not in cols:
        statements.append("ALTER TABLE projects ADD COLUMN ga4_property_id TEXT")

    if not statements:
        return

    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))