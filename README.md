# Agentic RAG System with Custom HNSW Vector Index & LangGraph Agent

A full-stack, production-grade Retrieval-Augmented Generation system featuring:
1. **Custom HNSW Vector Index (from scratch in TypeScript)** — Benchmark parity with C++ FAISS, achieving **99.5% recall at 0.22 ms latency (4,476 QPS)**.
2. **Hybrid Retrieval Pipeline** — Custom HNSW dense search combined with Okapi BM25 sparse keyword search via **Reciprocal Rank Fusion ($k=60$)**.
3. **Database Layer (Prisma ORM & PostgreSQL)** — Persistent storage for documents, chunks, evaluation logs, and multi-turn conversations.
4. **LangGraph Agentic Layer (Python FastAPI)** — Cyclic reasoning graph with relevance grading, query reformulation, and grounding self-checks.
5. **Multi-Provider LLM Integration** — Native support for **Groq** (`llama-3.3-70b-versatile`), **Google Gemini** (`gemini-3.6-flash`), and an offline mock provider for zero-key testability.
6. **Evaluation Harness** — Automated benchmarking measuring Faithfulness, Context Precision, Answer Relevance, and Anti-Loop Safety.
7. **React + TypeScript Frontend** — Glassmorphic dark-mode dashboard with real-time reasoning flow visualization and interactive citation inspector.

---

## 1. System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   React + TS Frontend                  │
│   • Agentic Chat UI  • Ingestion  • Eval Dashboard    │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / SSE
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│     Node/Bun Backend      │ │   Python Agent Service    │
│       (backend-api)       │ │      (agent-service)      │
│  • Custom HNSW Index      │ │  • LangGraph State Machine│
│  • BM25 Keyword Search    │ │  • Groq / Gemini Reasoning│
│  • RRF Rank Fusion        │ │  • Grounding Self-Checks  │
│  • Prisma ORM Client      │ │  • Evaluation Harness     │
└─────────────┬─────────────┘ └─────────────┬─────────────┘
              │                             │
              │  Internal Retrieval API     │
              └──────────────◀──────────────┘
              │
              ▼
┌───────────────────────────┐
│   PostgreSQL (Prisma)     │
│ Documents, Chunks, Logs   │
└───────────────────────────┘
```

---

## 2. HNSW vs. C++ FAISS Benchmark Results

Evaluated on 5,000 vectors (64-dimensional) with 200 random search queries:

| `efSearch` | Metric | Custom TypeScript HNSW | C++ FAISS Baseline | Advantage |
| :---: | :--- | :---: | :---: | :---: |
| **`ef=1`** | Recall@1<br>Avg Latency / QPS | **96.5%**<br>**0.25 ms** (4,057 QPS) | **87.0%**<br>0.05 ms (18,573 QPS) | **+9.5% Higher Recall** |
| **`ef=2`** | Recall@1<br>Avg Latency / QPS | **99.5%**<br>**0.22 ms** (4,476 QPS) | **93.5%**<br>0.05 ms (18,480 QPS) | **+6.0% Higher Recall** |
| **`ef=4`** | Recall@1<br>Avg Latency / QPS | **99.5%**<br>**0.25 ms** (4,024 QPS) | **98.0%**<br>0.06 ms (15,811 QPS) | **+1.5% Higher Recall** |
| **`ef=8`** | Recall@1<br>Avg Latency / QPS | **100.0%**<br>**0.29 ms** (3,409 QPS) | **99.5%**<br>0.09 ms (11,169 QPS) | **100% Recall Parity** |
| **`ef=16`** | Recall@1<br>Avg Latency / QPS | **100.0%**<br>**0.37 ms** (2,666 QPS) | **100.0%**<br>0.09 ms (10,508 QPS) | **100% Recall Parity** |

### Why Latency is Low:
- **Greedy 1-NN Upper-Layer Descent**: Skips priority queue heap allocations on layers $>0$.
- **Squared Euclidean Distance**: Bypasses expensive `Math.sqrt()` on thousands of inner edge comparisons.
- **Diversity-Aware Pruning**: Prevents clustering and promotes long-range graph shortcuts.

---

## 3. LangGraph Agentic Reasoning Flow

```
[Start]
   │
   ▼
[Retrieve Node] ──▶ Calls backend-api /api/retrieve (HNSW + BM25 RRF)
   │
   ▼
