.PHONY: up down logs ps rebuild test-backend test-frontend test

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

rebuild:
	docker compose build --no-cache

test-backend:
	docker compose run --rm backend pytest -q

test-frontend:
	docker compose run --rm frontend npm test

test: test-backend
