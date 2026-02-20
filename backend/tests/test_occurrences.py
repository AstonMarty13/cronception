"""Unit tests for the occurrences service."""

from datetime import datetime, timedelta, timezone

import pytest

from app.schemas import ParsedJob
from app.services.occurrences import heatmap_for_window, occurrences_for_window

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

UTC = timezone.utc

# Fixed window offset by 30 seconds so that whole-minute boundaries
# are never exactly on from_dt, making expected counts unambiguous.
# 2024-01-01 is a Monday (weekday=0).
WINDOW_FROM = datetime(2024, 1, 1, 0, 0, 30, tzinfo=UTC)   # 00:00:30
WINDOW_TO   = datetime(2024, 1, 1, 1, 0, 30, tzinfo=UTC)   # 01:00:30


def make_job(schedule: str, command: str = "/cmd", enabled: bool = True, error=None) -> ParsedJob:
    return ParsedJob(
        line_number=1,
        raw_line=f"{schedule} {command}",
        schedule=schedule,
        command=command,
        enabled=enabled,
        error=error,
    )


# ---------------------------------------------------------------------------
# occurrences_for_window
# ---------------------------------------------------------------------------


def test_every_minute_generates_60_occurrences_in_one_hour():
    jobs = [make_job("* * * * *")]
    _, _, items, _ = occurrences_for_window(jobs, WINDOW_FROM, WINDOW_TO, limit=1000)
    # 00:01 … 01:00 (first whole minute after 00:00:30 is 00:01, last ≤ 01:00:30 is 01:00)
    assert len(items) == 60


def test_occurrences_are_sorted_ascending():
    jobs = [make_job("* * * * *")]
    _, _, items, _ = occurrences_for_window(jobs, WINDOW_FROM, WINDOW_TO, limit=1000)
    times = [item["at"] for item in items]
    assert times == sorted(times)


def test_occurrences_respect_limit():
    jobs = [make_job("* * * * *")]
    _, _, items, _ = occurrences_for_window(jobs, WINDOW_FROM, WINDOW_TO, limit=10)
    assert len(items) == 10


def test_disabled_job_excluded_by_default():
    jobs = [make_job("* * * * *", enabled=False)]
    _, _, items, _ = occurrences_for_window(jobs, WINDOW_FROM, WINDOW_TO, limit=1000)
    assert items == []


def test_disabled_job_included_when_requested():
    jobs = [make_job("* * * * *", enabled=False)]
    _, _, items, _ = occurrences_for_window(
        jobs, WINDOW_FROM, WINDOW_TO, limit=1000, include_disabled=True
    )
    assert len(items) == 60  # same window as above
    assert all(item["enabled"] is False for item in items)


def test_job_with_error_excluded():
    jobs = [make_job("* * * * *", error="Invalid")]
    _, _, items, _ = occurrences_for_window(jobs, WINDOW_FROM, WINDOW_TO, limit=1000)
    assert items == []


def test_reboot_job_excluded():
    jobs = [make_job("@reboot")]
    _, _, items, _ = occurrences_for_window(jobs, WINDOW_FROM, WINDOW_TO, limit=1000)
    assert items == []


def test_multiple_jobs_merged_and_sorted():
    # Window [00:00:30, 01:00:30] — first whole minute is 00:01
    # Job A (0 * * * *): 01:00 → 1 occurrence
    # Job B (*/30 * * * *): 00:30, 01:00 → 2 occurrences
    jobs = [
        make_job("0 * * * *", command="/hourly"),
        make_job("*/30 * * * *", command="/half-hourly"),
    ]
    _, _, items, _ = occurrences_for_window(jobs, WINDOW_FROM, WINDOW_TO, limit=1000)
    assert len(items) == 3
    times = [item["at"] for item in items]
    assert times == sorted(times)


def test_occurrence_fields():
    # Window [00:00:30, 01:00:30]: 0 * * * * fires once at 01:00
    jobs = [make_job("0 * * * *", command="/my-cmd")]
    _, _, items, _ = occurrences_for_window(jobs, WINDOW_FROM, WINDOW_TO, limit=10)
    assert len(items) == 1
    item = items[0]
    assert item["schedule"] == "0 * * * *"
    assert item["command"] == "/my-cmd"
    assert item["enabled"] is True
    assert isinstance(item["at"], datetime)


def test_default_window_is_30_days():
    jobs = [make_job("@daily /cmd")]
    from_dt, to_dt, _, _ = occurrences_for_window(jobs)
    assert (to_dt - from_dt).days == 30


def test_no_jobs_returns_empty():
    _, _, items, _ = occurrences_for_window([], WINDOW_FROM, WINDOW_TO)
    assert items == []


# ---------------------------------------------------------------------------
# heatmap_for_window
# ---------------------------------------------------------------------------


def test_heatmap_every_minute_one_hour():
    # Window [00:00:30, 01:00:30]: * * * * * fires at 00:01…01:00 = 60 times
    # 59 in hour=0, 1 in hour=1, all on day=0 (Monday)
    jobs = [make_job("* * * * *")]
    _, _, cells, max_count, _ = heatmap_for_window(jobs, WINDOW_FROM, WINDOW_TO)

    assert max_count > 0
    total = sum(c["count"] for c in cells)
    assert total == 60


def test_heatmap_cells_have_correct_keys():
    jobs = [make_job("0 12 * * *")]  # noon every day
    from_dt = datetime(2024, 1, 1, tzinfo=UTC)
    to_dt = datetime(2024, 1, 8, tzinfo=UTC)
    _, _, cells, _, _ = heatmap_for_window(jobs, from_dt, to_dt)
    for cell in cells:
        assert "hour" in cell
        assert "day" in cell
        assert "count" in cell
        assert 0 <= cell["hour"] <= 23
        assert 0 <= cell["day"] <= 6
        assert cell["count"] > 0


def test_heatmap_max_count():
    jobs = [make_job("* * * * *")]
    from_dt = datetime(2024, 1, 1, 0, 0, tzinfo=UTC)
    to_dt = datetime(2024, 1, 1, 2, 0, tzinfo=UTC)  # 2 hours
    _, _, cells, max_count, _ = heatmap_for_window(jobs, from_dt, to_dt)
    # Both hours are on the same day — all cells should have count <= max_count
    assert all(c["count"] <= max_count for c in cells)
    assert max_count == max(c["count"] for c in cells)


def test_heatmap_empty_when_no_eligible_jobs():
    jobs = [make_job("@reboot")]
    _, _, cells, max_count, _ = heatmap_for_window(jobs, WINDOW_FROM, WINDOW_TO)
    assert cells == []
    assert max_count == 0


def test_heatmap_disabled_excluded_by_default():
    jobs = [make_job("* * * * *", enabled=False)]
    _, _, cells, max_count, _ = heatmap_for_window(jobs, WINDOW_FROM, WINDOW_TO)
    assert cells == []
    assert max_count == 0


def test_heatmap_hide_noisy_filters_fast_schedules():
    jobs = [make_job("* * * * *"), make_job("0 1 * * *")]
    _, _, cells, _, filtered_noisy_count = heatmap_for_window(
        jobs, WINDOW_FROM, WINDOW_TO, hide_noisy=True
    )
    assert filtered_noisy_count == 1
    # daily 01:00 schedule remains: one run in this window
    assert sum(c["count"] for c in cells) == 1
