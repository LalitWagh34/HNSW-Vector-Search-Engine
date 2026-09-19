# hnsw-index

Custom HNSW (Hierarchical Navigable Small World) vector index built from scratch in TypeScript — no FAISS or pgvector dependencies.

## Features
- **Hierarchical Graph Search**: Multi-layer skip-list graph structure with probabilistic layer assignment ($m_L = 1 / \ln(M)$).
- **Greedy Upper-Layer Descent**: Fast 1-NN hopping (`ef = 1`) through upper layers down to the target layer.
- **Diversity-Aware Heuristic**: Neighbor selection with heuristic pruning and keep-pruned fallback to maintain high graph connectivity without isolated clusters.
- **Degree Bounding**: Bidirectional connections strictly bounded to $M$ on upper layers and $M_{0} = 2M$ on layer 0 to prevent super-hub edge explosions.
- **Dual-Heap Search**: MinHeap for candidate exploration and bounded MaxHeap for the nearest found set ($W$) for $O(\log ef)$ priority queue operations.
- **Configurable Distance Metrics**: Euclidean, Squared Euclidean (for fast evaluations), Cosine similarity/distance, and Dot product.
- **Top-K Retrieval**: Returns top-$K$ candidates with distances/scores for hybrid search and reranking pipelines.
- **JSON Serialization**: Full index persistence via `exportJSON()` and `HNSWGraph.importJSON()`.

## Directory Structure
```
hnsw-index/
├── src/
│   ├── index.ts        # Public API exports
│   ├── node.ts         # Node interface definition
│   ├── graph.ts        # HNSWGraph class with insert, search, serialization
│   ├── search.ts       # Dual-heap layer search and multi-layer searchK
│   ├── minheap.ts      # MinHeap and MaxHeap priority queues
│   └── distance.ts     # Euclidean, Cosine, and Dot product distance metrics
├── tests/
│   └── graph.test.ts   # Vitest unit test suite
└── benchmarks/
    ├── dataset.json        # 5,000 vectors & 200 queries (dim=8)
    ├── ts_search.ts        # Single-query benchmark & build time
    ├── ts_multi_query.ts   # Full recall/latency sweep across efSearch values
    ├── faiss_search.py     # Comparison against FAISS C++ baseline
    └── faiss_multi_query.py # FAISS multi-query recall and latency curve
```

## How to Run Tests
```bash
npm test
```

## How to Run Benchmarks
Run TypeScript benchmarks:
```bash
npx tsx benchmarks/ts_search.ts
npx tsx benchmarks/ts_multi_query.ts
```

Run FAISS comparison benchmarks (requires Python with `faiss` and `numpy`):
```bash
python benchmarks/faiss_search.py
python benchmarks/faiss_multi_query.py
```
