import os
import json
import time
import faiss
import numpy as np

data_path = os.path.join(os.path.dirname(__file__), "dataset.json")
with open(data_path, "r") as f:
    data = json.load(f)

vectors = np.array(data["vectors"], dtype="float32")
queries = np.array(data["queries"], dtype="float32")
dim = vectors.shape[1]

# Ground truth ONCE
brute_index = faiss.IndexFlatL2(dim)
brute_index.add(vectors)
_, true_indices = brute_index.search(queries, k=1)
true_indices = true_indices.flatten()

# Build ONCE
index = faiss.IndexHNSWFlat(dim, 32)
index.hnsw.efConstruction = 40
build_start = time.perf_counter()
index.add(vectors)
build_time = (time.perf_counter() - build_start) * 1000
print(f"Build time: {build_time:.2f}ms\n")

def percentile(sorted_arr, p):
    idx = int((p / 100) * len(sorted_arr))
    return sorted_arr[min(idx, len(sorted_arr) - 1)]

def run_benchmark(ef_search):
    index.hnsw.efSearch = ef_search

    matches = 0
    latencies = []

    for i, query in enumerate(queries):
        q = np.array([query], dtype="float32")
        start = time.perf_counter()
        _, result_idx = index.search(q, k=1)
        latency_ms = (time.perf_counter() - start) * 1000
        latencies.append(latency_ms)

        if result_idx[0][0] == true_indices[i]:
            matches += 1

    latencies.sort()
    recall = (matches / len(queries)) * 100
    avg_latency = sum(latencies) / len(latencies)
    p50 = percentile(latencies, 50)
    p95 = percentile(latencies, 95)
    p99 = percentile(latencies, 99)
    qps = 1000 / avg_latency

    print(f"efSearch={ef_search:<4} Recall@1: {recall:5.1f}%  Avg: {avg_latency:.4f}ms  P50: {p50:.4f}ms  P95: {p95:.4f}ms  P99: {p99:.4f}ms  QPS: {qps:.0f}")

for ef in [1, 2, 4, 5, 8, 10, 16, 20, 32, 50, 100, 200]:
    run_benchmark(ef)