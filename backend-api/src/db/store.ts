import fs from "fs";
import path from "path";

export interface Document {
    id: string;
    filename: string;
    content: string;
    createdAt: string;
    chunkCount: number;
    metadata?: Record<string, any>;
}

export interface Chunk {
    id: string;
    documentId: string;
    chunkIndex: number;
    text: string;
    startChar: number;
    endChar: number;
    vector?: number[];
}

export class DocumentStore {
    private documents: Map<string, Document> = new Map();
    private chunks: Map<string, Chunk> = new Map();

    addDocument(doc: Document): void {
        this.documents.set(doc.id, doc);
    }

    getDocument(id: string): Document | undefined {
        return this.documents.get(id);
    }

    getAllDocuments(): Document[] {
        return Array.from(this.documents.values());
    }

    addChunks(chunks: Chunk[]): void {
        for (const chunk of chunks) {
            this.chunks.set(chunk.id, chunk);
        }
    }

    getChunk(id: string): Chunk | undefined {
        return this.chunks.get(id);
    }

    getAllChunks(): Chunk[] {
        return Array.from(this.chunks.values());
    }

    getChunksByDocument(documentId: string): Chunk[] {
        const result: Chunk[] = [];
        for (const chunk of this.chunks.values()) {
            if (chunk.documentId === documentId) {
                result.push(chunk);
            }
        }
        return result.sort((a, b) => a.chunkIndex - b.chunkIndex);
    }

    saveToDisk(filePath: string): void {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const data = {
            documents: Array.from(this.documents.values()),
            chunks: Array.from(this.chunks.values())
        };

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    }

    loadFromDisk(filePath: string): boolean {
        if (!fs.existsSync(filePath)) return false;

        try {
            const raw = fs.readFileSync(filePath, "utf-8");
            const data = JSON.parse(raw);

            this.documents.clear();
            this.chunks.clear();

            for (const doc of data.documents || []) {
                this.documents.set(doc.id, doc);
            }

            for (const chunk of data.chunks || []) {
                this.chunks.set(chunk.id, chunk);
            }

            return true;
        } catch (err) {
            console.error("Failed to load document store from disk:", err);
            return false;
        }
    }

    clear(): void {
        this.documents.clear();
        this.chunks.clear();
    }
}

export const documentStore = new DocumentStore();
