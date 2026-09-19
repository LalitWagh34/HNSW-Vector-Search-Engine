export type DistanceMetric = "euclidean" | "squaredEuclidean" | "cosine" | "dot";

export function euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(squaredEuclideanDistance(a, b));
}

export function squaredEuclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error("Vectors must be the same length");
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return sum;
}

export function dotProduct(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error("Vectors must be the same length");
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
    }
    return dot;
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error("Vectors must be the same length");
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    return dot / denom;
}

export function cosineDistance(a: number[], b: number[]): number {
    return 1 - cosineSimilarity(a, b);
}

export function getDistanceFunction(metric: DistanceMetric = "euclidean"): (a: number[], b: number[]) => number {
    switch (metric) {
        case "euclidean":
            return euclideanDistance;
        case "squaredEuclidean":
            return squaredEuclideanDistance;
        case "cosine":
            return cosineDistance;
        case "dot":
            return (a, b) => -dotProduct(a, b); // Negate for min-heap distance ordering
        default:
            return euclideanDistance;
    }
}