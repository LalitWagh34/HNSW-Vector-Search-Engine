import { PrismaClient } from "@prisma/client";
import { Document, Chunk } from "./store";

// Global PrismaClient singleton
export const prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

let isConnected: boolean | null = null;

/**
 * Checks if the PostgreSQL database is reachable via Prisma
 */
export async function checkDatabaseConnection(): Promise<boolean> {
    if (!process.env.DATABASE_URL) {
        return false;
    }
    try {
        await prisma.$queryRaw`SELECT 1`;
        isConnected = true;
        return true;
    } catch {
        isConnected = false;
        return false;
    }
}

export class PrismaRepository {
    /**
     * Persist a document and all its chunks in a single PostgreSQL transaction
     */
    static async saveDocumentWithChunks(doc: Document, chunks: Chunk[]): Promise<boolean> {
        if (!process.env.DATABASE_URL) return false;

        try {
            await prisma.$transaction([
                prisma.document.upsert({
                    where: { id: doc.id },
                    update: {
                        filename: doc.filename,
                        content: doc.content,
                        chunkCount: doc.chunkCount
                    },
                    create: {
                        id: doc.id,
                        filename: doc.filename,
                        content: doc.content,
                        chunkCount: doc.chunkCount,
                        createdAt: new Date(doc.createdAt)
                    }
                }),
                ...chunks.map((chunk) =>
                    prisma.chunk.upsert({
                        where: { id: chunk.id },
                        update: {
                            text: chunk.text,
                            chunkIndex: chunk.chunkIndex,
                            startChar: chunk.startChar,
                            endChar: chunk.endChar
                        },
                        create: {
                            id: chunk.id,
                            documentId: doc.id,
                            text: chunk.text,
                            chunkIndex: chunk.chunkIndex,
                            startChar: chunk.startChar,
                            endChar: chunk.endChar,
                            metadata: chunk.vector ? { hasVector: true } : undefined
                        }
                    })
                )
            ]);
            return true;
        } catch (error) {
            console.warn("[PrismaRepository] Failed to sync document to PostgreSQL:", (error as Error).message);
            return false;
        }
    }

    /**
     * Load all documents and their chunks from PostgreSQL
     */
    static async loadAllDocumentsWithChunks(): Promise<{ documents: Document[]; chunks: Chunk[] } | null> {
        if (!process.env.DATABASE_URL) return null;

        try {
            const docs = await prisma.document.findMany({
                include: { chunks: { orderBy: { chunkIndex: "asc" } } }
            });

            const documents: Document[] = [];
            const chunks: Chunk[] = [];

            for (const d of docs) {
                documents.push({
                    id: d.id,
                    filename: d.filename,
                    content: d.content,
                    createdAt: d.createdAt.toISOString(),
                    chunkCount: d.chunkCount
                });

                for (const c of d.chunks) {
                    chunks.push({
                        id: c.id,
                        documentId: c.documentId,
                        chunkIndex: c.chunkIndex,
                        text: c.text,
                        startChar: c.startChar,
                        endChar: c.endChar
                    });
                }
            }

            return { documents, chunks };
        } catch (error) {
            console.warn("[PrismaRepository] Failed to load documents from PostgreSQL:", (error as Error).message);
            return null;
        }
    }

    /**
     * Persist an evaluation run log
     */
    static async logEvaluation(params: {
        query: string;
        expectedAnswer?: string;
        generatedAnswer: string;
        retrievedChunks: any[];
        faithfulness?: number;
        precision?: number;
        recall?: number;
        relevance?: number;
        durationMs?: number;
    }) {
        if (!process.env.DATABASE_URL) return null;

        try {
            return await prisma.evalLog.create({
                data: {
                    query: params.query,
                    expectedAnswer: params.expectedAnswer,
                    generatedAnswer: params.generatedAnswer,
                    retrievedChunks: params.retrievedChunks,
                    faithfulness: params.faithfulness,
                    precision: params.precision,
                    recall: params.recall,
                    relevance: params.relevance,
                    durationMs: params.durationMs
                }
            });
        } catch (error) {
            console.warn("[PrismaRepository] Failed to log evaluation:", (error as Error).message);
            return null;
        }
    }

    /**
     * Persist a conversation interaction
     */
    static async logConversation(params: {
        query: string;
        answer: string;
        citations?: string[];
        steps?: string[];
        retryCount?: number;
    }) {
        if (!process.env.DATABASE_URL) return null;

        try {
            return await prisma.conversation.create({
                data: {
                    query: params.query,
                    answer: params.answer,
                    citations: params.citations ? JSON.parse(JSON.stringify(params.citations)) : undefined,
                    steps: params.steps ? JSON.parse(JSON.stringify(params.steps)) : undefined,
                    retryCount: params.retryCount ?? 0
                }
            });
        } catch (error) {
            console.warn("[PrismaRepository] Failed to log conversation:", (error as Error).message);
            return null;
        }
    }
}
