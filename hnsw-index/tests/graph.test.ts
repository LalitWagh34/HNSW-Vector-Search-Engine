import { describe, it, expect } from "vitest";
import { HNSWGraph } from "../src/graph";
import { search, searchK } from "../src/search";
import { euclideanDistance } from "../src/distance";

function bruteForceClosest(query: number[], nodes: Map<string, { id: string; vector: number[] }>) {
    let closestId = "";
    let closestDistance = Infinity;

    for (const node of nodes.values()) {
        const d = euclideanDistance(query, node.vector);
        if (d < closestDistance) {
            closestDistance = d;
            closestId = node.id;
        }
    }

    return closestId;
}

describe("HNSWGraph", () => {
    it("finds the same closest node as brute-force search", () => {
        const g = new HNSWGraph({ M: 8, efConstruction: 32 });

        for (let i = 0; i < 40; i++) {
            g.insert(`node_${i}`, [Math.random() * 10, Math.random() * 10]);
        }

        const query = [Math.random() * 10, Math.random() * 10];
        const result = search(query, g.getAllNodes(), 20);
        const expectedId = bruteForceClosest(query, g.getAllNodes());

        expect(result.id).toBe(expectedId);
    });

    it("returns a node that actually exists in the graph", () => {
        const g = new HNSWGraph();
        g.insert("a", [0, 0]);
        g.insert("b", [5, 5]);

        const result = search([0.1, 0.1], g.getAllNodes());
        expect(g.getNode(result.id)).toBeDefined();
    });

    it("assigns most nodes to layer 0", () => {
        const g = new HNSWGraph({ M: 16 });
        for (let i = 0; i < 100; i++) {
            g.insert(`node_${i}`, [Math.random() * 10, Math.random() * 10]);
        }

        let layer0Count = 0;
        for (const node of g.getAllNodes().values()) {
            if (node.maxLayer === 0) layer0Count++;
        }

        // With exponential decay, the majority should land on layer 0
        expect(layer0Count).toBeGreaterThan(40);
    });

    it("higher ef generally finds equal or better results than lower ef", () => {
        const g = new HNSWGraph({ M: 8, efConstruction: 32 });
        for (let i = 0; i < 150; i++) {
            g.insert(`node_${i}`, [Math.random() * 10, Math.random() * 10]);
        }

        const query = [Math.random() * 10, Math.random() * 10];
        const resultLowEf = search(query, g.getAllNodes(), 1);
        const resultHighEf = search(query, g.getAllNodes(), 20);

        const distLow = euclideanDistance(query, resultLowEf.vector);
        const distHigh = euclideanDistance(query, resultHighEf.vector);

        expect(distHigh).toBeLessThanOrEqual(distLow + 0.0001);
    });

    it("enforces degree constraints (M on upper layers, M0 on layer 0)", () => {
        const M = 6;
        const g = new HNSWGraph({ M, efConstruction: 32 });

        for (let i = 0; i < 80; i++) {
            g.insert(`node_${i}`, [Math.random() * 10, Math.random() * 10]);
        }

        for (const node of g.getAllNodes().values()) {
            for (let l = 0; l <= node.maxLayer; l++) {
                const maxAllowed = l === 0 ? 2 * M : M;
                const neighborCount = node.neighbours[l]?.length ?? 0;
                expect(neighborCount).toBeLessThanOrEqual(maxAllowed);
            }
        }
    });

    it("supports top-K search and returns results sorted by distance", () => {
        const g = new HNSWGraph({ M: 8, efConstruction: 32 });
        for (let i = 0; i < 50; i++) {
            g.insert(`node_${i}`, [Math.random() * 10, Math.random() * 10]);
        }

        const query = [5, 5];
        const topK = g.search(query, 5, 20);

        expect(topK.length).toBe(5);
        for (let i = 0; i < topK.length - 1; i++) {
            expect(topK[i].distance).toBeLessThanOrEqual(topK[i + 1].distance);
        }
    });

    it("serializes to JSON and restores identical search behavior", () => {
        const g = new HNSWGraph({ M: 8, efConstruction: 32 });
        for (let i = 0; i < 30; i++) {
            g.insert(`node_${i}`, [Math.random() * 10, Math.random() * 10]);
        }

        const query = [3, 3];
        const originalResult = g.search(query, 3, 15);

        const json = g.exportJSON();
        const restored = HNSWGraph.importJSON(json);

        expect(restored.size()).toBe(g.size());
        expect(restored.getMaxLayer()).toBe(g.getMaxLayer());

        const restoredResult = restored.search(query, 3, 15);
        expect(restoredResult.map(r => r.node.id)).toEqual(originalResult.map(r => r.node.id));
    });
});