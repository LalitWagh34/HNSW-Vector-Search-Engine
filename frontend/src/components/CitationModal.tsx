import React from "react";
import { X, Bookmark, CheckCircle2 } from "lucide-react";

interface CitationModalProps {
  chunk: {
    chunkId: string;
    documentId: string;
    text: string;
    score?: number;
    source?: string;
  } | null;
  onClose: () => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({ chunk, onClose }) => {
  if (!chunk) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.7)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100,
      padding: 16
    }}
    onClick={onClose}
    >
      <div 
        className="glass-panel animate-fade-in"
        style={{
          width: "100%",
          maxWidth: 600,
          maxHeight: "85vh",
          overflowY: "auto",
          padding: 24,
          background: "var(--bg-secondary)",
          boxShadow: "var(--shadow-lg)"
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bookmark size={20} color="var(--accent-primary)" />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Citation Source</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                ID: {chunk.chunkId}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ color: "var(--text-secondary)", padding: 4, borderRadius: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span className="badge badge-indigo">Doc: {chunk.documentId || "Unknown"}</span>
          {chunk.score !== undefined && (
            <span className="badge badge-emerald">
              Relevance: {(chunk.score * 100).toFixed(1)}%
            </span>
          )}
          {chunk.source && (
            <span className="badge badge-cyan">Engine: {chunk.source}</span>
          )}
          <span className="badge badge-emerald">
            <CheckCircle2 size={12} /> Grounded
          </span>
        </div>

        <div style={{
          background: "var(--bg-primary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          padding: 16,
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--text-primary)",
          whiteSpace: "pre-wrap",
          fontFamily: "var(--font-sans)"
        }}>
          {chunk.text}
        </div>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onClose}>
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
