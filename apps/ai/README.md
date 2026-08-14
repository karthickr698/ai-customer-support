# AI Service

Independently deployable Python AI service for the AI Customer Support platform.

This package is the **foundation only**. Agents, RAG, LLM calls, embeddings, vector search, prompts, and tools are added through feature-wise commands.

## Boundaries

- Hexagonal layout: `domain/` → `application/` → `adapters/`
- Capability packages (`agents/`, `orchestration/`, `rag/`, `llm/`, `embeddings/`, `vector_store/`, `tools/`, `prompts/`, `guardrails/`, `evaluation/`) must not import provider SDKs
- FastAPI lives in inbound adapters; provider SDKs will live under `adapters/outbound/`
- This service does not write TypeScript business tables or use Prisma
- The web app never calls this service directly; the TypeScript API is the client

## Requirements

- Python 3.12+

## Setup

From this directory:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Configuration is read from the environment (and the repository-root `.env` when present). See the root `.env.example` for `AI_*` variables.

| Variable       | Purpose                                      |
| -------------- | -------------------------------------------- |
| `AI_ENV`       | `development` \| `test` \| `production`      |
| `AI_HOST`      | Listen address (default `0.0.0.0`)           |
| `AI_PORT`      | Listen port (default `8000`)                 |
| `AI_LOG_LEVEL` | `debug` \| `info` \| `warning` \| `error`    |

Do not put LLM keys in source. They will be required when a provider adapter is added.

## Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Or:

```bash
python -m app.main
```

Health check: `GET http://localhost:8000/health`

## Tests

```bash
pytest
```
