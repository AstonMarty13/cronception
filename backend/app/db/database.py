from __future__ import annotations

import os
from pathlib import Path
from typing import AsyncGenerator

import aiosqlite


def _db_path() -> str:
    """Read DB path at call-time so tests can override via DATABASE_PATH env var."""
    return os.getenv("DATABASE_PATH", "/app/data/cronception.db")


async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    path = _db_path()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(path) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA journal_mode=WAL")
        yield db


async def init_db() -> None:
    path = _db_path()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(path) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS crontabs (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                raw_text    TEXT NOT NULL,
                tags        TEXT NOT NULL DEFAULT '[]',
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )
        """)
        await db.commit()
