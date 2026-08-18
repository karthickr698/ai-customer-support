# AI Customer Support

Modular monolith for AI-assisted customer support. Hexagonal (ports and adapters) modules, event-driven workflows, and a **Python AI service** (`apps/ai`) for LLM, RAG, and embeddings. The TypeScript API (`apps/api`) never talks to LLM providers directly.

This repository currently contains the **project foundation only**. Business features (auth, conversations, tickets, RAG, Human Agent and so on) are added through feature-wise commands.

## Architecture

- **Apps:** `apps/api` (TypeScript), `apps/ai` (Python AI service), and `apps/web` (React + Vite)
- **Modules (TypeScript):** identity, organizations, customers, conversations, tickets, agents, knowledge, notifications, analytics, integrations
- **AI (Python):** LLM, RAG, embeddings, prompts, tool calling, guardrails — hexagonal `domain/` → `application/` → `adapters/`
- **TypeScript AI module:** integration only (`AIServicePort` + `PythonAIServiceAdapter`)
- **Layout per module:** `domain/` → `application/` → `adapters/` (inbound HTTP/WebSocket/events, outbound persistence/messaging/external)
- **Packages:** `packages/shared` (Result, DomainError, Logger, RequestContext, Pagination, EventBus), `packages/config` (typed env), `packages/contracts` (API contracts)
- **Data:** PostgreSQL (Prisma) is the system of record; Redis is for cache, queues, locks, and temporary state

See [docs/architecture.md](docs/architecture.md) for boundaries and the Python AI service.

## Local setup

### Prerequisites

- Node.js 20+
- npm 10+
- Python 3.12+
- Docker (for PostgreSQL and Redis)

### Environment configuration

```bash
cp .env.example .env
```

Required variables are documented in `.env.example`:

| Variable                       | Purpose                                    |
| ------------------------------ | ------------------------------------------ |
| `DATABASE_URL`                 | PostgreSQL connection string               |
| `REDIS_URL`                    | Redis connection string                    |
| `PORT` / `HOST`                | API listen address                         |
| `NODE_ENV`                     | `development` \| `test` \| `production`    |
| `JWT_SECRET`                   | Auth secret (required; min 32 characters)  |
| `INTEGRATION_CREDENTIALS_KEY`  | AES key for tenant integration secrets (optional locally; derived from `JWT_SECRET`) |
| `PUBLIC_API_RATE_LIMIT_PER_MINUTE` | Public API v1 rate limit per API key / OAuth token |
| `AI_SERVICE_URL`               | TypeScript API URL for the Python AI service |
| `LLM_PROVIDER` / `LLM_API_KEY` | Reserved for the Python AI service (not used yet) |
| `WEB_ORIGIN`                   | CORS origin for the web app                |
| `LOG_LEVEL`                    | Pino log level                             |
| `AI_ENV` / `AI_HOST` / `AI_PORT` / `AI_LOG_LEVEL` | Python AI service (`apps/ai`) |

Never commit `.env`.

### Start PostgreSQL and Redis

```bash
docker compose up -d
```

Postgres uses the `pgvector/pgvector:pg16` image so the Python AI service can store embeddings in schema `ai`. If you already had a volume from `postgres:16-alpine`, recreate it (`docker compose down -v`) before enabling `VECTOR_STORE_PROVIDER=pgvector`.

### Install dependencies

```bash
npm install
```

Generate the Prisma client after install:

```bash
npm run prisma:generate
```

## Run

API (http://localhost:3000) and web (http://localhost:5173):

```bash
npm run dev
```

Separately:

```bash
npm run dev:api
npm run dev:web
```

Python AI service (http://localhost:8000):

```bash
cd apps/ai
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python -m app.main
```

`GET /health` on the AI service returns `{ "status": "ok", "service": "ai" }`. See [apps/ai/README.md](apps/ai/README.md).

Production-style API start after `npm run build`:

```bash
npm run start
```

The API exposes `GET /health` (liveness), `GET /ready` (PostgreSQL and Redis), and versioned public APIs under `/api/v1` (OpenAPI at `/api/v1/openapi.json`, docs at `/api/v1/docs`). The Python AI service exposes `GET /health`.

## Tests and quality

```bash
npm run typecheck
npm run lint
npm run format
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
```

Python AI service:

```bash
cd apps/ai && pytest
```

## Scripts

| Script      | Description                             |
| ----------- | --------------------------------------- |
| `dev`       | API + web in watch mode                 |
| `build`     | Prisma generate, packages, API, web     |
| `start`     | Run compiled API                        |
| `lint`      | ESLint                                  |
| `format`    | Prettier                                |
| `typecheck` | TypeScript project build + web `noEmit` |
| `test`      | All Vitest projects                     |
