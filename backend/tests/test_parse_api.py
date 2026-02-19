from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_parse_valid_crontab():
    r = client.post("/api/crontabs/parse", json={"raw_text": "*/5 * * * * /usr/bin/backup"})
    assert r.status_code == 200
    data = r.json()
    assert len(data["jobs"]) == 1
    assert data["jobs"][0]["schedule"] == "*/5 * * * *"
    assert data["jobs"][0]["enabled"] is True
    assert data["jobs"][0]["error"] is None
    assert data["warnings"] == []


def test_parse_empty_crontab():
    r = client.post("/api/crontabs/parse", json={"raw_text": ""})
    assert r.status_code == 200
    data = r.json()
    assert data["jobs"] == []
    assert data["warnings"] == []


def test_parse_alias():
    r = client.post("/api/crontabs/parse", json={"raw_text": "@daily /usr/bin/cleanup"})
    assert r.status_code == 200
    data = r.json()
    assert data["jobs"][0]["schedule"] == "@daily"
    assert data["jobs"][0]["command"] == "/usr/bin/cleanup"


def test_parse_disabled_job():
    r = client.post("/api/crontabs/parse", json={"raw_text": "# */5 * * * * /usr/bin/backup"})
    assert r.status_code == 200
    data = r.json()
    assert data["jobs"][0]["enabled"] is False


def test_parse_mixed_crontab():
    raw = "# comment\n*/5 * * * * /cmd\n# @daily /disabled"
    r = client.post("/api/crontabs/parse", json={"raw_text": raw})
    assert r.status_code == 200
    data = r.json()
    assert len(data["jobs"]) == 2
    assert data["jobs"][0]["enabled"] is True
    assert data["jobs"][1]["enabled"] is False


def test_parse_invalid_schedule_returns_error_field():
    r = client.post("/api/crontabs/parse", json={"raw_text": "99 * * * * /usr/bin/backup"})
    assert r.status_code == 200
    data = r.json()
    assert data["jobs"][0]["error"] is not None
    assert len(data["warnings"]) == 1


def test_parse_missing_raw_text_field():
    r = client.post("/api/crontabs/parse", json={})
    assert r.status_code == 422


def test_health_still_works():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
