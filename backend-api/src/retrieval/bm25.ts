export interface BM25SearchResult {
    id: string;
    score: number;
}

const STOP_WORDS = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
    "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
    "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
    "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
    "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
    "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it",
    "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
    "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other",
    "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't",
    "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
    "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what",
    "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's",
    "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd",
    "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
]);

export function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

export class BM25Index {
    public readonly k1: number;
    public readonly b: number;

    // Doc ID -> term frequency map (term -> count)
    private docTermFreqs: Map<string, Map<string, number>> = new Map();
    // Doc ID -> document length
    private docLengths: Map<string, number> = new Map();
    // Term -> number of documents containing term
    private docFreqs: Map<string, number> = new Map();
    // Total document length across corpus
    private totalLength: number = 0;

    constructor(k1: number = 1.5, b: number = 0.75) {
        this.k1 = k1;
        this.b = b;
    }

    addDocument(id: string, text: string): void {
        const tokens = tokenize(text);
        const termFreq = new Map<string, number>();

        for (const token of tokens) {
            termFreq.set(token, (termFreq.get(token) || 0) + 1);
        }

        // Update document frequency
        for (const term of termFreq.keys()) {
            this.docFreqs.set(term, (this.docFreqs.get(term) || 0) + 1);
        }

        this.docTermFreqs.set(id, termFreq);
        this.docLengths.set(id, tokens.length);
        this.totalLength += tokens.length;
    }

    search(query: string, topK: number = 10): BM25SearchResult[] {
        const queryTokens = tokenize(query);
        if (queryTokens.length === 0 || this.docLengths.size === 0) {
            return [];
        }

        const N = this.docLengths.size;
        const avgdl = this.totalLength / N;
        const scores = new Map<string, number>();

        for (const token of queryTokens) {
            const df = this.docFreqs.get(token) || 0;
            if (df === 0) continue;

            // Robertson-Spärck Jones IDF
            const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

            for (const [docId, tfMap] of this.docTermFreqs.entries()) {
                const tf = tfMap.get(token) || 0;
                if (tf === 0) continue;

                const docLen = this.docLengths.get(docId) || 0;
                const numerator = tf * (this.k1 + 1);
                const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / avgdl));
                const termScore = idf * (numerator / denominator);

                scores.set(docId, (scores.get(docId) || 0) + termScore);
            }
        }

        const results: BM25SearchResult[] = [];
        for (const [id, score] of scores.entries()) {
            results.push({ id, score });
        }

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    size(): number {
        return this.docLengths.size;
    }

    vocabularySize(): number {
        return this.docFreqs.size;
    }

    clear(): void {
        this.docTermFreqs.clear();
        this.docLengths.clear();
        this.docFreqs.clear();
        this.totalLength = 0;
    }

    toJSON(): string {
        const docsData: Record<string, { termFreq: Record<string, number>; length: number }> = {};
        for (const [id, tfMap] of this.docTermFreqs.entries()) {
            const termFreqObj: Record<string, number> = {};
            for (const [t, c] of tfMap.entries()) termFreqObj[t] = c;
            docsData[id] = {
                termFreq: termFreqObj,
                length: this.docLengths.get(id) || 0
            };
        }

        const docFreqsObj: Record<string, number> = {};
        for (const [t, c] of this.docFreqs.entries()) docFreqsObj[t] = c;

        return JSON.stringify({
            k1: this.k1,
            b: this.b,
            totalLength: this.totalLength,
            docs: docsData,
            docFreqs: docFreqsObj
        });
    }

    static fromJSON(jsonStr: string): BM25Index {
        const data = JSON.parse(jsonStr);
        const index = new BM25Index(data.k1, data.b);
        index.totalLength = data.totalLength;

        for (const [id, doc] of Object.entries<any>(data.docs)) {
            const tfMap = new Map<string, number>();
            for (const [t, c] of Object.entries<number>(doc.termFreq)) {
                tfMap.set(t, c);
            }
            index.docTermFreqs.set(id, tfMap);
            index.docLengths.set(id, doc.length);
        }

        for (const [t, c] of Object.entries<number>(data.docFreqs)) {
            index.docFreqs.set(t, c);
        }

        return index;
    }
}
