import { Hono } from "hono";
import { chunkText } from "../ingest/chunker";
import { getEmbeddingProvider } from "../ingest/embedding";
import { documentStore, Document, Chunk } from "../db/store";
import { hybridService } from "../retrieval/hybrid_service";
import { PrismaRepository } from "../db/prisma";

export const ingestRouter = new Hono();

ingestRouter.post("/", async (c) => {
    try {
        const body = await c.req.json();
        const { text, filename, metadata, chunkSize, chunkOverlap } = body;

        if (!text || typeof text !== "string" || text.trim().length === 0) {
            return c.json({ error: "Missing or invalid 'text' field in request body" }, 400);
        }

        const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const docName = filename || `document_${docId}.txt`;

        // 1. Chunk the text
        const chunkSlices = chunkText(text, { chunkSize, chunkOverlap });

        if (chunkSlices.length === 0) {
            return c.json({ error: "No valid chunks could be generated from the text" }, 400);
        }

        // 2. Generate embeddings
        const embeddingProvider = getEmbeddingProvider();
        const chunkTexts = chunkSlices.map(s => s.text);
        const vectors = await embeddingProvider.embedBatch(chunkTexts);

        // 3. Prepare chunks and document
        const chunks: Chunk[] = chunkSlices.map((slice, i) => ({
            id: `chunk_${docId}_${i}`,
            documentId: docId,
            chunkIndex: slice.chunkIndex,
            text: slice.text,
            startChar: slice.startChar,
            endChar: slice.endChar,
            vector: vectors[i]
        }));

        const document: Document = {
            id: docId,
            filename: docName,
            content: text,
            createdAt: new Date().toISOString(),
            chunkCount: chunks.length,
            metadata: metadata || {}
        };

        // 4. Save to store and index into HNSW + BM25
        documentStore.addDocument(document);
        documentStore.addChunks(chunks);

        for (let i = 0; i < chunks.length; i++) {
            hybridService.indexChunk(chunks[i], vectors[i]);
        }

        // Persist index state to disk
        hybridService.saveState();

        // Sync with PostgreSQL via Prisma if DATABASE_URL is configured
        PrismaRepository.saveDocumentWithChunks(document, chunks).catch((err) => {
            console.warn("[Prisma] Background PostgreSQL sync notice:", err.message);
        });

        // 5. Persist state to disk asynchronously
        try {
            hybridService.saveState();
        } catch (saveErr) {
            console.warn("[Ingest] Could not save state to disk:", saveErr);
        }

        return c.json({
            success: true,
            document: {
                id: docId,
                filename: docName,
                chunkCount: chunks.length,
                createdAt: document.createdAt
            }
        }, 201);
    } catch (err: any) {
        console.error("[Ingest Error]:", err);
        return c.json({ error: err.message || "Failed to ingest document" }, 500);
    }
});
