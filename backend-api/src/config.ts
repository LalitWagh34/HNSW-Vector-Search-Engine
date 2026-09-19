import dotenv from "dotenv";
import path from "path";

dotenv.config();

export interface AppConfig {
    port: number;
    embeddingProvider: "gemini" | "local";
    geminiApiKey: string;
    groqApiKey: string;
    hnswM: number;
    hnswEfConstruction: number;
    hnswEfSearch: number;
    dataDir: string;
}

export const config: AppConfig = {
    port: parseInt(process.env.PORT || "4000", 10),
    embeddingProvider: (process.env.EMBEDDING_PROVIDER === "gemini" ? "gemini" : "local") as "gemini" | "local",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    groqApiKey: process.env.GROQ_API_KEY || "",
    hnswM: parseInt(process.env.HNSW_M || "16", 10),
    hnswEfConstruction: parseInt(process.env.HNSW_EF_CONSTRUCTION || "64", 10),
    hnswEfSearch: parseInt(process.env.HNSW_EF_SEARCH || "8", 10),
    dataDir: path.resolve(process.cwd(), process.env.DATA_DIR || "./data")
};
