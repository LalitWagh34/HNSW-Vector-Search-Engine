import { HNSWGraph } from "../src/graph";
import { search } from "../src/search";
import { euclideanDistance } from "../src/distance";
import * as fs from "fs";
import * as path from "path";

const dataPath = path.join(process.cwd(), "benchmarks", "dataset.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

const vectors: number[][] = data.vectors;
const queries: number[][] = data.queries;

// Build ONCE with matching FAISS parameters (M=32, efConstruction=40)
const g = new HNSWGraph({ M: 32, efConstruction: 40 });
const buildStart = process.hrtime.bigint();
for (let i = 0; i < vectors.length; i++) {
    g.insert(`node_${i}`, vectors[i]);
}
const buildTimeMs = Number(process.hrtime.bigint() - buildStart) / 1_000_000;
console.log(`Build time: ${buildTimeMs.toFixed(2)}ms for ${vectors.length} vectors\n`);

function bruteForceClosestIndex(query: number[]): number {
    let closestIdx = -1;
    let closestDist = Infinity;
    for (let i = 0; i < vectors.length; i++) {
        const d = euclideanDistance(query, vectors[i]);
        if (d < closestDist) {
            closestDist = d;
            closestIdx = i;
        }
    }
    return closestIdx;
}

// Precompute ground truth ONCE
console.log("Computing ground truth for", queries.length, "queries...");
const trueClosest = queries.map(bruteForceClosestIndex);
console.log("Ground truth ready.\n");

function percentile(sorted: number[], p: number): number {
    const idx = Math.floor((p / 100) * sorted.length);
    return sorted[Math.min(idx, sorted.length - 1)];
}

function runBenchmark(ef: number) {
    let matches = 0;
    const latencies: number[] = [];

    for (let i = 0; i < queries.length; i++) {
        const start = process.hrtime.bigint();
        const result = search(queries[i], g.getAllNodes(), ef);
        const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        latencies.push(latencyMs);

        const resultIdx = parseInt(result.id.replace("node_", ""));
        if (resultIdx === trueClosest[i]) matches++;
    }

    latencies.sort((a, b) => a - b);

    const recall = (matches / queries.length) * 100;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const p99 = percentile(latencies, 99);
    const qps = 1000 / avgLatency;

    console.log(
        `ef=${ef.toString().padEnd(4)} Recall@1: ${recall.toFixed(1).padStart(5)}%  ` +
        `Avg: ${avgLatency.toFixed(4)}ms  P50: ${p50.toFixed(4)}ms  P95: ${p95.toFixed(4)}ms  P99: ${p99.toFixed(4)}ms  QPS: ${qps.toFixed(0)}`
    );
}

// Full ef sweep
console.log("Evaluating Recall@1 vs Latency across efSearch values:");
for (const ef of [1, 2, 4, 8, 16, 32, 64, 100, 200]) {
    runBenchmark(ef);
}