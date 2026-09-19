import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Layers, BarChart3, Database, Cpu, Activity, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface HeaderProps {
  activeTab: "chat" | "documents" | "eval";
  onTabChange: (tab: "chat" | "documents" | "eval") => void;
  systemStatus: {
    backend: any;
    agent: any;
  };
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, systemStatus }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const backendOnline = Boolean(systemStatus.backend);
  const agentOnline = Boolean(systemStatus.agent);
  const llmProvider = systemStatus.agent?.llm_provider || "mock";
  const dbConnected = systemStatus.backend?.database?.connected;

  const onlineCount = [backendOnline, agentOnline, true, dbConnected].filter(Boolean).length;
  const isFullyOperational = backendOnline && agentOnline;
  const isPartiallyOperational = backendOnline || agentOnline;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header style={{
      borderBottom: "1px solid var(--border-subtle)",
      background: "rgba(9, 13, 22, 0.8)",
      backdropFilter: "blur(16px)",
      position: "sticky",
      top: 0,
      zIndex: 50,
      padding: "14px 24px"
    }}>
      <div style={{
        maxWidth: 1300,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16
      }}>
        {/* Brand & Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: "var(--radius-md)",
            background: "var(--accent-gradient)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 16px rgba(99, 102, 241, 0.4)"
          }}>
            <Cpu size={22} color="#fff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
                Agentic RAG
              </span>
              <span className="badge badge-indigo" style={{ fontSize: 11 }}>v3.0</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Custom HNSW Index &middot; LangGraph Reasoning &middot; Prisma ORM
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: "flex", gap: 6, background: "var(--bg-secondary)", padding: 4, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
          <button
            onClick={() => onTabChange("chat")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              fontWeight: 500,
              color: activeTab === "chat" ? "#fff" : "var(--text-secondary)",
              background: activeTab === "chat" ? "var(--accent-primary)" : "transparent",
              transition: "all var(--transition-fast)"
            }}
          >
            <MessageSquare size={16} />
            Agentic Chat
          </button>
          <button
            onClick={() => onTabChange("documents")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              fontWeight: 500,
              color: activeTab === "documents" ? "#fff" : "var(--text-secondary)",
              background: activeTab === "documents" ? "var(--accent-primary)" : "transparent",
              transition: "all var(--transition-fast)"
            }}
          >
            <Layers size={16} />
            Knowledge Base
          </button>
          <button
            onClick={() => onTabChange("eval")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              fontWeight: 500,
              color: activeTab === "eval" ? "#fff" : "var(--text-secondary)",
              background: activeTab === "eval" ? "var(--accent-primary)" : "transparent",
              transition: "all var(--transition-fast)"
            }}
          >
            <BarChart3 size={16} />
            Eval & Benchmarks
          </button>
        </nav>

        {/* Consolidated System Status Dropdown */}
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            className="status-pill-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            title="Click to view detailed system health"
            aria-expanded={dropdownOpen}
          >
            <span
              className="status-dot-pulse"
              style={{
                backgroundColor: isFullyOperational
                  ? "var(--accent-emerald)"
                  : isPartiallyOperational
                  ? "var(--accent-amber)"
                  : "var(--accent-rose)"
              }}
            />
            <span>
              {isFullyOperational
                ? "System: Operational"
                : isPartiallyOperational
                ? "System: Degraded"
                : "System: Offline"}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 2 }}>
              ({onlineCount}/4)
            </span>
            {dropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Glassmorphic Dropdown Popover */}
          {dropdownOpen && (
            <div className="status-dropdown-menu">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                  <Activity size={14} color="var(--accent-primary)" />
                  System Health & Services
                </span>
                <span className={`badge ${isFullyOperational ? "badge-emerald" : "badge-amber"}`} style={{ fontSize: 10, padding: "2px 6px" }}>
                  {isFullyOperational ? "All Healthy" : "Partial"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* HNSW Vector Backend */}
                <div className="status-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Activity size={14} color={backendOnline ? "#34d399" : "#fbbf24"} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#fff" }}>Custom HNSW Index</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Hybrid Retrieval (:4000)</div>
                    </div>
                  </div>
                  <span className={`badge ${backendOnline ? "badge-emerald" : "badge-amber"}`} style={{ fontSize: 10.5 }}>
                    {backendOnline ? "Online" : "Offline"}
                  </span>
                </div>

                {/* LangGraph Agent */}
                <div className="status-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Cpu size={14} color={agentOnline ? "#34d399" : "#fbbf24"} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#fff" }}>LangGraph Reasoning</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Python State Machine (:8000)</div>
                    </div>
                  </div>
                  <span className={`badge ${agentOnline ? "badge-emerald" : "badge-amber"}`} style={{ fontSize: 10.5 }}>
                    {agentOnline ? "Ready" : "Offline"}
                  </span>
                </div>

                {/* LLM Provider */}
                <div className="status-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Sparkles size={14} color="#22d3ee" />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#fff" }}>LLM Provider</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Active synthesis engine</div>
                    </div>
                  </div>
                  <span className="badge badge-cyan" style={{ fontSize: 10.5 }}>
                    {llmProvider.toUpperCase()}
                  </span>
                </div>

                {/* Database */}
                <div className="status-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Database size={14} color={dbConnected ? "#34d399" : "#818cf8"} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#fff" }}>Database Storage</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Prisma ORM schema</div>
                    </div>
                  </div>
                  <span className={`badge ${dbConnected ? "badge-emerald" : "badge-indigo"}`} style={{ fontSize: 10.5 }}>
                    {dbConnected ? "Postgres" : "Prisma Ready"}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-subtle)", fontSize: 10.5, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                <span>Auto-poll: 8s interval</span>
                <span>Active port: :5173</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
