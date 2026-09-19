import numpy as np
import json

np.random.seed(42)

num_vectors = 5000
dim = 8
num_queries = 200

vectors = np.random.rand(num_vectors, dim).tolist()
queries = np.random.rand(num_queries, dim).tolist()

with open("dataset.json", "w") as f:
    json.dump({"vectors": vectors, "queries": queries}, f)

print(f"Generated {num_vectors} vectors and {num_queries} queries, dim {dim}")