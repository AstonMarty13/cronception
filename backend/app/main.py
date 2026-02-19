from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.crontabs import router as crontabs_router
from app.db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="CronCeption API", lifespan=lifespan)

app.include_router(crontabs_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
