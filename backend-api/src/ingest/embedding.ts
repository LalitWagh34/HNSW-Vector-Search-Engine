import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";

export interface EmbeddingProvider {
    readonly dimension: number;
    embedText(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Deterministic local feature projection embedding provider.
 * Requires 0 API keys, 0 network, runs instantly for local dev and automated tests.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
    public readonly dimension: number;

    constructor(dimension: number = 64) {
        this.dimension = dimension;
    }

    async embedText(text: string): Promise<number[]> {
        return this.computeVector(text);
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        return texts.map(t => this.computeVector(t));
    }

    private computeVector(text: string): number[] {
        const vec = new Float64Array(this.dimension);
        const tokens = text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);

        if (tokens.length === 0) {
            return Array.from(vec);
        }

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            let hash = 0;
            for (let c = 0; c < token.length; c++) {
                hash = ((hash << 5) - hash) + token.charCodeAt(c);
                hash |= 0;
            }

            // Distribute token energy across dimensions
            for (let d = 0; d < this.dimension; d++) {
                const angle = (Math.abs(hash) * (d + 1) * 0.1) % (2 * Math.PI);
                vec[d] += Math.cos(angle) / Math.sqrt(tokens.length);
            }
        }

        // L2 Normalization
        let norm = 0;
        for (let d = 0; d < this.dimension; d++) {
            norm += vec[d] * vec[d];
        }
        norm = Math.sqrt(norm);

        if (norm > 0) {
            for (let d = 0; d < this.dimension; d++) {
                vec[d] /= norm;
            }
        }

        return Array.from(vec);
    }
}

/**
 * Production-ready embedding provider using Google Gemini's gemini-embedding-001 model.
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
    public readonly dimension: number = 3072;
    private genAI: GoogleGenerativeAI;
    private modelName: string = "gemini-embedding-001";

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("Gemini API key is required to initialize GeminiEmbeddingProvider");
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    async embedText(text: string): Promise<number[]> {
        const model = this.genAI.getGenerativeModel({ model: this.modelName });
        const result = await model.embedContent(text);
        return result.embedding.values;
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        const results: number[][] = [];
        // Sequential/chunked to respect rate limits
        for (const text of texts) {
            const vec = await this.embedText(text);
            results.push(vec);
        }
        return results;
    }
}

let activeProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
    if (activeProvider) return activeProvider;

    if (config.embeddingProvider === "gemini" && config.geminiApiKey) {
        console.log("[EmbeddingProvider] Initialized Google Gemini (gemini-embedding-001)");
        activeProvider = new GeminiEmbeddingProvider(config.geminiApiKey);
    } else {
        console.log("[EmbeddingProvider] Initialized Local Zero-Key Deterministic Provider");
        activeProvider = new LocalEmbeddingProvider(64);
    }

    return activeProvider;
}

export function setEmbeddingProvider(provider: EmbeddingProvider): void {
    activeProvider = provider;
}
