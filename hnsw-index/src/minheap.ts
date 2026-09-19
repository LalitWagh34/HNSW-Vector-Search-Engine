export interface HeapItem<T> {
    value: T;
    priority: number;
}

export class MinHeap<T> {
    private items: HeapItem<T>[] = [];

    get size(): number {
        return this.items.length;
    }

    push(value: T, priority: number): void {
        this.items.push({ value, priority });
        this.bubbleUp(this.items.length - 1);
    }

    pop(): T | undefined {
        return this.popWithPriority()?.value;
    }

    popWithPriority(): HeapItem<T> | undefined {
        if (this.items.length === 0) return undefined;

        const top = this.items[0];
        const last = this.items.pop()!;

        if (this.items.length > 0) {
            this.items[0] = last;
            this.bubbleDown(0);
        }

        return top;
    }

    peek(): T | undefined {
        return this.items[0]?.value;
    }

    peekWithPriority(): HeapItem<T> | undefined {
        return this.items[0];
    }

    getItems(): HeapItem<T>[] {
        return [...this.items];
    }

    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.items[parentIndex].priority <= this.items[index].priority) break;

            [this.items[parentIndex], this.items[index]] = [this.items[index], this.items[parentIndex]];
            index = parentIndex;
        }
    }

    private bubbleDown(index: number): void {
        const n = this.items.length;

        while (true) {
            const left = 2 * index + 1;
            const right = 2 * index + 2;
            let smallest = index;

            if (left < n && this.items[left].priority < this.items[smallest].priority) smallest = left;
            if (right < n && this.items[right].priority < this.items[smallest].priority) smallest = right;

            if (smallest === index) break;

            [this.items[smallest], this.items[index]] = [this.items[index], this.items[smallest]];
            index = smallest;
        }
    }
}

export class MaxHeap<T> {
    private items: HeapItem<T>[] = [];

    get size(): number {
        return this.items.length;
    }

    push(value: T, priority: number): void {
        this.items.push({ value, priority });
        this.bubbleUp(this.items.length - 1);
    }

    pop(): T | undefined {
        return this.popWithPriority()?.value;
    }

    popWithPriority(): HeapItem<T> | undefined {
        if (this.items.length === 0) return undefined;

        const top = this.items[0];
        const last = this.items.pop()!;

        if (this.items.length > 0) {
            this.items[0] = last;
            this.bubbleDown(0);
        }

        return top;
    }

    peek(): T | undefined {
        return this.items[0]?.value;
    }

    peekWithPriority(): HeapItem<T> | undefined {
        return this.items[0];
    }

    getItems(): HeapItem<T>[] {
        return [...this.items];
    }

    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            // In MaxHeap, parent must have greater or equal priority
            if (this.items[parentIndex].priority >= this.items[index].priority) break;

            [this.items[parentIndex], this.items[index]] = [this.items[index], this.items[parentIndex]];
            index = parentIndex;
        }
    }

    private bubbleDown(index: number): void {
        const n = this.items.length;

        while (true) {
            const left = 2 * index + 1;
            const right = 2 * index + 2;
            let largest = index;

            if (left < n && this.items[left].priority > this.items[largest].priority) largest = left;
            if (right < n && this.items[right].priority > this.items[largest].priority) largest = right;

            if (largest === index) break;

            [this.items[largest], this.items[index]] = [this.items[index], this.items[largest]];
            index = largest;
        }
    }
}