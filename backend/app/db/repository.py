from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import aiosqlite

from app.schemas import CrontabCreate, CrontabUpdate


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class CrontabRepository:
    def __init__(self, db: aiosqlite.Connection) -> None:
        self.db = db

    async def get_all(self) -> list[dict]:
        async with self.db.execute(
            "SELECT * FROM crontabs ORDER BY created_at DESC"
        ) as cur:
            rows = await cur.fetchall()
        return [dict(r) for r in rows]

    async def get_by_id(self, id: str) -> dict | None:
        async with self.db.execute(
            "SELECT * FROM crontabs WHERE id = ?", (id,)
        ) as cur:
            row = await cur.fetchone()
        return dict(row) if row else None

    async def create(self, data: CrontabCreate) -> dict:
        id = str(uuid.uuid4())
        now = _now()
        await self.db.execute(
            "INSERT INTO crontabs (id, name, raw_text, tags, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (id, data.name, data.raw_text, json.dumps(data.tags), now, now),
        )
        await self.db.commit()
        return await self.get_by_id(id)  # type: ignore[return-value]

    async def update(self, id: str, data: CrontabUpdate) -> dict | None:
        existing = await self.get_by_id(id)
        if existing is None:
            return None

        updates: dict[str, object] = {}
        if data.name is not None:
            updates["name"] = data.name
        if data.raw_text is not None:
            updates["raw_text"] = data.raw_text
        if data.tags is not None:
            updates["tags"] = json.dumps(data.tags)

        if not updates:
            return existing

        updates["updated_at"] = _now()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [id]
        await self.db.execute(
            f"UPDATE crontabs SET {set_clause} WHERE id = ?", values
        )
        await self.db.commit()
        return await self.get_by_id(id)  # type: ignore[return-value]

    async def delete(self, id: str) -> bool:
        cur = await self.db.execute(
            "DELETE FROM crontabs WHERE id = ?", (id,)
        )
        await self.db.commit()
        return cur.rowcount > 0
