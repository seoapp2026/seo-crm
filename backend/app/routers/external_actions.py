import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ActionLog, Note, Page, PageState, Project

router = APIRouter(prefix="/external", tags=["external"])

VALID_ACTIONS = ("set_priority", "set_approval", "add_note", "set_state", "save_external_data")


class ExternalActionIn(BaseModel):
    project_id: int
    page_id: int | None = None
    action: str
    payload: dict = Field(default_factory=dict)


def _error(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": False, "error": message})


def _require_page(body: ExternalActionIn, page: Page | None) -> JSONResponse | None:
    if page is None:
        return _error(400, "page_id es obligatorio para esta acción")
    return None


def _write_log(db: Session, action: str, entity: str, entity_id: int, payload: dict) -> ActionLog:
    log = ActionLog(
        action=action,
        entity=entity,
        entity_id=entity_id,
        payload_json=json.dumps(payload, ensure_ascii=False, default=str),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.post("/actions")
def receive_external_action(body: ExternalActionIn, db: Session = Depends(get_db)):
    if body.action not in VALID_ACTIONS:
        return _error(400, f"Acción no válida: {body.action}")

    project = db.get(Project, body.project_id)
    if not project:
        return _error(404, "Proyecto no encontrado")

    page = None
    if body.page_id is not None:
        page = db.get(Page, body.page_id)
        if not page or page.project_id != project.id:
            return _error(404, "Página no encontrada")

    payload = body.payload or {}

    if body.action == "set_priority":
        err = _require_page(body, page)
        if err:
            return err
        priority = payload.get("priority")
        if not isinstance(priority, int) or isinstance(priority, bool):
            return _error(400, "payload.priority debe ser un entero")
        page.priority = priority
        entity, entity_id = "page", page.id
    elif body.action == "set_approval":
        err = _require_page(body, page)
        if err:
            return err
        approval_status = payload.get("approval_status")
        if not approval_status:
            return _error(400, "payload.approval_status es obligatorio")
        page.approval_status = str(approval_status)
        if payload.get("approved_action") is not None:
            page.approved_action = str(payload["approved_action"])
        if payload.get("notes") is not None:
            page.execution_notes = str(payload["notes"])
        entity, entity_id = "page", page.id
    elif body.action == "add_note":
        title = payload.get("title")
        if not title:
            return _error(400, "payload.title es obligatorio")
        note = Note(project_id=project.id, title=str(title), body=payload.get("body"))
        db.add(note)
        db.commit()
        db.refresh(note)
        entity, entity_id = "note", note.id
    elif body.action == "set_state":
        err = _require_page(body, page)
        if err:
            return err
        try:
            page.state = PageState(payload.get("state"))
        except ValueError:
            return _error(400, f"Estado no válido: {payload.get('state')}")
        entity, entity_id = "page", page.id
    else:  # save_external_data
        err = _require_page(body, page)
        if err:
            return err
        data = payload.get("data")
        if not isinstance(data, dict):
            return _error(400, "payload.data debe ser un objeto")
        page.execution_notes = "external:" + json.dumps(data, ensure_ascii=False)
        entity, entity_id = "page", page.id

    if body.action != "add_note":
        if page is not None:
            page.updated_at = datetime.now(timezone.utc)
        db.commit()

    log = _write_log(db, body.action, entity, entity_id, payload)
    timestamp = log.created_at if log.created_at else datetime.now(timezone.utc)
    return {
        "success": True,
        "action_id": log.id,
        "entity_id": entity_id,
        "timestamp": timestamp.isoformat(),
    }
