import { Hono } from "hono";
import { documentStore } from "../db/store";
import { hybridService } from "../retrieval/hybrid_service";

export const documentRouter = new Hono();

documentRouter.get("/", (c) => {
    const documents = documentStore.getAllDocuments();
    return c.json({
        total: documents.length,
        documents: documents.map(d => ({
            id: d.id,
            filename: d.filename,
            chunkCount: d.chunkCount,
            createdAt: d.createdAt,
            preview: d.content.substring(0, 150) + (d.content.length > 150 ? "..." : "")
        }))
    });
});

documentRouter.get("/:id", (c) => {
    const id = c.req.param("id");
    const document = documentStore.getDocument(id);

    if (!document) {
        return c.json({ error: `Document with id '${id}' not found` }, 404);
    }

    const chunks = documentStore.getChunksByDocument(id);

    return c.json({
        document,
        chunks: chunks.map(ch => ({
            id: ch.id,
            chunkIndex: ch.chunkIndex,
            text: ch.text,
            startChar: ch.startChar,
            endChar: ch.endChar
        }))
    });
});
