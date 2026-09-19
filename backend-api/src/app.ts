import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ingestRouter } from "./routes/ingest.routes";
import { retrievalRouter } from "./routes/retrieval.routes";
import { documentRouter } from "./routes/document.routes";
import { hybridService } from "./retrieval/hybrid_service";
import { config } from "./config";

export const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

import { checkDatabaseConnection } from "./db/prisma";

// Health Check
app.get("/health", async (c) => {
    const dbConnected = await checkDatabaseConnection();
    return c.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        embeddingProvider: config.embeddingProvider,
        database: {
            configured: Boolean(process.env.DATABASE_URL),
            connected: dbConnected
        }
    });
});

// System Stats
app.get("/api/stats", (c) => {
    return c.json({
        status: "ok",
        stats: hybridService.getStats()
    });
});

// Routes
app.route("/api/ingest", ingestRouter);
app.route("/api/retrieve", retrievalRouter);
app.route("/api/documents", documentRouter);

// Global Error Handler
app.onError((err, c) => {
    console.error("[Unhandled Error]:", err);
    return c.json({
        error: err.message || "Internal Server Error"
    }, 500);
});
