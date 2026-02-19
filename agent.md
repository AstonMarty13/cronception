# agent.md — Cronception (Agent Guide)

## Project
**Cronception** — *“Visualize your crontab in seconds.”*

### Goal (MVP)
Build a simple local web application where users can **import crontabs** (paste / upload / examples), **store them**, and **visualize each crontab** in multiple ways:
- **Timeline**: sorted list of upcoming runs (date/time)
- **Heatmap**: days vs hours, intensity = number of executions
- **Calendar**: week/month calendar view

The app runs locally (localhost) and is designed for fast iteration.

---

## Tech Stack

### Backend (API)
- **Python 3.11+**
- **FastAPI** + **uvicorn** (reload in dev)
- **cron parsing**: `croniter`
- **validation**: Pydantic (v2)
- **tests**: pytest
- **DB**: SQLite (via SQLAlchemy or sqlite3) for storing crontabs and optional metadata/history

### Frontend (Web UI)
- **React** + **Vite** + **TypeScript**
- **UI**: Tailwind v4 + shadcn/ui
- **Data fetching**: TanStack Query + axios/fetch
- **Charts**: ECharts (heatmap + timeline graphs if needed)
- **Calendar**: FullCalendar (week/month)
- **Routing**: React Router

### Local Dev
- **Docker Compose**
  - 1 service backend, 1 service frontend
  - hot reload for both

---

## Product Requirements & UX

### Core Entities
- **Crontab**
  - id (uuid or int)
  - name (user-defined)
  - raw_text (original content)
  - created_at, updated_at
  - optional: tags (array) / description

- **Job** (parsed line)
  - id (stable hash or uuid)
  - schedule (cron expression or @alias)
  - command (string)
  - user (optional; for /etc/crontab / cron.d format)
  - enabled (true/false; disabled if commented out)
  - metadata: source_line, comment, tags (optional)

### Views per Crontab
- **Overview / Timeline**
  - default view after selecting a crontab
  - show “Next runs” for the next N occurrences (e.g., 50)
  - grouping by job, or unified sorted list with job label
- **Heatmap**
  - show next month by default (now -> +30 days)
  - heatmap buckets: day x hour (or day x hour/minute if needed later)
- **Calendar**
  - week view / month view
  - events are job runs
  - allow filtering by job

### Front Pages
- **Homepage**
  - List saved crontabs
  - Import: paste / upload / example templates
  - Manage: delete / rename / modify / tag
- **Overview**
  - Timeline list of executions
- **Heatmap**
  - month range visualization
- **Calendar**
  - week/month view of occurrences

---

## API Design (Recommended)

Base prefix: `/api`

### Health
- `GET /api/health` -> `{ status: "ok" }`

### Crontabs CRUD
- `GET /api/crontabs`
  - returns list of saved crontabs (id, name, created_at, updated_at, tags)
- `POST /api/crontabs`
  - body: `{ name?: string, raw_text: string, tags?: string[] }`
  - returns created crontab
- `GET /api/crontabs/{id}`
  - returns crontab + optionally parsed jobs summary
- `PUT /api/crontabs/{id}`
  - body: `{ name?: string, raw_text?: string, tags?: string[] }`
- `DELETE /api/crontabs/{id}`

### Parsing / Preview
- `POST /api/crontabs/parse`
  - body: `{ raw_text: string }`
  - returns: `{ jobs: Job[], warnings: string[] }`
  - NOTE: parsing should NOT execute commands; only parse & validate
- `POST /api/crontabs/{id}/occurrences`
  - body: `{ start: ISODateTime, end: ISODateTime, timezone?: string }`
  - returns: `{ occurrences: Occurrence[] }`
  - Occurrence: `{ job_id, ts, job_label }`

### Aggregations (server-side for consistency)
- `POST /api/crontabs/{id}/aggregate/heatmap`
  - body: `{ start, end, timezone? }`
  - returns: `{ buckets: number[][], xLabels, yLabels }`
- `POST /api/crontabs/{id}/aggregate/timeline`
  - body: `{ start, end, limit?: number, timezone? }`
  - returns: `{ items: TimelineItem[] }`

---

## Parsing Rules (MVP)

