# AI Service

Independently deployable Python AI service for the AI Customer Support platform.

This package is the **foundation only**. Agents, RAG, LLM calls, embeddings, vector search, prompts, and tools are added through feature-wise commands.

Production RAG lives here: parse → chunk → embed → pgvector/in-memory index → hybrid keyword+vector retrieve → metadata filters → rerank → citations.

## Boundaries

- Hexagonal layout: `domain/` → `application/` → `adapters/`
- Application ports: `LLMPort`, `EmbeddingPort`, `VectorSearchPort` (no provider SDKs)
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

| `LLM_PROVIDER` | `openai` for Chat Completions, empty/`heuristic` for local setup without a key |
| `LLM_API_KEY`  | Provider secret (required in production when `LLM_PROVIDER=openai`) |
| `LLM_MODEL`    | Chat model id for the fast route (default `gpt-4o-mini`) |
| `LLM_QUALITY_MODEL` | Chat model id for complaints and long turns (default `gpt-4o`) |
| `LLM_MAX_ATTEMPTS` | Primary LLM retries before the heuristic fallback (default `3`) |
| `LLM_BASE_URL` | OpenAI-compatible base URL (default `https://api.openai.com/v1`) |
| `EMBEDDING_PROVIDER` | `openai` for embeddings, empty/`hash` for local ingestion |
| `VECTOR_STORE_PROVIDER` | `memory` (default) or `pgvector` |
| `AI_VECTOR_DATABASE_URL` | Postgres connection for the Python-owned `ai` schema (not Prisma tables) |
| `RAG_TOP_K` | Default retrieved chunks (request `topK` may override, clamped by `RAG_MAX_TOP_K`) |
| `RAG_CANDIDATE_K` | Hybrid candidate pool before rerank |
| `RAG_RERANK_ENABLED` | Heuristic rerank after keyword + vector fusion |

Do not put LLM keys in source. The TypeScript API calls `POST /v1/onboarding/setup` (and the granular generate endpoints). Knowledge retrieval is `POST /v1/knowledge/retrieve`; support replies stream citations from `POST /v1/support/reply/stream`. Orchestration is `POST /v1/orchestration/intent` and `POST /v1/orchestration/run` (structured intent, routing, guardrails, retries, fallbacks). Tool calling is `POST /v1/tools/propose` and `POST /v1/tools/apply-results` — Python never executes mutating tools.

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
