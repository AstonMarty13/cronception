from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

import aiosqlite

from app.db.database import get_db
from app.db.repository import CrontabRepository
from app.schemas import (
    CrontabCreate,
    CrontabResponse,
    CrontabSummary,
    CrontabUpdate,
    CrontabParseResult,
    ParseCrontabRequest,
    HeatmapRequest,
    HeatmapResponse,
    HeatmapCell,
    OccurrenceRequest,
    OccurrenceItem,
    OccurrencesResponse,
)
from app.services.parser import parse_crontab
from app.services.occurrences import occurrences_for_window, heatmap_for_window

router = APIRouter(prefix="/api/crontabs", tags=["crontabs"])

DB = Annotated[aiosqlite.Connection, Depends(get_db)]


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------


async def _get_or_404(id: str, db: aiosqlite.Connection) -> dict:
    row = await CrontabRepository(db).get_by_id(id)
    if row is None:
        raise HTTPException(status_code=404, detail="Crontab not found")
    return row


# ---------------------------------------------------------------------------
# Parse (stateless — no DB)
# ---------------------------------------------------------------------------


@router.post("/parse", response_model=CrontabParseResult)
def parse(payload: ParseCrontabRequest) -> CrontabParseResult:
    return parse_crontab(payload.raw_text)


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.get("", response_model=list[CrontabSummary])
async def list_crontabs(db: DB) -> list[CrontabSummary]:
    repo = CrontabRepository(db)
    rows = await repo.get_all()
    summaries = []
    for row in rows:
        result = parse_crontab(row["raw_text"])
        summaries.append(CrontabSummary.from_row(row, job_count=len(result.jobs)))
    return summaries


@router.post("", response_model=CrontabResponse, status_code=status.HTTP_201_CREATED)
async def create_crontab(payload: CrontabCreate, db: DB) -> CrontabResponse:
    repo = CrontabRepository(db)
    row = await repo.create(payload)
    return CrontabResponse.from_row(row)


@router.get("/{id}", response_model=CrontabResponse)
async def get_crontab(id: str, db: DB) -> CrontabResponse:
    row = await _get_or_404(id, db)
    return CrontabResponse.from_row(row)


@router.put("/{id}", response_model=CrontabResponse)
async def update_crontab(id: str, payload: CrontabUpdate, db: DB) -> CrontabResponse:
    row = await CrontabRepository(db).update(id, payload)
    if row is None:
        raise HTTPException(status_code=404, detail="Crontab not found")
    return CrontabResponse.from_row(row)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_crontab(id: str, db: DB) -> None:
    deleted = await CrontabRepository(db).delete(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Crontab not found")


# ---------------------------------------------------------------------------
# Occurrences  (flat sorted list — used by Calendar and general queries)
# ---------------------------------------------------------------------------


@router.post("/{id}/occurrences", response_model=OccurrencesResponse)
async def get_occurrences(
    id: str, payload: OccurrenceRequest, db: DB
) -> OccurrencesResponse:
    row = await _get_or_404(id, db)
    jobs = parse_crontab(row["raw_text"]).jobs
    from_dt, to_dt, items, filtered_noisy_count = occurrences_for_window(
        jobs,
        from_dt=payload.from_dt,
        to_dt=payload.to_dt,
        limit=payload.limit,
        hide_noisy=payload.hide_noisy,
    )
    return OccurrencesResponse(
        from_dt=from_dt,
        to_dt=to_dt,
        occurrences=[OccurrenceItem(**item) for item in items],
        filtered_noisy_count=filtered_noisy_count,
    )


# ---------------------------------------------------------------------------
# Aggregations
# ---------------------------------------------------------------------------


@router.post("/{id}/aggregate/timeline", response_model=OccurrencesResponse)
async def get_timeline(
    id: str, payload: OccurrenceRequest, db: DB
) -> OccurrencesResponse:
    """Sorted list of upcoming runs — same shape as /occurrences, distinct route for clarity."""
    row = await _get_or_404(id, db)
    jobs = parse_crontab(row["raw_text"]).jobs
    from_dt, to_dt, items, filtered_noisy_count = occurrences_for_window(
        jobs,
        from_dt=payload.from_dt,
        to_dt=payload.to_dt,
        limit=payload.limit,
        hide_noisy=payload.hide_noisy,
    )
    return OccurrencesResponse(
        from_dt=from_dt,
        to_dt=to_dt,
        occurrences=[OccurrenceItem(**item) for item in items],
        filtered_noisy_count=filtered_noisy_count,
    )


@router.post("/{id}/aggregate/heatmap", response_model=HeatmapResponse)
async def get_heatmap(
    id: str, payload: HeatmapRequest, db: DB
) -> HeatmapResponse:
    row = await _get_or_404(id, db)
    jobs = parse_crontab(row["raw_text"]).jobs
    from_dt, to_dt, cells, max_count, filtered_noisy_count = heatmap_for_window(
        jobs,
        from_dt=payload.from_dt,
        to_dt=payload.to_dt,
        hide_noisy=payload.hide_noisy,
    )
    return HeatmapResponse(
        from_dt=from_dt,
        to_dt=to_dt,
        data=[HeatmapCell(**cell) for cell in cells],
        max_count=max_count,
        filtered_noisy_count=filtered_noisy_count,
    )