### Must Support
- Standard user crontab lines: 5 fields `min hour dom mon dow command...`
- Aliases: `@yearly @annually @monthly @weekly @daily @midnight @hourly`
- Comments and blank lines
- Disabled jobs: lines starting with `#` (store but mark as `enabled=false`)

### Nice-to-have (Later)
- `/etc/crontab` and `/etc/cron.d/*` (6 fields with `user`)
- Environment lines `KEY=value` (store as metadata)
- Tagging via comments (e.g., `# tag:backup`)

### Timezone & DST
- MVP: allow timezone selection per request (default to local server tz)
- Always store timestamps internally in ISO (UTC preferred), but return with requested timezone.

---

## Frontend Guidelines

### Routing (suggested)
- `/` -> Homepage (list + import)
- `/crontabs/:id` -> redirect to `/crontabs/:id/timeline`
- `/crontabs/:id/timeline`
- `/crontabs/:id/heatmap`
- `/crontabs/:id/calendar`

### Data Fetching
- Use **TanStack Query** with stable `queryKey`s:
  - `["crontabs"]`, `["crontab", id]`, `["occurrences", id, range]`, etc.
- Use mutations for create/update/delete; invalidate relevant queries after success.

### UI Components
- Prefer shadcn components + Tailwind utility classes.
- Keep charts responsive; avoid heavy over-rendering.

---

## Backend Guidelines

### Structure (suggested)
- `backend/app/main.py` (FastAPI app)
- `backend/app/api/` (routers)
- `backend/app/services/` (cron parsing, occurrences, aggregation)
- `backend/app/db/` (SQLite models, repositories)
- `backend/tests/` (pytest tests)

### Key Services
- `parse_crontab(raw_text) -> (jobs, warnings)`
- `generate_occurrences(jobs, start, end, tz) -> occurrences`
- `aggregate_heatmap(occurrences) -> buckets`
- `aggregate_timeline(occurrences) -> sorted list`

### Testing
- Unit tests for parser (edge cases)
- Unit tests for occurrence generation (aliases, invalid cron)
- API tests: `/api/health`, parse endpoint, occurrences endpoint

---

## Best Practices (Project)

### General
- Keep MVP scope small: import -> store -> visualize.
- Do not add authentication yet (local tool).
- Do not run cron commands; treat command as plain text.

### Code Quality
- TypeScript strict mode (keep types accurate).
- Pydantic models for every request/response in FastAPI.
- Centralize cron parsing + occurrence generation logic in one module.

### Error Handling
- API returns consistent error format:
  - `{ error: { code, message, details? } }`
- On parsing errors, return warnings and skip invalid lines rather than failing the whole import (unless no valid jobs exist).

### Security (Even Local)
- Never execute or shell-evaluate the “command” field.
- Escape output in UI (avoid rendering raw HTML).
- Limit maximum imported file size (e.g., 1–2 MB).

### Performance
- Occurrence generation should be bounded by:
  - max number of occurrences per job (e.g., 10k)
  - max total occurrences per request (e.g., 100k)
- Prefer server-side aggregation to reduce payload size for heatmaps.

---

## Dev Workflow

### Local commands
- `make up` : start frontend + backend
- `make down` : stop
- `make test` : run backend tests
- `curl http://localhost:8000/api/health` : backend check
- `curl http://localhost:5173/api/health` : proxy E2E check

### Git
- Small commits with clear messages:
  - `feat: add crontab import endpoint`
  - `feat: timeline view for crontab occurrences`
  - `fix: handle @daily alias in parser`
  - `docs: update setup instructions`

---

## Implementation Plan (Suggested Order)

1) Backend: `POST /api/crontabs/parse` + parser tests  
2) Backend: SQLite persistence + CRUD endpoints  
3) Backend: occurrences endpoint (range: now -> +30 days)  
4) Frontend: Homepage (list + import paste)  
5) Frontend: Overview timeline (table of next runs)  
6) Heatmap aggregation + ECharts view  
7) Calendar endpoint mapping + FullCalendar view  
8) Polish: rename/delete/edit crontabs, tags, warnings UI

---

## Definition of Done (MVP)
- User can import a crontab (paste) and save it
- User can open a saved crontab and switch between:
  - Timeline
  - Heatmap (next 30 days)
  - Calendar (week/month)
- Works locally via Docker Compose, with hot reload
- Basic tests pass (parser + API health)
