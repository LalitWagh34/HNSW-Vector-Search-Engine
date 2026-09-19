import { Hono } from "hono";
import { hybridService } from "../retrieval/hybrid_service";

export const retrievalRouter = new Hono();

retrievalRouter.post("/", async (c) => {
    try {
        const body = await c.req.json();
        const { query, top_k, topK, mode } = body;

        if (!query || typeof query !== "string" || query.trim().length === 0) {
            return c.json({ error: "Missing or invalid 'query' field in request body" }, 400);
        }

        const effectiveTopK = top_k || topK || 5;
        const searchMode = (mode === "dense" || mode === "sparse" || mode === "hybrid") ? mode : "hybrid";

        const results = await hybridService.search(query.trim(), {
            topK: effectiveTopK,
            mode: searchMode
        });

        return c.json({
            query: query.trim(),
            mode: searchMode,
            count: results.length,
            results
        });
    } catch (err: any) {
        console.error("[Retrieval Error]:", err);
        return c.json({ error: err.message || "Failed to perform retrieval" }, 500);
    }
});
