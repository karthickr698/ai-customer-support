# AI Customer Support

Modular monolith for AI-assisted customer support. Hexagonal (ports and adapters) modules, event-driven workflows, and a separate in-process AI boundary that can be extracted later.

This repository currently contains the **project foundation only**. Business features (auth, conversations, tickets, RAG, and so on) are added through feature-wise commands.

## Architecture

- **Apps:** `apps/api` (Fastify + TypeScript) and `apps/web` (React + Vite)
- **Modules:** identity, organizations, customers, conversations, tickets, agents, knowledge, ai, notifications, analytics, integrations
- **Layout per module:** `domain/` → `application/` → `adapters/` (inbound HTTP/WebSocket/events, outbound persistence/messaging/external)
- **Packages:** `packages/shared` (Result, DomainError, Logger, RequestContext, Pagination, EventBus), `packages/config` (typed env), `packages/contracts` (API contracts)
- **Data:** PostgreSQL (Prisma) is the system of record; Redis is for cache, queues, locks, and temporary state

See [docs/architecture.md](docs/architecture.md) for boundaries and the AI extraction path.

## Local setup

### Prerequisites

- Node.js 20+
- npm 10+
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
| `LLM_PROVIDER` / `LLM_API_KEY` | Reserved for the AI adapter (not used yet) |
| `WEB_ORIGIN`                   | CORS origin for the web app                |
| `LOG_LEVEL`                    | Pino log level                             |

Never commit `.env`.

### Start PostgreSQL and Redis

```bash
docker compose up -d
```

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

Production-style API start after `npm run build`:

```bash
npm run start
```

The API exposes `GET /health` (checks PostgreSQL and Redis). There are no business APIs yet.

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
