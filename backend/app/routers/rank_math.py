from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas_phase2 import (
    RankMathBulkSyncRequest,
    RankMathBulkSyncResponse,
    RankMathImportRequest,
    RankMathImportResponse,
)
from app.services.rank_math_service import (
    bulk_sync_rank_math_metas,
    export_rank_math_csv,
    import_rank_math_csv,
)

router = APIRouter(prefix="/rank-math", tags=["rank-math"])


@router.get("/export/csv")
def download_rank_math_csv(
    project_id: int = Query(...),
    db: Session = Depends(get_db),
):
    csv_text = export_rank_math_csv(db, project_id)
    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=rank-math-seo-project-{project_id}.csv"
        },
    )


@router.post("/import/csv", response_model=RankMathImportResponse)
def import_csv(
    payload: RankMathImportRequest,
    db: Session = Depends(get_db),
):
    return import_rank_math_csv(
        db=db,
        project_id=payload.project_id,
        csv_content=payload.csv_content,
    )


@router.post("/bulk-sync-metas", response_model=RankMathBulkSyncResponse)
def bulk_sync_metas(
    payload: RankMathBulkSyncRequest,
    db: Session = Depends(get_db),
):
    return bulk_sync_rank_math_metas(
        db=db,
        project_id=payload.project_id,
        page_ids=payload.page_ids,
        overwrite_existing=payload.overwrite_existing,
        title_suffix=payload.title_suffix,
    )