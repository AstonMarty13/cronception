# CronCeption

<p align="center">
  Parse, store, and visualize crontabs with an opinionated API and a modern UI.
</p>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white">
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
</p>

## Why CronCeption

CronCeption helps you move from raw crontab text to operational visibility:

- Import crontab text and persist it in SQLite.
- Parse enabled/disabled jobs and validate schedules.
- Explore executions with 4 complementary views:
  - `Timeline` (sorted upcoming runs)
  - `Heatmap` (hour/day activity)
  - `Calendar` (FullCalendar month/week)
  - `Raw` editor (inline edit + save)
- Hide noisy schedules (`> 5 runs/day`) for cleaner analysis.

## Architecture

```text
cronception/
├─ backend/                FastAPI + aiosqlite
│  ├─ app/
│  │  ├─ api/              /api/crontabs routes
│  │  ├─ db/               SQLite init + repository
│  │  ├─ services/         parser + occurrences/heatmap engines
│  │  └─ schemas.py        Pydantic models
│  └─ tests/               unit + integration tests
├─ frontend/               React + Vite + TypeScript
│  └─ src/
│     ├─ pages/            Home / Timeline / Heatmap / Calendar / Raw
│     ├─ components/       UI + shared layout
│     └─ lib/              API client + utils
├─ data/                   SQLite volume (cronception.db)
├─ docker-compose.yml
└─ Makefile
```

## Quick Start (Docker)

From the repository root:

```bash
docker compose up --build
```

Then open:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

Stop everything:

```bash
docker compose down
```

## Local Commands

### With Makefile

```bash
make up
make down
make logs
make ps
make rebuild
make test-backend
```

### Frontend

```bash
cd frontend
npm install
npm run lint
npm run build
npm run dev
```

### Backend

```bash
cd backend
pytest -q
```

If you prefer containerized tests:

```bash
docker compose run --rm backend pytest -q
```

## API Overview

Base path: `/api/crontabs`

- `POST /parse` parse raw text (stateless).
- `GET /` list crontab summaries.
- `POST /` create a crontab.
- `GET /{id}` get a full crontab with parsed jobs.
- `PUT /{id}` update name/raw_text/tags.
- `DELETE /{id}` delete a crontab.
- `POST /{id}/occurrences` flat occurrence list (supports `hide_noisy`).
- `POST /{id}/aggregate/timeline` timeline payload (supports `hide_noisy`).
- `POST /{id}/aggregate/heatmap` heatmap cells + `filtered_noisy_count`.

## Data Model Highlights

- `ParsedJob` includes:
  - `schedule`, `command`, `enabled`, `error`
  - `description` extracted from contiguous comment lines above a job
- `OccurrenceRequest` supports:
  - `from_dt`, `to_dt`, `limit`, `hide_noisy`
- `OccurrencesResponse` and `HeatmapResponse` expose:
  - `filtered_noisy_count`

## Product Notes

- `@reboot` jobs are parsed but excluded from time-based generation.
- Invalid schedules are kept with an error so users can fix them in context.
- SQLite uses WAL mode for better concurrent read/write behavior.
- Frontend routes are lazy-loaded for better initial load.

## Quality Status

- Backend test suite included (`backend/tests`).
- Frontend static checks:
  - ESLint
  - TypeScript build via Vite

## Setup Details

For more setup details: `docs/SETUP.md`.

