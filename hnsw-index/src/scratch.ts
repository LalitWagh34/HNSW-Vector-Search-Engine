import { HNSWGraph } from "./graph";
import { search } from "./search";
import { euclideanDistance } from "./distance";
import { MinHeap } from "./minheap";

const heap = new MinHeap<string>();
heap.push("c", 5);
heap.push("a", 1);
heap.push("b", 3);

console.log(heap.pop()); // should print "a" (priority 1, smallest)
console.log(heap.pop()); // should print "b" (priority 3)
console.log(heap.pop()); // should print "c" (priority 5)

const g = new HNSWGraph();
for (let i = 0; i < 200; i++) {
    g.insert(`node_${i}`, [Math.random() * 10, Math.random() * 10]);
}

function bruteForceClosest(query: number[]): string {
    let closestId = "";
    let closestDistance = Infinity;
    for (const node of g.getAllNodes().values()) {
        const d = euclideanDistance(query, node.vector);
        if (d < closestDistance) {
            closestDistance = d;
            closestId = node.id;
        }
    }
    return closestId;
}

function runTrial(ef: number, trials: number = 20): number {
    let matches = 0;
    for (let i = 0; i < trials; i++) {
        const query = [Math.random() * 10, Math.random() * 10];
        const result = search(query, g.getAllNodes(), ef);
        const trueClosest = bruteForceClosest(query);
        if (result.id === trueClosest) matches++;
    }
    return matches;
}

console.log("ef=1  ->", runTrial(1), "/ 20 matched brute-force");
console.log("ef=5  ->", runTrial(5), "/ 20 matched brute-force");
console.log("ef=20 ->", runTrial(20), "/ 20 matched brute-force");