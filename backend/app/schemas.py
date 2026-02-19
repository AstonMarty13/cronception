from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Parser schemas
# ---------------------------------------------------------------------------


class ParsedJob(BaseModel):
    line_number: int
    raw_line: str
    schedule: str
    command: str
    enabled: bool
    error: Optional[str] = None


class CrontabParseResult(BaseModel):
    jobs: list[ParsedJob]
    warnings: list[str]


class ParseCrontabRequest(BaseModel):
    raw_text: str


# ---------------------------------------------------------------------------
# Crontab CRUD schemas
# ---------------------------------------------------------------------------


class CrontabCreate(BaseModel):
    name: str
    raw_text: str
    tags: list[str] = []


class CrontabUpdate(BaseModel):
    name: Optional[str] = None
    raw_text: Optional[str] = None
    tags: Optional[list[str]] = None


class CrontabSummary(BaseModel):
    """Lightweight representation used in list responses (no jobs)."""

    id: str
    name: str
    tags: list[str]
    job_count: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: dict, job_count: int) -> CrontabSummary:
        return cls(
            id=row["id"],
            name=row["name"],
            tags=json.loads(row["tags"]),
            job_count=job_count,
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )


class CrontabResponse(BaseModel):
    """Full representation including parsed jobs."""

    id: str
    name: str
    raw_text: str
    tags: list[str]
    jobs: list[ParsedJob]
    warnings: list[str]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: dict) -> CrontabResponse:
        from app.services.parser import parse_crontab  # avoid circular import at module level

        result = parse_crontab(row["raw_text"])
        return cls(
            id=row["id"],
            name=row["name"],
            raw_text=row["raw_text"],
            tags=json.loads(row["tags"]),
            jobs=result.jobs,
            warnings=result.warnings,
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )


# ---------------------------------------------------------------------------
# Occurrence / aggregation schemas
# ---------------------------------------------------------------------------


class OccurrenceRequest(BaseModel):
    from_dt: Optional[datetime] = None
    to_dt: Optional[datetime] = None
    limit: int = Field(default=500, ge=1, le=5000)


class OccurrenceItem(BaseModel):
    schedule: str
    command: str
    enabled: bool
    at: datetime


class OccurrencesResponse(BaseModel):
    from_dt: datetime
    to_dt: datetime
    occurrences: list[OccurrenceItem]


class HeatmapCell(BaseModel):
    hour: int  # 0-23
    day: int   # 0=Monday … 6=Sunday  (Python weekday())
    count: int


class HeatmapRequest(BaseModel):
    from_dt: Optional[datetime] = None
    to_dt: Optional[datetime] = None


class HeatmapResponse(BaseModel):
    from_dt: datetime
    to_dt: datetime
    data: list[HeatmapCell]
    max_count: int
