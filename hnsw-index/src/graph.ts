import { Node } from "./node";
import { euclideanDistance, squaredEuclideanDistance, DistanceMetric, getDistanceFunction } from "./distance";
import { searchLayerHeap, searchK, SearchResult } from "./search";

export interface HNSWOptions {
    M?: number;
    efConstruction?: number;
    metric?: DistanceMetric;
}

export function assignLayer(levelMultiplier: number = 1): number {
    return Math.floor(-Math.log(Math.random()) * levelMultiplier);
}

export function selectNeighboursHeuristic(
    queryVector: number[],
    candidates: Node[],
    m: number,
    distFn: (a: number[], b: number[]) => number = euclideanDistance,
    keepPrunedConnections: boolean = true
): Node[] {
    const sorted = [...candidates].sort(
        (a, b) => distFn(queryVector, a.vector) - distFn(queryVector, b.vector)
    );

    const selected: Node[] = [];
    const discarded: Node[] = [];

    for (let i = 0; i < sorted.length; i++) {
        if (selected.length >= m) break;

        const candidate = sorted[i];
        const distToQuery = distFn(queryVector, candidate.vector);

        let isDiverse = true;
        for (let j = 0; j < selected.length; j++) {
            const distToSelected = distFn(candidate.vector, selected[j].vector);
            if (distToSelected < distToQuery) {
                isDiverse = false;
                break;
            }
        }

        if (isDiverse) {
            selected.push(candidate);
        } else {
            discarded.push(candidate);
        }
    }

    if (keepPrunedConnections && selected.length < m) {
        for (let i = 0; i < discarded.length; i++) {
            if (selected.length >= m) break;
            selected.push(discarded[i]);
        }
    }

    return selected;
}

export class HNSWGraph {
    private nodes: Map<string, Node> = new Map();
    private enterPointId: string | null = null;
    private maxLayer: number = -1;

    public readonly M: number;
    public readonly M0: number;
    public readonly efConstruction: number;
    public readonly mL: number;
    public readonly metric: DistanceMetric;
    private distFn: (a: number[], b: number[]) => number;
    private traversalDistFn: (a: number[], b: number[]) => number;

    constructor(options?: HNSWOptions) {
        this.M = options?.M ?? 16;
        this.M0 = 2 * this.M;
        this.efConstruction = options?.efConstruction ?? 64;
        this.mL = 1 / Math.log(Math.max(this.M, 2));
        this.metric = options?.metric ?? "euclidean";
        this.distFn = getDistanceFunction(this.metric);
        this.traversalDistFn = this.metric === "euclidean" ? squaredEuclideanDistance : this.distFn;
    }

    insert(id: string, vector: number[], mOverride?: number): void {
        const m = mOverride ?? this.M;
        const m0 = 2 * m;
        const mL = 1 / Math.log(Math.max(m, 2));
        const insertLayer = assignLayer(mL);

        const neighbours: Record<number, string[]> = {};
        for (let layer = 0; layer <= insertLayer; layer++) {
            neighbours[layer] = [];
        }

        const newNode: Node = { id, vector, maxLayer: insertLayer, neighbours };
        this.nodes.set(id, newNode);

        // First node in the graph becomes the initial entry point
        if (!this.enterPointId) {
            this.enterPointId = id;
            this.maxLayer = insertLayer;
            return;
        }

        let currObj = this.nodes.get(this.enterPointId)!;
        let currDist = this.traversalDistFn(vector, currObj.vector);
        const topLayer = this.maxLayer;

        // Phase 1: Fast greedy 1-NN descent from top down to insertLayer + 1 (no heap allocations)
        for (let l = topLayer; l > insertLayer; l--) {
            let changed = true;
            while (changed) {
                changed = false;
                const neighborIds = currObj.neighbours[l];
                if (!neighborIds) break;

                for (let i = 0; i < neighborIds.length; i++) {
                    const neighbor = this.nodes.get(neighborIds[i]);
                    if (!neighbor) continue;

                    const d = this.traversalDistFn(vector, neighbor.vector);
                    if (d < currDist) {
                        currDist = d;
                        currObj = neighbor;
                        changed = true;
                    }
                }
            }
        }

        // Phase 2: From min(topLayer, insertLayer) down to 0, discover candidates with efConstruction
        for (let l = Math.min(topLayer, insertLayer); l >= 0; l--) {
            const candidates = searchLayerHeap(
                vector,
                this.nodes,
                currObj.id,
                l,
                this.efConstruction,
                this.traversalDistFn
            );

            const layerM = (l === 0) ? m0 : m;
            const selected = selectNeighboursHeuristic(vector, candidates, layerM, this.traversalDistFn);

            for (let i = 0; i < selected.length; i++) {
                const neighborNode = selected[i];
                newNode.neighbours[l].push(neighborNode.id);
                neighborNode.neighbours[l].push(id);

                // Degree bounding: shrink neighbor's connections if exceeding layerM
                if (neighborNode.neighbours[l].length > layerM) {
                    const neighborCandidates = neighborNode.neighbours[l]
                        .map(nId => this.nodes.get(nId)!)
                        .filter(Boolean);

                    const pruned = selectNeighboursHeuristic(
                        neighborNode.vector,
                        neighborCandidates,
                        layerM,
                        this.traversalDistFn
                    );
                    neighborNode.neighbours[l] = pruned.map(n => n.id);
                }
            }

            if (candidates.length > 0) {
                currObj = candidates[0];
                currDist = this.traversalDistFn(vector, currObj.vector);
            }
        }

        // Update entry point if newly inserted node reached a higher layer
        if (insertLayer > this.maxLayer) {
            this.maxLayer = insertLayer;
            this.enterPointId = id;
        }
    }

    search(query: number[], k: number = 5, ef: number = 10): SearchResult[] {
        if (!this.enterPointId || this.nodes.size === 0) return [];
        return searchK(query, this.nodes, k, ef, this.enterPointId, this.distFn);
    }

    getNode(id: string): Node | undefined {
        return this.nodes.get(id);
    }

    getAllNodes(): Map<string, Node> {
        return this.nodes;
    }

    size(): number {
        return this.nodes.size;
    }

    getEnterPoint(): Node | null {
        return this.enterPointId ? this.nodes.get(this.enterPointId) ?? null : null;
    }

    getMaxLayer(): number {
        return this.maxLayer;
    }

    exportJSON(): string {
        const serializedNodes: Array<{
            id: string;
            vector: number[];
            maxLayer: number;
            neighbours: Record<number, string[]>;
        }> = [];

        for (const node of this.nodes.values()) {
            serializedNodes.push({
                id: node.id,
                vector: node.vector,
                maxLayer: node.maxLayer,
                neighbours: node.neighbours
            });
        }

        return JSON.stringify({
            M: this.M,
            efConstruction: this.efConstruction,
            metric: this.metric,
            enterPointId: this.enterPointId,
            maxLayer: this.maxLayer,
            nodes: serializedNodes
        });
    }

    static importJSON(jsonStr: string): HNSWGraph {
        const data = JSON.parse(jsonStr);
        const graph = new HNSWGraph({
            M: data.M,
            efConstruction: data.efConstruction,
            metric: data.metric
        });

        graph.enterPointId = data.enterPointId;
        graph.maxLayer = data.maxLayer;

        for (const n of data.nodes) {
            graph.nodes.set(n.id, {
                id: n.id,
                vector: n.vector,
                maxLayer: n.maxLayer,
                neighbours: n.neighbours
            });
        }

        return graph;
    }
}