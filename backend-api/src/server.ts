import { serve } from "@hono/node-server";
import { app } from "./app";
import { config } from "./config";
import { hybridService } from "./retrieval/hybrid_service";

// Attempt to restore existing index and document state from disk
hybridService.loadState(config.dataDir);

const server = serve({
    fetch: app.fetch,
    port: config.port
}, (info) => {
    console.log(`\n======================================================`);
    console.log(` Agentic RAG Backend API`);
    console.log(` Server running on http://localhost:${info.port}`);
    console.log(` Embedding Provider : ${config.embeddingProvider}`);
    console.log(` HNSW Parameters    : M=${config.hnswM}, efConst=${config.hnswEfConstruction}`);
    console.log(` Storage Path       : ${config.dataDir}`);
    console.log(`======================================================`);
    console.log(` Available Endpoints:`);
    console.log(` - GET  /health           : Service health`);
    console.log(` - GET  /api/stats        : HNSW & BM25 index metrics`);
    console.log(` - POST /api/ingest       : Document chunking & indexing`);
    console.log(` - POST /api/retrieve     : Hybrid / Dense / Sparse retrieval`);
    console.log(` - GET  /api/documents    : Document catalog`);
    console.log(`======================================================\n`);
});

// Graceful shutdown with state persistence
const gracefulShutdown = () => {
    console.log("\n[Server] Shutting down, persisting index state...");
    try {
        hybridService.saveState(config.dataDir);
    } catch (err) {
        console.error("[Server] Error persisting state during shutdown:", err);
    }
    process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
