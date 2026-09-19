import fs from "fs";
import path from "path";
import { HNSWGraph } from "../../../hnsw-index/src/graph";
import { BM25Index } from "./bm25";
import { reciprocalRankFusion } from "./rrf";
import { DocumentStore, documentStore, Chunk } from "../db/store";
import { EmbeddingProvider, getEmbeddingProvider } from "../ingest/embedding";
import { config } from "../config";

export interface RetrievalResult {
    chunkId: string;
    documentId: string;
    text: string;
    score: number;
    denseRank: number | null;
    sparseRank: number | null;
    source: "hybrid" | "dense" | "sparse";
}

export interface RetrievalOptions {
    topK?: number;
    mode?: "hybrid" | "dense" | "sparse";
    denseCandidates?: number;
    sparseCandidates?: number;
}

export class HybridRetrievalService {
    public hnsw: HNSWGraph;
    public bm25: BM25Index;
    public store: DocumentStore;
    public embeddingProvider: EmbeddingProvider;

    constructor(store: DocumentStore = documentStore, embeddingProvider?: EmbeddingProvider) {
        this.store = store;
        this.embeddingProvider = embeddingProvider ?? getEmbeddingProvider();
        this.hnsw = new HNSWGraph({
            M: config.hnswM,
            efConstruction: config.hnswEfConstruction,
            metric: "cosine" // Embeddings benefit from cosine metric
        });
        this.bm25 = new BM25Index(1.5, 0.75);
    }

    indexChunk(chunk: Chunk, vector: number[]): void {
        this.hnsw.insert(chunk.id, vector);
        this.bm25.addDocument(chunk.id, chunk.text);
    }

    async search(query: string, options?: RetrievalOptions): Promise<RetrievalResult[]> {
        const topK = options?.topK ?? 5;
        const mode = options?.mode ?? "hybrid";
        const candidatePool = Math.max(topK * 4, 20);

        if (mode === "sparse") {
            const sparseMatches = this.bm25.search(query, topK);
            return sparseMatches.map((m, idx) => {
                const chunk = this.store.getChunk(m.id);
                return {
                    chunkId: m.id,
                    documentId: chunk?.documentId ?? "",
                    text: chunk?.text ?? "",
                    score: m.score,
                    denseRank: null,
                    sparseRank: idx + 1,
                    source: "sparse" as const
                };
            });
        }

        const queryVector = await this.embeddingProvider.embedText(query);

        if (mode === "dense") {
            const denseMatches = this.hnsw.search(queryVector, topK, config.hnswEfSearch);
            return denseMatches.map((m, idx) => {
                const chunk = this.store.getChunk(m.node.id);
                // Convert distance to similarity score
                const score = 1 / (1 + m.distance);
                return {
                    chunkId: m.node.id,
                    documentId: chunk?.documentId ?? "",
                    text: chunk?.text ?? "",
                    score,
                    denseRank: idx + 1,
                    sparseRank: null,
                    source: "dense" as const
                };
            });
        }

        // Mode === "hybrid" (RRF Fusion)
        const denseMatches = this.hnsw.search(queryVector, candidatePool, config.hnswEfSearch);
        const sparseMatches = this.bm25.search(query, candidatePool);

        const denseRanked = denseMatches.map(m => ({ id: m.node.id }));
        const sparseRanked = sparseMatches.map(m => ({ id: m.id }));

        const fused = reciprocalRankFusion(denseRanked, sparseRanked, { k: 60 });
        const topFused = fused.slice(0, topK);

        return topFused.map(f => {
            const chunk = this.store.getChunk(f.id);
            return {
                chunkId: f.id,
                documentId: chunk?.documentId ?? "",
                text: chunk?.text ?? "",
                score: f.score,
                denseRank: f.denseRank,
                sparseRank: f.sparseRank,
                source: "hybrid" as const
            };
        });
    }

    saveState(dataDir: string = config.dataDir): void {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const hnswPath = path.join(dataDir, "hnsw_index.json");
        const bm25Path = path.join(dataDir, "bm25_index.json");
        const storePath = path.join(dataDir, "documents.json");

        fs.writeFileSync(hnswPath, this.hnsw.exportJSON(), "utf-8");
        fs.writeFileSync(bm25Path, this.bm25.toJSON(), "utf-8");
        this.store.saveToDisk(storePath);

        console.log(`[HybridService] Saved state to ${dataDir}`);
    }

    loadState(dataDir: string = config.dataDir): boolean {
        const hnswPath = path.join(dataDir, "hnsw_index.json");
        const bm25Path = path.join(dataDir, "bm25_index.json");
        const storePath = path.join(dataDir, "documents.json");

        if (!fs.existsSync(hnswPath) || !fs.existsSync(bm25Path) || !fs.existsSync(storePath)) {
            return false;
        }

        try {
            const hnswRaw = fs.readFileSync(hnswPath, "utf-8");
            const parsedData = JSON.parse(hnswRaw);
            const firstVector = parsedData.nodes?.[0]?.vector;

            if (firstVector && firstVector.length !== this.embeddingProvider.dimension) {
                console.warn(`[HybridService] Dimension mismatch: saved index has dim ${firstVector.length}, but active provider requires ${this.embeddingProvider.dimension}. Reinitializing fresh index.`);
                this.hnsw = new HNSWGraph({
                    M: config.hnswM,
                    efConstruction: config.hnswEfConstruction,
                    metric: "cosine"
                });
                this.bm25 = new BM25Index(1.5, 0.75);
                this.store = new DocumentStore();
                return false;
            }

            this.hnsw = HNSWGraph.importJSON(hnswRaw);

            const bm25Raw = fs.readFileSync(bm25Path, "utf-8");
            this.bm25 = BM25Index.fromJSON(bm25Raw);

            this.store.loadFromDisk(storePath);
            console.log(`[HybridService] Loaded index with ${this.hnsw.size()} vectors from ${dataDir}`);
            return true;
        } catch (err) {
            console.error("[HybridService] Failed to load index state:", err);
            return false;
        }
    }

    getStats(): Record<string, any> {
        return {
            vectorCount: this.hnsw.size(),
            maxLayer: this.hnsw.getMaxLayer(),
            bm25DocumentCount: this.bm25.size(),
            bm25VocabularySize: this.bm25.vocabularySize(),
            totalDocuments: this.store.getAllDocuments().length,
            totalChunks: this.store.getAllChunks().length,
            embeddingDimension: this.embeddingProvider.dimension,
            hnswParameters: {
                M: this.hnsw.M,
                M0: this.hnsw.M0,
                efConstruction: this.hnsw.efConstruction,
                efSearch: config.hnswEfSearch
            }
        };
    }

    clear(): void {
        this.hnsw = new HNSWGraph({
            M: config.hnswM,
            efConstruction: config.hnswEfConstruction,
            metric: "cosine"
        });
        this.bm25.clear();
        this.store.clear();
    }
}

export const hybridService = new HybridRetrievalService();
