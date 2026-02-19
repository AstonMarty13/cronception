import os

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(tmp_path):
    """
    Provide a TestClient backed by a fresh SQLite DB for each test.

    We override the DATABASE_PATH env var before creating the client so that
    the lifespan (init_db) and every request use the same temp file.
    """
    db_file = str(tmp_path / "test.db")
    os.environ["DATABASE_PATH"] = db_file
    with TestClient(app) as c:
        yield c
    del os.environ["DATABASE_PATH"]
