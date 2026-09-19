import { HNSWGraph } from "../src/graph";
import * as fs from "fs";
import * as path from "path";
import { searchLayerHeap, findEntryPoint } from "../src/search";

const dataPath = path.join(process.cwd(), "benchmarks", "dataset.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

const vectors: number[][] = data.vectors;
const queries: number[][] = data.queries;

const g = new HNSWGraph({ M: 16, efConstruction: 40 });
console.log(`Indexing ${vectors.length} vectors...`);
const startBuild = Date.now();
for (let i = 0; i < vectors.length; i++) {
    g.insert(`node_${i}`, vectors[i]);
}
console.log(`Indexed in ${Date.now() - startBuild}ms`);

const nodes = g.getAllNodes();
const entryPoint = findEntryPoint(nodes);

function timeFunction(fn: () => void): number {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1_000_000; // ms
}

function benchmark(name: string, ef: number) {
    let totalTime = 0;

    for (const query of queries) {
        const time = timeFunction(() => {
            searchLayerHeap(query, nodes, entryPoint.id, 0, ef);
        });
        totalTime += time;
    }

    const avg = totalTime / queries.length;
    console.log(`${name} (ef=${ef}): avg ${avg.toFixed(4)}ms over ${queries.length} queries`);
}

for (const ef of [1, 5, 10, 20, 50]) {
    benchmark("Heap searchLayer", ef);
    console.log("---");
}