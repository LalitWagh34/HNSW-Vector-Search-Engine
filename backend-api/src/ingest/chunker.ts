export interface ChunkOptions {
    chunkSize?: number;
    chunkOverlap?: number;
}

export interface ChunkSlice {
    text: string;
    startChar: number;
    endChar: number;
    chunkIndex: number;
}

/**
 * Splits text into overlapping chunks respecting paragraph, sentence, and word boundaries.
 */
export function chunkText(text: string, options?: ChunkOptions): ChunkSlice[] {
    const chunkSize = options?.chunkSize ?? 400;
    const chunkOverlap = options?.chunkOverlap ?? 50;

    if (!text || text.trim().length === 0) {
        return [];
    }

    if (text.length <= chunkSize) {
        return [{
            text: text.trim(),
            startChar: 0,
            endChar: text.length,
            chunkIndex: 0
        }];
    }

    const chunks: ChunkSlice[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length);

        // If not at the end of the text, look for a natural boundary
        if (end < text.length) {
            const lookbackLimit = Math.max(start + Math.floor(chunkSize * 0.5), start);
            const slice = text.substring(lookbackLimit, end);

            // 1. Try paragraph break
            const paragraphBreak = slice.lastIndexOf("\n\n");
            if (paragraphBreak !== -1) {
                end = lookbackLimit + paragraphBreak + 2;
            } else {
                // 2. Try sentence break
                const sentenceMatches = Array.from(slice.matchAll(/[.!?]\s/g));
                if (sentenceMatches.length > 0) {
                    const lastMatch = sentenceMatches[sentenceMatches.length - 1];
                    end = lookbackLimit + (lastMatch.index ?? 0) + 2;
                } else {
                    // 3. Try word break
                    const spaceIndex = slice.lastIndexOf(" ");
                    if (spaceIndex !== -1) {
                        end = lookbackLimit + spaceIndex + 1;
                    }
                }
            }
        }

        const chunkContent = text.substring(start, end).trim();
        if (chunkContent.length > 0) {
            chunks.push({
                text: chunkContent,
                startChar: start,
                endChar: end,
                chunkIndex
            });
            chunkIndex++;
        }

        if (end >= text.length) break;

        // Advance start by window size minus overlap
        const nextStart = end - chunkOverlap;
        start = nextStart > start ? nextStart : end;
    }

    return chunks;
}
