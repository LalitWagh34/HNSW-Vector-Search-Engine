import React, { useState } from "react";
import { Send, Bot, User, Sparkles, RefreshCw, Layers, ShieldCheck, ChevronDown, ChevronUp, Zap, HelpCircle, RotateCcw, ArrowRight } from "lucide-react";
import { sendAgentQuery, type QueryResponse } from "../api";
import { CitationModal } from "./CitationModal";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  queryResponse?: QueryResponse;
  timestamp: string;
}

const SAMPLE_PROMPTS = [
  {
    topic: "Vector Search",
    question: "How does HNSW achieve sub-millisecond search latency?",
    desc: "Explores greedy upper-layer descent and priority queues"
  },
  {
    topic: "Hybrid Fusion",
    question: "What is the formula and purpose of Reciprocal Rank Fusion (RRF)?",
    desc: "Blends dense semantic vector scores and sparse BM25 ranks"
  },
  {
    topic: "Information Retrieval",
    question: "Why use BM25 alongside dense vector search?",
    desc: "Addresses keyword exact-match failures in dense embeddings"
  },
  {
    topic: "Guardrails & Safety",
    question: "How does the LangGraph self-check node protect against AI hallucinations?",
    desc: "Automated query reformulation and grounded verification"
  }
];

export const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [maxRetries, setMaxRetries] = useState(2);
  const [activeCitation, setActiveCitation] = useState<any | null>(null);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await sendAgentQuery(textToSend, maxRetries);
      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: response.answer,
        queryResponse: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMessage]);
      setExpandedTraceId(assistantMessage.id);
    } catch (err: any) {
      const errorMessage: Message = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: `Error communicating with agent: ${err.message}. Make sure agent-service (port 8000) and backend-api (port 4000) are running.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", gap: 14 }}>
      {/* Suggestions Bar (Visible when conversation is active, wrapped cleanly across lines) */}
      {messages.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "0 4px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", flex: 1 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
              <Sparkles size={13} color="var(--accent-primary)" />
              Suggested:
            </span>
            {SAMPLE_PROMPTS.map((item, i) => (
              <button
                key={i}
                className="badge badge-indigo"
                style={{
                  cursor: "pointer",
                  whiteSpace: "normal",
                  textAlign: "left",
                  padding: "5px 12px",
                  lineHeight: 1.3,
                  border: "1px solid rgba(99, 102, 241, 0.25)"
                }}
                onClick={() => handleSend(item.question)}
                disabled={loading}
                title={item.question}
              >
                {item.question}
              </button>
            ))}
          </div>

          <button
            onClick={handleClear}
            className="btn-secondary"
            style={{ padding: "5px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
            title="Reset conversation and return to welcome hero"
          >
            <RotateCcw size={12} />
            Reset Chat
          </button>
        </div>
      )}

      {/* Messages area or Vertically Centered Empty State Hero */}
      <div className="glass-panel" style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        {messages.length === 0 ? (
          <div className="chat-empty-hero">
            <div className="hero-glow-icon">
              <Bot size={34} color="#ffffff" />
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "#ffffff", marginBottom: 8 }}>
              Agentic RAG Assistant
            </h2>

            <p style={{ maxWidth: 620, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
              Query our persistent knowledge base using custom HNSW vector search, Okapi BM25 sparse retrieval with Reciprocal Rank Fusion, and cyclic LangGraph self-checks.
            </p>

            {/* Architecture Highlights */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 28 }}>
              <span className="badge badge-emerald" style={{ padding: "6px 12px", fontSize: 12 }}>
                <Zap size={13} />
                0.22ms HNSW Vector Search
              </span>
              <span className="badge badge-indigo" style={{ padding: "6px 12px", fontSize: 12 }}>
                <Layers size={13} />
                BM25 + Dense Hybrid RRF
              </span>
              <span className="badge badge-cyan" style={{ padding: "6px 12px", fontSize: 12 }}>
                <ShieldCheck size={13} />
                Zero-Hallucination Self-Check
              </span>
            </div>

            {/* Suggested Starter Prompt Cards Grid */}
            <div style={{ width: "100%", maxWidth: 800, textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <HelpCircle size={14} />
                Select a sample question to start reasoning:
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
                {SAMPLE_PROMPTS.map((item, idx) => (
                  <div
                    key={idx}
                    className="prompt-card"
                    onClick={() => handleSend(item.question)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="badge badge-indigo" style={{ fontSize: 11, padding: "2px 8px" }}>
                        {item.topic}
                      </span>
                      <ArrowRight size={14} color="var(--text-muted)" />
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#ffffff", marginTop: 4 }}>
                      {item.question}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            const qr = msg.queryResponse;
            const isTraceExpanded = expandedTraceId === msg.id;

            return (
              <div key={msg.id} className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                  {!isUser && (
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--radius-full)",
                      background: "var(--accent-gradient)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      <Bot size={18} color="#fff" />
                    </div>
                  )}

                  <div style={{
                    maxWidth: "80%",
                    background: isUser ? "var(--accent-primary)" : "var(--bg-secondary)",
                    color: "#fff",
                    padding: "14px 18px",
                    borderRadius: "var(--radius-lg)",
                    border: isUser ? "none" : "1px solid var(--border-subtle)",
                    boxShadow: "var(--shadow-sm)"
                  }}>
                    <p style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {msg.content}
                    </p>

                    <div style={{ marginTop: 8, fontSize: 11, color: isUser ? "rgba(255, 255, 255, 0.7)" : "var(--text-muted)", display: "flex", justifyContent: "flex-end" }}>
                      {msg.timestamp}
                    </div>
                  </div>

                  {isUser && (
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--radius-full)",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      <User size={18} color="var(--text-secondary)" />
                    </div>
                  )}
                </div>

                {/* LangGraph Reasoning Trace & Citations */}
                {qr && (
                  <div style={{ marginLeft: 44, maxWidth: "80%" }}>
                    <div 
                      style={{
                        background: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        padding: 12
                      }}
                    >
                      {/* Header bar of trace */}
                      <div 
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                        onClick={() => setExpandedTraceId(isTraceExpanded ? null : msg.id)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                            <Layers size={14} color="var(--accent-primary)" />
                            LangGraph Reasoning Flow:
                          </span>

                          {/* Step chips */}
                          {qr.steps.map((step, idx) => (
                            <span 
                              key={idx} 
                              className="badge badge-indigo"
                              style={{ fontSize: 11, padding: "2px 8px" }}
                            >
                              {idx + 1}. {step.split(" ")[0]}
                            </span>
                          ))}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className={`badge ${qr.grounded ? "badge-emerald" : "badge-amber"}`} style={{ fontSize: 11 }}>
                            <ShieldCheck size={12} />
                            {qr.grounded ? "Grounded" : "Ungrounded"}
                          </span>
                          {isTraceExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {/* Collapsible Trace Content */}
                      {isTraceExpanded && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-secondary)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                            <div>
                              <span style={{ color: "var(--text-muted)" }}>Retries: </span>
                              <span style={{ fontWeight: 600, color: "#fff" }}>{qr.retry_count} / {maxRetries}</span>
                            </div>
                            <div>
                              <span style={{ color: "var(--text-muted)" }}>Grounding Check: </span>
                              <span style={{ fontWeight: 600, color: qr.grounded ? "#34d399" : "#fbbf24" }}>
                                {qr.grounding_explanation || "Verified factual alignment"}
                              </span>
                            </div>
                          </div>

                          {/* Citations List */}
                          {qr.documents && qr.documents.length > 0 && (
                            <div>
                              <span style={{ color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                                Retrieved Sources ({qr.documents.length}):
                              </span>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {qr.documents.map((doc, idx) => (
                                  <button
                                    key={idx}
                                    className="badge badge-cyan"
                                    style={{ cursor: "pointer", border: "1px solid rgba(6, 182, 212, 0.4)" }}
                                    onClick={() => setActiveCitation(doc)}
                                    title="Click to view full chunk source text"
                                  >
                                    [{doc.chunkId || `source_${idx + 1}`}]
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {loading && (
          <div className="animate-fade-in" style={{ display: "flex", gap: 12, alignItems: "center", marginLeft: 44 }}>
            <div className="badge badge-indigo" style={{ padding: "8px 14px" }}>
              <RefreshCw size={14} className="spin-animation" style={{ animation: "spin 1s linear infinite" }} />
              Agent reasoning in progress (retrieve &middot; grade &middot; generate &middot; self-check)...
            </div>
          </div>
        )}
      </div>

      {/* Input box & controls */}
      <div className="glass-panel" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Ask a question about the indexed documents..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={loading}
          style={{ flex: 1 }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            Max Retries:
          </label>
          <select 
            value={maxRetries} 
            onChange={(e) => setMaxRetries(Number(e.target.value))}
            style={{ padding: "8px 10px", fontSize: 13 }}
            title="Anti-infinite loop limit for query reformulation and self-check"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>

        <button 
          className="btn-primary" 
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
        >
          <Send size={16} />
          Send
        </button>
      </div>

      {/* Citation Inspector Modal */}
      <CitationModal chunk={activeCitation} onClose={() => setActiveCitation(null)} />
    </div>
  );
};
