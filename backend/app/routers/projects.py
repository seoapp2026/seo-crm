from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GoogleAuth, GoogleServiceType, Project
from app.schemas import ProjectCreate, ProjectOut, ProjectUpdate
from app.services.project_targets import (
    apply_project_targets_to_auth,
    normalize_ga4_property_id,
    normalize_gsc_site_url,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _apply_payload(project: Project, payload: ProjectCreate | ProjectUpdate):
    data = payload.model_dump(exclude_unset=True)
    if "gsc_site_url" in data:
        project.gsc_site_url = normalize_gsc_site_url(data.pop("gsc_site_url"))
    if "ga4_property_id" in data:
        project.ga4_property_id = normalize_ga4_property_id(data.pop("ga4_property_id"))
    for field, value in data.items():
        setattr(project, field, value)


def _sync_auth_targets(db, project: Project):
    for service in (GoogleServiceType.gsc, GoogleServiceType.ga4):
        auth = (
            db.query(GoogleAuth)
            .filter(GoogleAuth.project_id == project.id, GoogleAuth.service == service)
            .first()
        )
        if auth:
            apply_project_targets_to_auth(db, project, auth)


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.created_at.desc()).all()


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(name=payload.name)
    _apply_payload(project, payload)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    _apply_payload(project, payload)
    db.commit()
    db.refresh(project)
    _sync_auth_targets(db, project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    db.delete(project)
    db.commit()