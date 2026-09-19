from typing import List, Dict, Any, Optional
from typing_extensions import TypedDict


class ChunkItem(TypedDict, total=False):
    chunkId: str
    documentId: str
    text: str
    score: float
    source: str


class RelevanceGrade(TypedDict, total=False):
    chunkId: str
    relevant: bool
    reason: str


class AgentState(TypedDict, total=False):
    """
    State object passed between LangGraph nodes.
    """
    # Original user query
    query: str

    # Currently active search query (may be rewritten by reformulate_node)
    current_query: str

    # Top-K candidate chunks retrieved from the hybrid retrieval service
    documents: List[ChunkItem]

    # Relevance assessment for each retrieved chunk
    relevance_grades: List[RelevanceGrade]

    # Filtered documents that passed the relevance grading
    relevant_documents: List[ChunkItem]

    # Generated answer candidate
    generation: str

    # Result of grounding / hallucination self-check
    grounded: bool
    grounding_explanation: str

    # Citations/sources used in the final response
    citations: List[str]

    # Retry counter to prevent infinite loops (must satisfy retry_count <= max_retries)
    retry_count: int
    max_retries: int

    # Execution audit trace recording the path through the graph
    steps: List[str]
