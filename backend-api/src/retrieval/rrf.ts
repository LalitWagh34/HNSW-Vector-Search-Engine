export interface RankedItem {
    id: string;
}

export interface FusedItem {
    id: string;
    score: number;
    denseRank: number | null;
    sparseRank: number | null;
}

export interface RRFOptions {
    k?: number; // Smoothing factor (default 60)
    denseWeight?: number;
    sparseWeight?: number;
}

/**
 * Combines dense and sparse ranked result lists using Reciprocal Rank Fusion (RRF).
 * Formula: RRF_score(d) = sum_{m in {dense, sparse}} weight_m / (k + rank_m(d))
 */
export function reciprocalRankFusion(
    denseResults: RankedItem[],
    sparseResults: RankedItem[],
    options?: RRFOptions
): FusedItem[] {
    const k = options?.k ?? 60;
    const denseWeight = options?.denseWeight ?? 1.0;
    const sparseWeight = options?.sparseWeight ?? 1.0;

    const scores = new Map<string, { score: number; denseRank: number | null; sparseRank: number | null }>();

    // 1. Process dense rankings (1-indexed)
    for (let rank = 0; rank < denseResults.length; rank++) {
        const item = denseResults[rank];
        const rankPos = rank + 1;
        const rrfContribution = denseWeight / (k + rankPos);

        const current = scores.get(item.id) || { score: 0, denseRank: null, sparseRank: null };
        current.score += rrfContribution;
        current.denseRank = rankPos;
        scores.set(item.id, current);
    }

    // 2. Process sparse rankings (1-indexed)
    for (let rank = 0; rank < sparseResults.length; rank++) {
        const item = sparseResults[rank];
        const rankPos = rank + 1;
        const rrfContribution = sparseWeight / (k + rankPos);

        const current = scores.get(item.id) || { score: 0, denseRank: null, sparseRank: null };
        current.score += rrfContribution;
        current.sparseRank = rankPos;
        scores.set(item.id, current);
    }

    // 3. Assemble and sort
    const fused: FusedItem[] = [];
    for (const [id, data] of scores.entries()) {
        fused.push({
            id,
            score: data.score,
            denseRank: data.denseRank,
            sparseRank: data.sparseRank
        });
    }

    return fused.sort((a, b) => b.score - a.score);
}
