import os
import json
import time
import faiss
import numpy as np

data_path = os.path.join(os.path.dirname(__file__), "dataset.json")
with open(data_path, "r") as f:
    data = json.load(f)

vectors = np.array(data["vectors"], dtype="float32")
query_vec = data.get("query", data["queries"][0])
query = np.array([query_vec], dtype="float32")

dim = vectors.shape[1]

# Build a FAISS index using L2 (Euclidean) distance
index = faiss.IndexHNSWFlat(dim, 32)
index.hnsw.efConstruction = 40
index.add(vectors)

# Search
index.hnsw.efSearch = 10
start = time.time()
distances, indices = index.search(query, k=1)
elapsed = time.time() - start

print("FAISS nearest neighbor index:", indices[0][0])
print("FAISS distance:", distances[0][0] ** 0.5)
print("FAISS search time (seconds):", elapsed)

# Brute-force ground-truth check
brute_index = faiss.IndexFlatL2(dim)
brute_index.add(vectors)
true_distances, true_indices = brute_index.search(query, k=1)

print("Brute-force true nearest neighbor index:", true_indices[0][0])
print("Brute-force true distance:", true_distances[0][0] ** 0.5)