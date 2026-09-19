# backend-api

Node/Bun backend. Ingestion pipeline, retrieval endpoints, Google OAuth + JWT auth, hosts the hnsw-index module.

## Status
Not started. Do not begin until hnsw-index/ has passing tests and a benchmark result.

## Structure
- src/ingest/    chunking + embedding pipeline
- src/retrieval/ wraps hnsw-index (+ later BM25, fusion, reranking)
- src/auth/      Google OAuth + JWT refresh rotation (reuse Nexus pattern)
- src/routes/    API endpoints
- src/db/        Postgres schema, migrations, Prisma client
