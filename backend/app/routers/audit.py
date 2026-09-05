from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project
from app.services.export_audit import audit_project_export

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/export-audit")
def export_audit(project_id: int = Query(...), db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    report = audit_project_export(db, project_id)
    report["project_name"] = project.name
    return report
