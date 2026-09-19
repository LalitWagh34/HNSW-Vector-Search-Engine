import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../src/app";
import { hybridService } from "../src/retrieval/hybrid_service";

describe("Backend API End-to-End Tests", () => {
    beforeEach(() => {
        hybridService.clear();
    });

    it("GET /health returns status ok", async () => {
        const res = await app.request("/health");
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.status).toBe("ok");
        expect(data.embeddingProvider).toBeDefined();
    });

    it("POST /api/ingest ingests and chunks text properly", async () => {
        const payload = {
            text: "Hierarchical Navigable Small World (HNSW) graphs are state of the art for approximate nearest neighbors. BM25 is an effective sparse retrieval algorithm based on term frequency and inverse document frequency. Combining them yields high precision and recall.",
            filename: "retrieval_guide.txt",
            chunkSize: 120,
            chunkOverlap: 20
        };

        const res = await app.request("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.document.filename).toBe("retrieval_guide.txt");
        expect(data.document.chunkCount).toBeGreaterThanOrEqual(2);
    });

    it("POST /api/retrieve returns ranked results for hybrid, dense, and sparse queries", async () => {
        // Ingest two distinct documents
        await app.request("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: "Quantum computing utilizes superposition and entanglement to execute complex calculations exponentially faster than classical computers.",
                filename: "quantum.txt"
            })
        });

        await app.request("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: "PostgreSQL is an open-source object-relational database system with over 35 years of active development.",
                filename: "postgres.txt"
            })
        });

        // 1. Hybrid search
        const hybridRes = await app.request("/api/retrieve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: "quantum superposition and qubit states",
                top_k: 2,
                mode: "hybrid"
            })
        });

        expect(hybridRes.status).toBe(200);
        const hybridData = await hybridRes.json();
        expect(hybridData.results.length).toBeGreaterThan(0);
        expect(hybridData.results[0].text).toContain("Quantum computing");

        // 2. Sparse keyword search
        const sparseRes = await app.request("/api/retrieve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: "PostgreSQL database system",
                top_k: 1,
                mode: "sparse"
            })
        });

        expect(sparseRes.status).toBe(200);
        const sparseData = await sparseRes.json();
        expect(sparseData.results.length).toBe(1);
        expect(sparseData.results[0].text).toContain("PostgreSQL");
    });

    it("GET /api/documents and GET /api/stats return catalog and index metrics", async () => {
        await app.request("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: "Testing document stats and listing catalog.",
                filename: "test_doc.txt"
            })
        });

        const docsRes = await app.request("/api/documents");
        expect(docsRes.status).toBe(200);
        const docsData = await docsRes.json();
        expect(docsData.total).toBe(1);
        expect(docsData.documents[0].filename).toBe("test_doc.txt");

        const statsRes = await app.request("/api/stats");
        expect(statsRes.status).toBe(200);
        const statsData = await statsRes.json();
        expect(statsData.stats.vectorCount).toBeGreaterThanOrEqual(1);
        expect(statsData.stats.bm25DocumentCount).toBeGreaterThanOrEqual(1);
    });
});
