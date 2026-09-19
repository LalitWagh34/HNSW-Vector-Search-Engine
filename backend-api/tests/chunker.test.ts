import { describe, it, expect } from "vitest";
import { chunkText } from "../src/ingest/chunker";

describe("Text Chunker", () => {
    it("returns empty array for empty or whitespace text", () => {
        expect(chunkText("")).toEqual([]);
        expect(chunkText("   \n\t  ")).toEqual([]);
    });

    it("returns a single chunk if text is smaller than chunkSize", () => {
        const text = "This is a short text.";
        const chunks = chunkText(text, { chunkSize: 100 });
        expect(chunks.length).toBe(1);
        expect(chunks[0].text).toBe(text);
        expect(chunks[0].chunkIndex).toBe(0);
    });

    it("splits long text into overlapping chunks", () => {
        const text = "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five. Sentence six.";
        const chunks = chunkText(text, { chunkSize: 40, chunkOverlap: 15 });

        expect(chunks.length).toBeGreaterThan(1);
        for (let i = 0; i < chunks.length; i++) {
            expect(chunks[i].chunkIndex).toBe(i);
            expect(chunks[i].text.length).toBeGreaterThan(0);
        }
    });

    it("respects natural sentence boundaries where possible", () => {
        const text = "First paragraph ends here.\n\nSecond paragraph starts here and keeps going with lots of text to test paragraph boundary chunking.";
        const chunks = chunkText(text, { chunkSize: 50, chunkOverlap: 10 });

        expect(chunks.length).toBeGreaterThan(1);
        // First chunk should ideally break at paragraph break
        expect(chunks[0].text).toContain("First paragraph ends here.");
    });
});
