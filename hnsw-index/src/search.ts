import { Node } from "./node";
import { euclideanDistance, squaredEuclideanDistance } from "./distance";
import { MinHeap, MaxHeap } from "./minheap";

export interface SearchResult {
    node: Node;
    distance: number;
}

/**
 * Searches a single layer using a MinHeap for candidates and a bounded MaxHeap
 * for the nearest found elements (Algorithm 2 in Malkov & Yashunin).
 */
export function searchLayerHeapWithDistance(
    query: number[],
    nodes: Map<string, Node>,
    entryPointId: string,
    layer: number,
    ef: number,
    distFn: (a: number[], b: number[]) => number = euclideanDistance
): SearchResult[] {
    const entryNode = nodes.get(entryPointId);
    if (!entryNode) return [];

    const visited = new Set<string>();
    visited.add(entryPointId);

    const entryDist = distFn(query, entryNode.vector);

    // Candidates C: MinHeap keyed by distance to query (closest candidate popped first)
    const candidates = new MinHeap<Node>();
    candidates.push(entryNode, entryDist);

    // Found W: MaxHeap bounded to ef elements (furthest candidate popped when size > ef)
    const found = new MaxHeap<Node>();
    found.push(entryNode, entryDist);

    while (candidates.size > 0) {
        const current = candidates.popWithPriority()!;
        const worstFound = found.peekWithPriority()!;

        // Early exit: closest candidate in queue is further than the worst element in W
        if (current.priority > worstFound.priority) {
            break;
        }

        const neighborIds = current.value.neighbours[layer];
        if (!neighborIds) continue;

        const neighborCount = neighborIds.length;
        for (let i = 0; i < neighborCount; i++) {
            const neighborId = neighborIds[i];
            if (visited.has(neighborId)) continue;
            visited.add(neighborId);

            const neighborNode = nodes.get(neighborId);
            if (!neighborNode) continue;

            const d = distFn(query, neighborNode.vector);
            const currentWorst = found.peekWithPriority()!;

            if (d < currentWorst.priority || found.size < ef) {
                candidates.push(neighborNode, d);
                found.push(neighborNode, d);

                if (found.size > ef) {
                    found.pop(); // Remove furthest element
                }
            }
        }
    }

    // Return results sorted in ascending order of distance (closest first)
    return found.getItems()
        .map(item => ({ node: item.value, distance: item.priority }))
        .sort((a, b) => a.distance - b.distance);
}

/**
 * Convenience wrapper returning Node[] to preserve backwards compatibility.
 */
export function searchLayerHeap(
    query: number[],
    nodes: Map<string, Node>,
    entryPointId: string,
    layer: number,
    ef: number,
    distFn?: (a: number[], b: number[]) => number
): Node[] {
    return searchLayerHeapWithDistance(query, nodes, entryPointId, layer, ef, distFn)
        .map(item => item.node);
}

/**
 * Finds the node with the highest layer in O(N).
 */
export function findEntryPoint(nodes: Map<string, Node>): Node {
    let topNode: Node | null = null;

    for (const node of nodes.values()) {
        if (!topNode || node.maxLayer > topNode.maxLayer) {
            topNode = node;
        }
    }

    if (!topNode) {
        throw new Error("Cannot find entry point: nodes map is empty");
    }

    return topNode;
}

/**
 * Top-K multi-layer search across the HNSW graph (Algorithm 5 in Malkov & Yashunin).
 * Uses fast greedy 1-NN hopping on upper layers (no heap allocations)
 * and bounded MaxHeap beam search on layer 0.
 */
export function searchK(
    query: number[],
    nodes: Map<string, Node>,
    k: number = 1,
    ef: number = 10,
    entryPointId?: string,
    distFn: (a: number[], b: number[]) => number = euclideanDistance
): SearchResult[] {
    if (nodes.size === 0) return [];

    let currentEntryId = entryPointId ?? findEntryPoint(nodes).id;
    let currNode = nodes.get(currentEntryId);
    if (!currNode) return [];

    // Optimize Euclidean distance checks by avoiding Math.sqrt during graph traversal
    const isEuclidean = distFn === euclideanDistance;
    const traversalDistFn = isEuclidean ? squaredEuclideanDistance : distFn;

    let currDist = traversalDistFn(query, currNode.vector);

    // Phase 1: Fast greedy 1-NN descent from maxLayer down to layer 1 (Algorithm 5)
    // Zero heap/set allocations on upper layers!
    for (let layer = currNode.maxLayer; layer >= 1; layer--) {
        let changed = true;
        while (changed) {
            changed = false;
            const neighborIds = currNode.neighbours[layer];
            if (!neighborIds) break;

            const count = neighborIds.length;
            for (let i = 0; i < count; i++) {
                const neighbor = nodes.get(neighborIds[i]);
                if (!neighbor) continue;

                const d = traversalDistFn(query, neighbor.vector);
                if (d < currDist) {
                    currDist = d;
                    currNode = neighbor;
                    changed = true;
                }
            }
        }
    }

    // Phase 2: Layer 0 beam search with ef
    const finalResults = searchLayerHeapWithDistance(
        query,
        nodes,
        currNode.id,
        0,
        Math.max(ef, k),
        traversalDistFn
    );

    // Convert squared distances back to true Euclidean distance if needed
    const topK = finalResults.slice(0, k);
    if (isEuclidean) {
        for (let i = 0; i < topK.length; i++) {
            topK[i].distance = Math.sqrt(topK[i].distance);
        }
    }

    return topK;
}

/**
 * Single nearest-neighbor search for backward compatibility.
 */
export function search(query: number[], nodes: Map<string, Node>, ef: number = 10): Node {
    const results = searchK(query, nodes, 1, ef);
    if (results.length === 0) {
        throw new Error("Cannot search in an empty graph");
    }
    return results[0].node;
}