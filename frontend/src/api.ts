export const BACKEND_URL = "http://localhost:4000";
export const AGENT_URL = "http://localhost:8000";

export interface DocumentInfo {
  id: string;
  filename: string;
  chunkCount: number;
  createdAt: string;
  preview?: string;
}

export interface ChunkInfo {
  id: string;
  chunkIndex: number;
  text: string;
  startChar: number;
  endChar: number;
}

export interface QueryResponse {
  query: string;
  answer: string;
  citations: string[];
  grounded: boolean;
  grounding_explanation: string;
  retry_count: number;
  steps: string[];
  documents: Array<{
    chunkId: string;
    documentId: string;
    text: string;
    score: number;
    source: string;
  }>;
}

export async function fetchHealth() {
  try {
    const [backendRes, agentRes] = await Promise.allSettled([
      fetch(`${BACKEND_URL}/health`).then(r => r.json()),
      fetch(`${AGENT_URL}/health`).then(r => r.json())
    ]);

    return {
      backend: backendRes.status === "fulfilled" ? backendRes.value : null,
      agent: agentRes.status === "fulfilled" ? agentRes.value : null
    };
  } catch {
    return { backend: null, agent: null };
  }
}

export async function fetchDocuments(): Promise<DocumentInfo[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/documents`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export async function fetchDocumentChunks(id: string): Promise<ChunkInfo[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/documents/${id}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.chunks || [];
  } catch {
    return [];
  }
}

export async function ingestDocument(params: {
  text: string;
  filename?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}) {
  const res = await fetch(`${BACKEND_URL}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Ingestion failed");
  }

  return res.json();
}

export async function sendAgentQuery(query: string, maxRetries: number = 2): Promise<QueryResponse> {
  const res = await fetch(`${AGENT_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_retries: maxRetries })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Agent query failed");
  }

  return res.json();
}
