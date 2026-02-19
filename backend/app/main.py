from fastapi import FastAPI
from pydantic import BaseModel
from croniter import croniter
from datetime import datetime, timezone

app = FastAPI(title="CronCeption API")

@app.get("/api/health")
def health():
    return {"status": "ok"}

class CronPreviewRequest(BaseModel):
    expression: str
    base: datetime | None = None
    count: int = 10

@app.post("/api/cron/preview")
def cron_preview(payload: CronPreviewRequest):
    base = payload.base or datetime.now(timezone.utc)
    it = croniter(payload.expression, base)
    times = [it.get_next(datetime).isoformat() for _ in range(payload.count)]
    return {"base": base.isoformat(), "next": times}
