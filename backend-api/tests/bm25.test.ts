import { describe, it, expect } from "vitest";
import { BM25Index, tokenize } from "../src/retrieval/bm25";

describe("BM25 Sparse Index", () => {
    it("tokenizes and strips common stop words", () => {
        const tokens = tokenize("The quick brown fox jumps over the lazy dog");
        expect(tokens).toContain("quick");
        expect(tokens).toContain("brown");
        expect(tokens).toContain("fox");
        expect(tokens).not.toContain("the");
    });

    it("ranks documents with exact keyword matches higher", () => {
        const index = new BM25Index();

        index.addDocument("doc1", "Hierarchical Navigable Small World is a graph-based vector index algorithm.");
        index.addDocument("doc2", "React is a JavaScript library for building user interfaces.");
        index.addDocument("doc3", "LangGraph is a framework for building stateful agentic workflows with LLMs.");

        const results = index.search("HNSW graph vector index", 3);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].id).toBe("doc1");
    });

    it("serializes and restores index with matching search scores", () => {
        const index = new BM25Index();
        index.addDocument("docA", "Product SKU-9942 is a high precision hydraulic valve.");
        index.addDocument("docB", "Standard bolts and screws for industrial assembly.");

        const origResults = index.search("SKU-9942", 1);
        expect(origResults[0].id).toBe("docA");

        const json = index.toJSON();
        const restored = BM25Index.fromJSON(json);

        const restoredResults = restored.search("SKU-9942", 1);
        expect(restoredResults[0].id).toBe("docA");
        expect(restoredResults[0].score).toBeCloseTo(origResults[0].score, 5);
    });
});
