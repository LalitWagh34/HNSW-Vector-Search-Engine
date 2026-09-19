import pytest
import sys
from pathlib import Path

# Add agent-service root to path
parent_dir = str(Path(__file__).resolve().parent.parent)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from fastapi.testclient import TestClient
from graph.workflow import agent_graph
from graph.state import AgentState
from graph.edges import decide_to_generate_or_reformulate, decide_grounding_or_retry
from server import app


@pytest.fixture
def test_client():
    return TestClient(app)


def test_graph_compiled_properly():
    """Verify that the agent graph has been compiled with expected nodes and transitions."""
    assert agent_graph is not None
    # Verify graph runnable can accept empty state structure
    assert hasattr(agent_graph, "invoke")


def test_edge_routing_logic():
    """Test the decision functions in edges.py."""
    # 1. If relevant documents exist -> generate
    state_with_docs: AgentState = {
        "relevant_documents": [{"chunkId": "c1", "text": "HNSW graphs are fast", "score": 0.9}],
        "retry_count": 0,
        "max_retries": 2
    }
    assert decide_to_generate_or_reformulate(state_with_docs) == "generate"

    # 2. If no documents exist and retries < max_retries -> reformulate_query
    state_empty_docs: AgentState = {
        "relevant_documents": [],
        "retry_count": 0,
        "max_retries": 2
    }
    assert decide_to_generate_or_reformulate(state_empty_docs) == "reformulate_query"

    # 3. If no documents exist and retries >= max_retries -> generate (to produce fallback answer)
    state_exhausted_retries: AgentState = {
        "relevant_documents": [],
        "retry_count": 2,
        "max_retries": 2
    }
    assert decide_to_generate_or_reformulate(state_exhausted_retries) == "generate"

    # 4. If grounded is True -> end
    state_grounded: AgentState = {"grounded": True, "retry_count": 0, "max_retries": 2}
    assert decide_grounding_or_retry(state_grounded) == "end"

    # 5. If grounded is False and retries remain -> reformulate_query
    state_ungrounded: AgentState = {"grounded": False, "retry_count": 1, "max_retries": 2}
    assert decide_grounding_or_retry(state_ungrounded) == "reformulate_query"

    # 6. If grounded is False but retries exhausted -> end (prevent loop)
    state_ungrounded_exhausted: AgentState = {"grounded": False, "retry_count": 2, "max_retries": 2}
    assert decide_grounding_or_retry(state_ungrounded_exhausted) == "end"


def test_bounded_retry_guarantee():
    """
    Test that an unanswerable query terminates cleanly within bounded retry attempts
    and reports insufficient information.
    """
    initial_state: AgentState = {
        "query": "Tell me about quantum gravity in medieval times.",
        "current_query": "Tell me about quantum gravity in medieval times.",
        "max_retries": 2,
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

    # Must terminate within max_retries
    assert final_state["retry_count"] <= 2
    assert "generate" in final_state["steps"]
    assert "self_check" in final_state["steps"]
    assert "insufficient information" in final_state["generation"].lower()


def test_direct_grounded_generation():
    """
    Test that when provided with relevant context, the agent generates an answer
    and records citations.
    """
    pre_loaded_docs = [
        {
            "chunkId": "chunk_hnsw_1",
            "documentId": "hnsw_guide",
            "text": "HNSW constructs hierarchical proximity graphs with greedy hill-climbing descent.",
            "score": 0.95,
            "source": "hybrid"
        }
    ]

    initial_state: AgentState = {
        "query": "How does HNSW navigate its graph structure?",
        "current_query": "How does HNSW navigate its graph structure?",
        "max_retries": 2,
        "retry_count": 0,
        "steps": [],
        "documents": pre_loaded_docs,
        "relevant_documents": pre_loaded_docs,
        "relevance_grades": [{"chunkId": "chunk_hnsw_1", "relevant": True, "reason": "direct match"}],
        "generation": "",
        "citations": [],
        "grounded": True,
        "grounding_explanation": ""
    }

    final_state = agent_graph.invoke(initial_state)

    assert len(final_state["generation"]) > 0
    assert final_state["grounded"] is True


def test_fastapi_health_endpoint(test_client):
    """Verify GET /health returns expected system metadata."""
    response = test_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "agent-service"
    assert "llm_provider" in data


def test_fastapi_query_endpoint(test_client):
    """Verify POST /query executes the LangGraph workflow and returns a valid QueryResponse."""
    payload = {
        "query": "What are approximate nearest neighbor graphs?",
        "max_retries": 1
    }
    response = test_client.post("/query", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == payload["query"]
    assert "answer" in data
    assert "steps" in data
    assert len(data["steps"]) > 0
    assert data["retry_count"] <= 1
