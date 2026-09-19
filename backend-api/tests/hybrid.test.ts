import { describe, it, expect, beforeEach } from "vitest";
import { reciprocalRankFusion } from "../src/retrieval/rrf";
import { HybridRetrievalService } from "../src/retrieval/hybrid_service";
import { DocumentStore } from "../src/db/store";
import { LocalEmbeddingProvider } from "../src/ingest/embedding";

describe("Reciprocal Rank Fusion (RRF)", () => {
    it("combines dense and sparse rankings with standard smoothing", () => {
        const dense = [{ id: "docA" }, { id: "docB" }, { id: "docC" }];
        const sparse = [{ id: "docB" }, { id: "docD" }, { id: "docA" }];

        const fused = reciprocalRankFusion(dense, sparse, { k: 60 });

        // docB appears at dense rank 2 and sparse rank 1:
        // score(docB) = 1/(60+2) + 1/(60+1) = 1/62 + 1/61 = 0.016129 + 0.016393 = 0.03252
        // docA appears at dense rank 1 and sparse rank 3:
        // score(docA) = 1/(60+1) + 1/(60+3) = 1/61 + 1/63 = 0.016393 + 0.015873 = 0.03226
        // docB should rank #1
        expect(fused[0].id).toBe("docB");
        expect(fused[1].id).toBe("docA");
    });
});

describe("Hybrid Retrieval Service", () => {
    let service: HybridRetrievalService;
    let store: DocumentStore;

    beforeEach(() => {
        store = new DocumentStore();
        const embedding = new LocalEmbeddingProvider(32);
        service = new HybridRetrievalService(store, embedding);
    });

    it("indexes chunks into both HNSW and BM25 and returns hybrid results", async () => {
        const chunk1 = {
            id: "c1",
            documentId: "d1",
            chunkIndex: 0,
            text: "Artificial intelligence and neural networks require high computational power.",
            startChar: 0,
            endChar: 75
        };

        const chunk2 = {
            id: "c2",
            documentId: "d1",
            chunkIndex: 1,
            text: "Postgres and relational databases store structured records with SQL queries.",
            startChar: 76,
            endChar: 150
        };

        store.addChunks([chunk1, chunk2]);

        const v1 = await service.embeddingProvider.embedText(chunk1.text);
        const v2 = await service.embeddingProvider.embedText(chunk2.text);

        service.indexChunk(chunk1, v1);
        service.indexChunk(chunk2, v2);

        // Search for database related query
        const results = await service.search("relational databases and SQL", { mode: "hybrid", topK: 2 });

        expect(results.length).toBe(2);
        expect(results[0].chunkId).toBe("c2");
        expect(results[0].text).toContain("Postgres");
    });
});
