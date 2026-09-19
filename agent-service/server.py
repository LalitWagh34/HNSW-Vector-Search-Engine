import json
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from config import config
from graph.workflow import agent_graph
from graph.state import AgentState


app = FastAPI(
    title="Agentic RAG LangGraph Service",
    description="Agentic reasoning layer featuring bounded query reformulation and grounding self-checks.",
    version="1.0.0"
)

# Enable CORS for frontend and microservice access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User search query")
    max_retries: Optional[int] = Field(default=None, ge=0, le=5, description="Maximum retry limit")


class QueryResponse(BaseModel):
    query: str
    answer: str
    citations: List[str]
    grounded: bool
    grounding_explanation: str
    retry_count: int
    steps: List[str]
    documents: List[Dict[str, Any]]


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "agent-service",
        "llm_provider": config.get_provider_name(),
        "backend_url": config.BACKEND_API_URL,
        "max_retries": config.MAX_RETRIES
    }


@app.post("/query", response_model=QueryResponse)
def handle_query(request: QueryRequest):
    try:
        initial_state: AgentState = {
            "query": request.query,
            "current_query": request.query,
            "max_retries": request.max_retries if request.max_retries is not None else config.MAX_RETRIES,
            "retry_count": 0,
            "steps": [],
            "documents": [],
            "relevant_documents": [],
            "relevance_grades": [],
            "generation": "",
            "citations": [],
            "grounded": True,
            "grounding_explanation": ""
        }

        final_state = agent_graph.invoke(initial_state)

        return QueryResponse(
            query=request.query,
            answer=final_state.get("generation", ""),
            citations=final_state.get("citations", []),
            grounded=final_state.get("grounded", True),
            grounding_explanation=final_state.get("grounding_explanation", ""),
            retry_count=final_state.get("retry_count", 0),
            steps=final_state.get("steps", []),
            documents=final_state.get("relevant_documents", []) or final_state.get("documents", [])
        )
    except Exception as e:
        print(f"[QueryHandler Error]: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/stream")
async def stream_query(request: QueryRequest):
    """
    Server-Sent Events (SSE) streaming node-by-node execution state.
    """
    initial_state: AgentState = {
        "query": request.query,
        "current_query": request.query,
        "max_retries": request.max_retries if request.max_retries is not None else config.MAX_RETRIES,
        "retry_count": 0,
        "steps": [],
        "documents": [],
        "relevant_documents": [],
        "relevance_grades": [],
        "generation": "",
        "citations": [],
        "grounded": True,
        "grounding_explanation": ""
    }

    async def event_generator():
        try:
            for event in agent_graph.stream(initial_state):
                for node_name, node_output in event.items():
                    data = {
                        "node": node_name,
                        "steps": node_output.get("steps", []),
                        "current_query": node_output.get("current_query", ""),
                        "generation": node_output.get("generation", ""),
                        "grounded": node_output.get("grounded", True)
                    }
                    yield f"data: {json.dumps(data)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as err:
            yield f"data: {json.dumps({'error': str(err)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=config.PORT, reload=False)
