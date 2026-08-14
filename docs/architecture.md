# Architecture

The platform is a **modular monolith** for the TypeScript core (`apps/api`) plus a **Python AI service** (`apps/ai`). Both use **hexagonal (ports and adapters)** modules. LLM, RAG, embeddings, and prompts live in Python — never in TypeScript.

## Dependency direction

**Adapters → Application → Domain**

Domain has no Fastify, FastAPI, Prisma, SQLAlchemy, Redis, queue, or LLM SDK imports. Use cases talk to ports. Adapters implement ports.

## Backend modules

`apps/api/src/modules/`: identity, organizations, customers, conversations, tickets, agents, knowledge, notifications, analytics, integrations.

`apps/ai/`: Python AI service (same hexagonal layout: `domain/` → `application/` → `adapters/`).

Modules communicate through public application contracts, ports, or events — never another module’s Prisma models or adapters. Cross-runtime calls go through HTTP, queues, or events. TypeScript uses `AIServicePort`; Python uses `LLMPort`, `EmbeddingPort`, `VectorSearchPort`.

## AI boundary

```
Conversation (TS) → AIServicePort (TS) → HTTP/queue adapter (TS)
  → Python inbound adapter → AI application → LLM/embedding/vector port → provider adapter
```

Provider SDKs stay in Python AI outbound adapters. TypeScript never imports OpenAI, Anthropic, or LangChain. Python AI does not write business tables.

## Data

PostgreSQL is the system of record (Prisma behind TypeScript repository adapters). Redis is for cache, rate limits, queues, locks, and temporary state. Vector search lives behind Python ports.

## Shared code

Only cross-cutting types live in `packages/shared`: `Result`, `DomainError`, `Logger`, `RequestContext`, `Pagination`, `EventBus`.
