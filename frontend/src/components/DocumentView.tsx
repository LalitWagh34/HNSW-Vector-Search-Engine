import React, { useState, useEffect } from "react";
import { UploadCloud, FileText, CheckCircle2, ChevronRight, Layers, RefreshCw } from "lucide-react";
import { fetchDocuments, fetchDocumentChunks, ingestDocument, type DocumentInfo, type ChunkInfo } from "../api";

const SAMPLE_TEXT = `Hierarchical Navigable Small World (HNSW) graphs are the state of the art for approximate nearest neighbor (ANN) vector search. 
Unlike flat indexes that compute exhaustive distances across all vectors, HNSW arranges data points into hierarchical proximity layers. 
At higher layers, the graph links span large geometric distances with low vertex degree. Search begins at the top layer with greedy hill-climbing descent to rapidly zoom into the neighborhood of the query. 
Once layer 0 is reached, a beam search queue of width efSearch performs fine-grained candidate exploration.

BM25 (Best Matching 25) is a probabilistic sparse retrieval algorithm based on term frequency and inverse document frequency (TF-IDF). 
While dense vector embeddings capture semantic intent and synonyms, BM25 excels at finding exact keyword matches, SKU numbers, product identifiers, and proper nouns.

Reciprocal Rank Fusion (RRF) combines rankings from heterogeneous retrieval engines without needing score calibration. 
Given rank r(d) of document d in model m, the score is sum(1 / (k + r_m(d))), where k=60 is standard.

LangGraph introduces stateful cyclic agent architectures for RAG. 
Instead of a brittle single-pass pipeline, a LangGraph agent evaluates retrieved chunks with a relevance grader. If retrieval is insufficient, a query reformulation node rewrites the query and retries. After generating the candidate answer, a self-check node validates that every claim is grounded in retrieved context, preventing hallucinations while respecting bounded retry limits.`;

export const DocumentView: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<ChunkInfo[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingChunks, setLoadingChunks] = useState(false);

  // Ingest form state
  const [filename, setFilename] = useState("hnsw_rag_primer.txt");
  const [content, setContent] = useState(SAMPLE_TEXT);
  const [chunkSize, setChunkSize] = useState(250);
  const [chunkOverlap, setChunkOverlap] = useState(40);
  const [ingesting, setIngesting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);

  const loadDocs = async () => {
    setLoadingDocs(true);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !selectedDocId) {
        handleSelectDoc(docs[0].id);
      }
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleSelectDoc = async (id: string) => {
    setSelectedDocId(id);
    setLoadingChunks(true);
    try {
      const data = await fetchDocumentChunks(id);
      setChunks(data);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || ingesting) return;

    setIngesting(true);
    setIngestSuccess(null);
    try {
      const res = await ingestDocument({
        text: content,
        filename,
        chunkSize,
        chunkOverlap
      });

      setIngestSuccess(`Successfully ingested "${filename}" into ${res.document?.chunkCount || "multiple"} chunks!`);
      await loadDocs();
      if (res.document?.id) {
        handleSelectDoc(res.document.id);
      }
    } catch (err: any) {
      alert(`Ingestion failed: ${err.message}`);
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 24 }}>
      {/* Left: Ingestion Form */}
      <div className="glass-panel" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <UploadCloud size={22} color="var(--accent-primary)" />
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Ingest New Document</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Chunks text, creates embeddings, and updates HNSW + BM25 indices.
            </p>
          </div>
        </div>

        <form onSubmit={handleIngest} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--text-secondary)" }}>
              Document Filename
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="e.g. system_architecture.txt"
              style={{ width: "100%" }}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)" }}>
                Chunk Size ({chunkSize} chars)
              </label>
              <input
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                min={50}
                max={2000}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)" }}>
                Overlap ({chunkOverlap} chars)
              </label>
              <input
                type="number"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
                min={0}
                max={500}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>Content</label>
              <button
                type="button"
                style={{ fontSize: 12, color: "var(--accent-cyan)", textDecoration: "underline" }}
                onClick={() => setContent(SAMPLE_TEXT)}
              >
                Reset to Sample Corpus
              </button>
            </div>
            <textarea
              rows={9}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste document text here..."
              style={{ width: "100%", resize: "vertical", fontSize: 13, lineHeight: 1.5 }}
              required
            />
          </div>

          {ingestSuccess && (
            <div className="badge badge-emerald" style={{ padding: "8px 12px" }}>
              <CheckCircle2 size={14} />
              {ingestSuccess}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={ingesting}>
            <UploadCloud size={16} />
            {ingesting ? "Embedding & Indexing..." : "Ingest into Vector & BM25 Graph"}
          </button>
        </form>
      </div>

      {/* Right: Documents Catalog & Chunks Preview */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Document List */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={18} color="var(--accent-primary)" />
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Indexed Documents ({documents.length})</h3>
            </div>
            <button className="btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={loadDocs} disabled={loadingDocs}>
              <RefreshCw size={12} style={loadingDocs ? { animation: "spin 1s linear infinite" } : undefined} />
              {loadingDocs ? "Loading..." : "Refresh"}
            </button>
          </div>

          {documents.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No documents indexed yet. Use the form to ingest your first file!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
              {documents.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectDoc(doc.id)}
                    style={{
                      padding: "10px 14px",
                      background: isSelected ? "var(--accent-subtle)" : "var(--bg-secondary)",
                      border: isSelected ? "1px solid var(--accent-primary)" : "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all var(--transition-fast)"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13.5 }}>{doc.filename}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {doc.chunkCount} chunks &middot; {new Date(doc.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <ChevronRight size={16} color={isSelected ? "var(--accent-primary)" : "var(--text-muted)"} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chunks Inspector */}
        <div className="glass-panel" style={{ padding: 20, flex: 1, maxHeight: 380, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Layers size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>
              Chunk Graph View {selectedDocId && `(${chunks.length} chunks)`}
            </h3>
          </div>

          {loadingChunks ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Loading chunks...
            </div>
          ) : chunks.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Select a document above to inspect its chunk boundaries and vectors.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {chunks.map((ch) => (
                <div
                  key={ch.id}
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: 12,
                    fontSize: 12.5
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-primary)", fontWeight: 500 }}>
                      Chunk #{ch.chunkIndex + 1} ({ch.id})
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Chars {ch.startChar} - {ch.endChar}
                    </span>
                  </div>
                  <p style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {ch.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
