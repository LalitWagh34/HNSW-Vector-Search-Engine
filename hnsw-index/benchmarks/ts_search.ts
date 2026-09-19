import { HNSWGraph } from "../src/graph";
import { search } from "../src/search";
import { euclideanDistance } from "../src/distance";
import fs from "node:fs";
import path from "node:path";

const dataPath = path.join(process.cwd(), "benchmarks", "dataset.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

const vectors: number[][] = data.vectors;
const query: number[] = data.query ?? data.queries[0];

const g = new HNSWGraph({ M: 32, efConstruction: 40 });

const buildStart = Date.now();
for (let i = 0; i < vectors.length; i++) {
    g.insert(`node_${i}`, vectors[i]);
}
const buildTime = Date.now() - buildStart;

const searchStart = Date.now();
const result = search(query, g.getAllNodes(), 10); // ef=10, matches FAISS's efSearch
const searchTime = Date.now() - searchStart;

const resultIndex = parseInt(result.id.replace("node_", ""));
const resultDistance = euclideanDistance(query, result.vector);

console.log("TS HNSW nearest neighbor index:", resultIndex);
console.log("TS HNSW distance:", resultDistance);
console.log("TS HNSW build time (ms):", buildTime);
console.log("TS HNSW search time (ms):", searchTime);