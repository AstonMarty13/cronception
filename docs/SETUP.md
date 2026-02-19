# CronCeption — Setup local (macOS)

This document explains how to run frontend + backend locally using Docker Compose, how to quickly verify everything is working, and how to run backend tests with convenient shortcuts (Makefile).


# PREREQUISITES
- Docker Desktop (macOS)
- Git
- (Optional) jq for prettier JSON output: brew install jq
- You can run everything via Docker, so Node/Python don’t need to be installed locally.


# REPOSITORY STRUCTURE

cronception/
backend/
frontend/
docker-compose.yml
Makefile
docs/


# START THE APP LOCALLY

From the repo root: docker compose up –build


# URLs:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs


# MAKEFILE SHORTCUTS

Create a Makefile at the repository root (if not already present). Example targets:
- make up        (docker compose up –build)
- make down      (docker compose down)
- make logs      (docker compose logs -f)
- make ps        (docker compose ps)
- make rebuild   (docker compose build –no-cache)
- make test      (runs backend tests)


# Tail logs:
docker compose logs -f backend
docker compose logs -f frontend

