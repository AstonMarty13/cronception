"""Integration tests for /occurrences, /aggregate/timeline, /aggregate/heatmap."""

RAW_CRONTAB = """\
@daily /usr/bin/backup
*/5 * * * * /usr/bin/check
# 0 * * * * /usr/bin/disabled
@reboot /usr/bin/startup
"""

# Offset by 30 s so whole-minute boundaries are never on from_dt/to_dt,
# making expected occurrence counts unambiguous.
FIXED_FROM = "2024-01-01T00:00:30Z"
FIXED_TO   = "2024-01-02T00:00:30Z"  # exactly 24 h later


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def create_crontab(client, raw_text=RAW_CRONTAB):
    r = client.post("/api/crontabs", json={"name": "test", "raw_text": raw_text})
    assert r.status_code == 201
    return r.json()["id"]


def post_payload(from_dt=FIXED_FROM, to_dt=FIXED_TO, limit=500):
    return {"from_dt": from_dt, "to_dt": to_dt, "limit": limit}


# ---------------------------------------------------------------------------
# POST /api/crontabs/{id}/occurrences
# ---------------------------------------------------------------------------


def test_occurrences_200(client):
    cid = create_crontab(client)
    r = client.post(f"/api/crontabs/{cid}/occurrences", json=post_payload())
    assert r.status_code == 200


def test_occurrences_structure(client):
    cid = create_crontab(client)
    data = client.post(f"/api/crontabs/{cid}/occurrences", json=post_payload()).json()

    assert "from_dt" in data
    assert "to_dt" in data
    assert "occurrences" in data
    for item in data["occurrences"]:
        assert "schedule" in item
        assert "command" in item
        assert "enabled" in item
        assert "at" in item


def test_occurrences_only_enabled_jobs(client):
    cid = create_crontab(client)
    data = client.post(f"/api/crontabs/{cid}/occurrences", json=post_payload()).json()
    assert all(item["enabled"] is True for item in data["occurrences"])


def test_occurrences_sorted_ascending(client):
    cid = create_crontab(client)
    data = client.post(f"/api/crontabs/{cid}/occurrences", json=post_payload()).json()
    times = [item["at"] for item in data["occurrences"]]
    assert times == sorted(times)


def test_occurrences_reboot_excluded(client):
    cid = create_crontab(client)
    data = client.post(f"/api/crontabs/{cid}/occurrences", json=post_payload()).json()
    schedules = {item["schedule"] for item in data["occurrences"]}
    assert "@reboot" not in schedules


def test_occurrences_counts_for_known_window(client):
    # Window [00:00:30, 24:00:30]: first whole minute is 00:01
    # @daily (0 0 * * *) fires at 2024-01-02 00:00 → 1 occurrence
    # */5    fires at 00:05, 00:10, … 24:00 → 288 occurrences (24*60/5)
    cid = create_crontab(client)
    data = client.post(
        f"/api/crontabs/{cid}/occurrences", json=post_payload(limit=5000)
    ).json()
    by_schedule: dict[str, int] = {}
    for item in data["occurrences"]:
        by_schedule.setdefault(item["schedule"], 0)
        by_schedule[item["schedule"]] += 1

    assert by_schedule.get("@daily", 0) == 1
    assert by_schedule.get("*/5 * * * *", 0) == 288  # 24 * 60 / 5


def test_occurrences_respects_limit(client):
    cid = create_crontab(client)
    data = client.post(
        f"/api/crontabs/{cid}/occurrences", json=post_payload(limit=5)
    ).json()
    assert len(data["occurrences"]) == 5


def test_occurrences_unknown_id_returns_404(client):
    r = client.post("/api/crontabs/no-such-id/occurrences", json=post_payload())
    assert r.status_code == 404


def test_occurrences_empty_crontab(client):
    cid = create_crontab(client, raw_text="# just a comment\n")
    data = client.post(f"/api/crontabs/{cid}/occurrences", json=post_payload()).json()
    assert data["occurrences"] == []


# ---------------------------------------------------------------------------
# POST /api/crontabs/{id}/aggregate/timeline
# ---------------------------------------------------------------------------


def test_timeline_same_shape_as_occurrences(client):
    cid = create_crontab(client)
    occ = client.post(f"/api/crontabs/{cid}/occurrences", json=post_payload()).json()
    tl = client.post(
        f"/api/crontabs/{cid}/aggregate/timeline", json=post_payload()
    ).json()
    assert occ == tl


def test_timeline_unknown_id_returns_404(client):
    r = client.post("/api/crontabs/no-such-id/aggregate/timeline", json=post_payload())
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/crontabs/{id}/aggregate/heatmap
# ---------------------------------------------------------------------------


def test_heatmap_200(client):
    cid = create_crontab(client)
    r = client.post(
        f"/api/crontabs/{cid}/aggregate/heatmap",
        json={"from_dt": FIXED_FROM, "to_dt": FIXED_TO},
    )
    assert r.status_code == 200


def test_heatmap_structure(client):
    cid = create_crontab(client)
    data = client.post(
        f"/api/crontabs/{cid}/aggregate/heatmap",
        json={"from_dt": FIXED_FROM, "to_dt": FIXED_TO},
    ).json()

    assert "from_dt" in data
    assert "to_dt" in data
    assert "max_count" in data
    assert "data" in data
    for cell in data["data"]:
        assert 0 <= cell["hour"] <= 23
        assert 0 <= cell["day"] <= 6
        assert cell["count"] > 0


def test_heatmap_max_count_matches_data(client):
    cid = create_crontab(client)
    data = client.post(
        f"/api/crontabs/{cid}/aggregate/heatmap",
        json={"from_dt": FIXED_FROM, "to_dt": FIXED_TO},
    ).json()
    if data["data"]:
        assert data["max_count"] == max(c["count"] for c in data["data"])


def test_heatmap_total_count_equals_occurrences(client):
    cid = create_crontab(client)
    occ_data = client.post(
        f"/api/crontabs/{cid}/occurrences",
        json=post_payload(limit=5000),
    ).json()
    hm_data = client.post(
        f"/api/crontabs/{cid}/aggregate/heatmap",
        json={"from_dt": FIXED_FROM, "to_dt": FIXED_TO},
    ).json()

    total_occ = len(occ_data["occurrences"])
    total_hm = sum(c["count"] for c in hm_data["data"])
    assert total_hm == total_occ


def test_heatmap_empty_crontab(client):
    cid = create_crontab(client, raw_text="# nothing here\n")
    data = client.post(
        f"/api/crontabs/{cid}/aggregate/heatmap",
        json={"from_dt": FIXED_FROM, "to_dt": FIXED_TO},
    ).json()
    assert data["data"] == []
    assert data["max_count"] == 0


def test_heatmap_unknown_id_returns_404(client):
    r = client.post(
        "/api/crontabs/no-such-id/aggregate/heatmap",
        json={"from_dt": FIXED_FROM, "to_dt": FIXED_TO},
    )
    assert r.status_code == 404