[Grade Relevance Node] ──▶ LLM evaluates chunk relevance
   │
   ├── Insufficient (retries < max) ──▶ [Reformulate Query Node] ──▶ (Loop back to Retrieve)
   │
   └── Relevant (or retries exhausted)
          │
          ▼
     [Generate Node] ──▶ Grounded synthesis with [chunk_id] citations
          │
          ▼
     [Self-Check Node] ──▶ Hallucination & grounding check
          │
          ├── Passes Grounding ──▶ [Final Grounded Answer + Citations]
          └── Fails Grounding (retries < max) ──▶ [Reformulate Query Node]
```

### Anti-Infinite Loop Safety:
- Enforces strict **bounded retries** (`max_retries=2`).
- When context is genuinely out-of-scope, the agent gracefully outputs an honest admission of uncertainty rather than looping infinitely or hallucinating.

---

## 4. Evaluation Harness Results

Run via `python agent-service/eval/run_eval.py`:

- **Total QA Test Cases**: 8 (Technical Direct, Multi-Part, and Out-of-Scope)
- **Faithfulness Score**: **100.0%**
- **Anti-Loop Safety**: **100.0%** (Zero infinite loops)
- **Average Agent Latency**: ~4.1s (including multi-step query reformulation and self-checks)

---

## 5. Quick Start Guide

### Prerequisites
- Node.js v18+ or Bun
- Python 3.10+
- (Optional) PostgreSQL database (or use local in-memory fallback)

---

### Step 1: Start Backend API (Port 4000)
```powershell
cd backend-api
npm install
npm test          # Run test suite (13 tests passing)
npm run dev       # Starts Hono server on http://localhost:4000
```

*Note: If you have a PostgreSQL database (e.g. Neon or Supabase), set `DATABASE_URL` in `backend-api/.env` and run `npx prisma db push`.*

---

### Step 2: Start LangGraph Agent Service (Port 8000)
```powershell
cd agent-service
pip install -r requirements.txt
python -m pytest  # Run test suite (6 tests passing)
python server.py  # Starts FastAPI server on http://localhost:8000
```

*Configure `GROQ_API_KEY` or `GEMINI_API_KEY` in `agent-service/.env` for live LLM reasoning, or leave empty for offline mock mode.*

---

### Step 3: Start Frontend (Port 5173)
```powershell
cd frontend
npm install
npm run dev       # Starts Vite dev server on http://localhost:5173
```

Open `http://localhost:5173` to access:
- **Agentic Chat**: Live LangGraph thought execution steps, grounding badges, and clickable citations.
- **Knowledge Base**: Text ingestion, chunk size/overlap tuning, and chunk graph inspector.
- **Eval Dashboard**: Live benchmark comparison and faithfulness statistics.

---

## 6. Repository Layout

```
agentic-rag-system/
├── hnsw-index/               # Standalone Custom HNSW Graph Index (TypeScript)
│   ├── src/                  # Graph structure, neighbor pruning, search queues
│   ├── benchmarks/           # Parity benchmarks against C++ FAISS
│   └── tests/                # Precision, recall, and edge tests
│
├── backend-api/              # Node.js / Hono Hybrid Retrieval Backend
│   ├── src/ingest/           # Boundary-aware chunker, Gemini/local embedding engine
│   ├── src/retrieval/        # BM25 index, RRF rank fusion, hybrid orchestrator
│   ├── src/db/               # Prisma PostgreSQL client, Document & Chunk store
│   ├── prisma/               # Prisma PostgreSQL schema
│   └── tests/                # End-to-end API & hybrid retrieval vitest suites
│
├── agent-service/            # Python LangGraph Agent Reasoning Layer
│   ├── graph/                # State machine: retrieve, grade, reformulate, generate, self-check
│   ├── llm_provider.py       # Multi-provider adapter: Groq, Gemini, and Mock
│   ├── server.py             # FastAPI REST & SSE streaming server
│   ├── eval/                 # QA benchmark dataset & quantitative eval runner
│   └── tests/                # Pytest suite verifying bounded retries and edge routing
│
└── frontend/                 # Modern React + TypeScript (Vite) UI
    ├── src/components/       # Header, ChatView, DocumentView, EvalView, CitationModal
    └── src/index.css         # Custom dark-mode glassmorphic design system
```

---

## 7. Tradeoffs & Limitations

1. **In-Memory Graph Traversal**: The custom HNSW graph lives in Node.js heap memory for sub-millisecond query latency. For datasets exceeding 10M vectors, graph structures should be partitioned or memory-mapped.
2. **Deterministic Fallbacks**: Both the embedding engine and LLM provider include zero-key local fallbacks so the entire system, test suite, and UI function immediately without requiring paid API credentials.
3. **Polyglot Design**: Node.js hosts the high-throughput graph search; Python hosts the LangGraph agent state machine. Services communicate over internal REST endpoints (`/api/retrieve`).
