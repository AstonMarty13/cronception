from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from croniter import croniter

from app.schemas import ParsedJob

# @reboot has no time-based schedule — skip it during generation
_SKIP_SCHEDULES = frozenset({"@reboot"})

# Safety cap: max occurrences generated per job before stopping
_PER_JOB_MAX = 50_000

# Noisy job detection: schedules averaging more than this many runs/day are
# considered "noisy" and can be excluded from occurrence queries.
_NOISY_THRESHOLD = 5  # runs per day

# Fixed 2-day reference window used to measure noisiness.
# Using a fixed window keeps the computation fast and deterministic.
_NOISY_TEST_FROM = datetime(2024, 1, 1, tzinfo=timezone.utc)
_NOISY_TEST_TO = datetime(2024, 1, 3, tzinfo=timezone.utc)  # 2 days


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _default_window() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    return now, now + timedelta(days=30)


def _ensure_utc(dt: datetime | None, default: datetime) -> datetime:
    if dt is None:
        return default
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _eligible_jobs(
    jobs: list[ParsedJob], include_disabled: bool
) -> list[ParsedJob]:
    return [
        j
        for j in jobs
        if (include_disabled or j.enabled)
        and j.error is None
        and j.schedule not in _SKIP_SCHEDULES
    ]


def _iter_schedule(schedule: str, from_dt: datetime, to_dt: datetime):
    """Yield occurrence datetimes for a schedule string in [from_dt, to_dt]."""
    try:
        it = croniter(schedule, from_dt - timedelta(seconds=1))
        count = 0
        while count < _PER_JOB_MAX:
            dt = it.get_next(datetime)
            if dt > to_dt:
                break
            yield dt
            count += 1
    except (ValueError, KeyError):
        return


def _iter_job_datetimes(
    job: ParsedJob, from_dt: datetime, to_dt: datetime
):
    """Yield all occurrence datetimes for a single job in [from_dt, to_dt]."""
    yield from _iter_schedule(job.schedule, from_dt, to_dt)


def _is_noisy(schedule: str) -> bool:
    """Return True if the schedule fires more than _NOISY_THRESHOLD times/day."""
    days = (_NOISY_TEST_TO - _NOISY_TEST_FROM).days
    count = sum(1 for _ in _iter_schedule(schedule, _NOISY_TEST_FROM, _NOISY_TEST_TO))
    return (count / days) > _NOISY_THRESHOLD


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def occurrences_for_window(
    jobs: list[ParsedJob],
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    limit: int = 500,
    include_disabled: bool = False,
    hide_noisy: bool = False,
) -> tuple[datetime, datetime, list[dict], int]:
    """
    Return (from_dt, to_dt, occurrences, filtered_noisy_count) sorted by `at`.

    When hide_noisy=True, schedules firing more than _NOISY_THRESHOLD times/day
    are excluded *before* the limit is applied, so the limit covers the full
    requested window for the remaining jobs.

    Each occurrence dict:
        schedule    – cron expression
        command     – shell command
        enabled     – whether the job is active
        at          – UTC datetime of the run
        description – optional comment above the job in the crontab
    """
    default_from, default_to = _default_window()
    from_dt = _ensure_utc(from_dt, default_from)
    to_dt = _ensure_utc(to_dt, default_to)

    eligible = _eligible_jobs(jobs, include_disabled)

    filtered_noisy_count = 0
    if hide_noisy:
        noisy = {j.schedule for j in eligible if _is_noisy(j.schedule)}
        filtered_noisy_count = len(noisy)
        eligible = [j for j in eligible if j.schedule not in noisy]

    pairs: list[tuple[datetime, dict]] = []
    for job in eligible:
        for dt in _iter_job_datetimes(job, from_dt, to_dt):
            pairs.append(
                (
                    dt,
                    {
                        "schedule": job.schedule,
                        "command": job.command,
                        "enabled": job.enabled,
                        "at": dt,
                        "description": job.description,
                    },
                )
            )

    pairs.sort(key=lambda x: x[0])
    return from_dt, to_dt, [item for _, item in pairs[:limit]], filtered_noisy_count


def heatmap_for_window(
    jobs: list[ParsedJob],
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    include_disabled: bool = False,
    hide_noisy: bool = False,
) -> tuple[datetime, datetime, list[dict], int, int]:
    """
    Return (from_dt, to_dt, cells, max_count, filtered_noisy_count).

    Each cell dict:
        hour  – 0-23
        day   – 0-6  (Python weekday: 0=Monday … 6=Sunday)
        count – number of occurrences in that (hour, day) slot
    """
    default_from, default_to = _default_window()
    from_dt = _ensure_utc(from_dt, default_from)
    to_dt = _ensure_utc(to_dt, default_to)

    eligible = _eligible_jobs(jobs, include_disabled)
    filtered_noisy_count = 0
    if hide_noisy:
        noisy = {j.schedule for j in eligible if _is_noisy(j.schedule)}
        filtered_noisy_count = len(noisy)
        eligible = [j for j in eligible if j.schedule not in noisy]

    counts: dict[tuple[int, int], int] = defaultdict(int)
    for job in eligible:
        for dt in _iter_job_datetimes(job, from_dt, to_dt):
            counts[(dt.hour, dt.weekday())] += 1

    cells = [
        {"hour": h, "day": d, "count": c}
        for (h, d), c in sorted(counts.items())
    ]
    max_count = max((cell["count"] for cell in cells), default=0)
    return from_dt, to_dt, cells, max_count, filtered_noisy_count
