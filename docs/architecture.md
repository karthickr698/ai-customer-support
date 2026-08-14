# Architecture

The platform is a **modular monolith** with **hexagonal (ports and adapters)** modules. One backend deployable; the AI module is an in-process boundary that can be extracted later.

## Dependency direction

**Adapters → Application → Domain**

Domain has no Fastify, Prisma, Redis, queue, or LLM SDK imports. Use cases talk to ports. Adapters implement ports.

## Backend modules

`apps/api/src/modules/`: identity, organizations, customers, conversations, tickets, agents, knowledge, ai, notifications, analytics, integrations.

Modules communicate through public application contracts, ports, or events — never another module’s Prisma models or adapters.

## AI boundary

```
Conversation (or other module) → AI application → AI port → AI adapter → LLM / embedding / vector provider
```

Ports already defined: `LLMPort`, `EmbeddingPort`, `VectorSearchPort`. Provider SDKs stay in AI outbound adapters. AI does not write business tables.

## Data

PostgreSQL is the system of record (Prisma behind repository adapters). Redis is for cache, rate limits, queues, locks, and temporary state.

## Shared code

Only cross-cutting types live in `packages/shared`: `Result`, `DomainError`, `Logger`, `RequestContext`, `Pagination`, `EventBus`.
