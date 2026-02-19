"""Integration tests for the crontab CRUD endpoints."""

SAMPLE_RAW = """\
# Daily backup
@daily /usr/bin/backup --quiet
*/5 * * * * /usr/bin/check-service
# 0 * * * * /usr/bin/disabled-task
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def create_crontab(client, name="My crontab", raw_text=SAMPLE_RAW, tags=None):
    payload = {"name": name, "raw_text": raw_text, "tags": tags or []}
    r = client.post("/api/crontabs", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# POST /api/crontabs
# ---------------------------------------------------------------------------


def test_create_returns_201_with_jobs(client):
    data = create_crontab(client)

    assert data["id"]
    assert data["name"] == "My crontab"
    assert data["raw_text"] == SAMPLE_RAW
    assert data["tags"] == []
    assert data["created_at"]
    assert data["updated_at"]

    # Parser should have extracted 3 jobs (1 enabled alias, 1 enabled 5-field, 1 disabled)
    assert len(data["jobs"]) == 3
    enabled = [j for j in data["jobs"] if j["enabled"]]
    disabled = [j for j in data["jobs"] if not j["enabled"]]
    assert len(enabled) == 2
    assert len(disabled) == 1


def test_create_with_tags(client):
    data = create_crontab(client, tags=["prod", "backup"])
    assert data["tags"] == ["prod", "backup"]


def test_create_missing_name_returns_422(client):
    r = client.post("/api/crontabs", json={"raw_text": "*/5 * * * * /cmd"})
    assert r.status_code == 422


def test_create_missing_raw_text_returns_422(client):
    r = client.post("/api/crontabs", json={"name": "test"})
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/crontabs
# ---------------------------------------------------------------------------


def test_list_empty(client):
    r = client.get("/api/crontabs")
    assert r.status_code == 200
    assert r.json() == []


def test_list_returns_summaries(client):
    create_crontab(client, name="First")
    create_crontab(client, name="Second")

    r = client.get("/api/crontabs")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2

    # Summaries have no raw_text or jobs
    for item in data:
        assert "raw_text" not in item
        assert "jobs" not in item
        assert "job_count" in item
        assert "id" in item
        assert "name" in item


def test_list_is_ordered_newest_first(client):
    create_crontab(client, name="Older")
    create_crontab(client, name="Newer")

    data = client.get("/api/crontabs").json()
    assert data[0]["name"] == "Newer"
    assert data[1]["name"] == "Older"


def test_list_job_count_matches_parser(client):
    create_crontab(client, raw_text=SAMPLE_RAW)
    data = client.get("/api/crontabs").json()
    assert data[0]["job_count"] == 3  # 2 enabled + 1 disabled


# ---------------------------------------------------------------------------
# GET /api/crontabs/{id}
# ---------------------------------------------------------------------------


def test_get_by_id(client):
    created = create_crontab(client, name="Detail test")
    r = client.get(f"/api/crontabs/{created['id']}")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == created["id"]
    assert data["name"] == "Detail test"
    assert "jobs" in data
    assert "raw_text" in data


def test_get_unknown_id_returns_404(client):
    r = client.get("/api/crontabs/does-not-exist")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# PUT /api/crontabs/{id}
# ---------------------------------------------------------------------------


def test_update_name(client):
    created = create_crontab(client, name="Old name")
    r = client.put(f"/api/crontabs/{created['id']}", json={"name": "New name"})
    assert r.status_code == 200
    assert r.json()["name"] == "New name"
    assert r.json()["raw_text"] == SAMPLE_RAW  # unchanged


def test_update_raw_text_re_parses_jobs(client):
    created = create_crontab(client, raw_text="@daily /usr/bin/backup")
    assert len(created["jobs"]) == 1

    new_raw = "@daily /cmd1\n*/5 * * * * /cmd2"
    r = client.put(f"/api/crontabs/{created['id']}", json={"raw_text": new_raw})
    assert r.status_code == 200
    assert len(r.json()["jobs"]) == 2


def test_update_tags(client):
    created = create_crontab(client, tags=["old"])
    r = client.put(f"/api/crontabs/{created['id']}", json={"tags": ["new1", "new2"]})
    assert r.status_code == 200
    assert r.json()["tags"] == ["new1", "new2"]


def test_update_updated_at_changes(client):
    import time

    created = create_crontab(client)
    time.sleep(0.01)  # ensure different timestamp
    updated = client.put(
        f"/api/crontabs/{created['id']}", json={"name": "Changed"}
    ).json()
    assert updated["updated_at"] >= created["updated_at"]
    assert updated["created_at"] == created["created_at"]


def test_update_unknown_id_returns_404(client):
    r = client.put("/api/crontabs/does-not-exist", json={"name": "x"})
    assert r.status_code == 404


def test_update_no_fields_returns_unchanged(client):
    created = create_crontab(client, name="Unchanged")
    r = client.put(f"/api/crontabs/{created['id']}", json={})
    assert r.status_code == 200
    assert r.json()["name"] == "Unchanged"


# ---------------------------------------------------------------------------
# DELETE /api/crontabs/{id}
# ---------------------------------------------------------------------------


def test_delete_returns_204(client):
    created = create_crontab(client)
    r = client.delete(f"/api/crontabs/{created['id']}")
    assert r.status_code == 204


def test_delete_removes_from_list(client):
    created = create_crontab(client)
    client.delete(f"/api/crontabs/{created['id']}")
    r = client.get("/api/crontabs")
    assert r.json() == []


def test_delete_then_get_returns_404(client):
    created = create_crontab(client)
    client.delete(f"/api/crontabs/{created['id']}")
    r = client.get(f"/api/crontabs/{created['id']}")
    assert r.status_code == 404


def test_delete_unknown_id_returns_404(client):
    r = client.delete("/api/crontabs/does-not-exist")
    assert r.status_code == 404
