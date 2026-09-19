import httpx
from typing import Dict, Any, List
from graph.state import AgentState, ChunkItem, RelevanceGrade
from llm_provider import get_llm_provider
from config import config


def retrieve_node(state: AgentState) -> Dict[str, Any]:
    """
    Calls the Node.js backend-api hybrid retrieval endpoint (/api/retrieve).
    """
    query = state.get("current_query") or state.get("query", "")
    steps = list(state.get("steps", []))
    steps.append(f"retrieve (query: '{query[:40]}...')")

    documents: List[ChunkItem] = []

    try:
        url = f"{config.BACKEND_API_URL}/api/retrieve"
        timeout_config = httpx.Timeout(connect=0.5, read=10.0, write=2.0, pool=0.5)
        with httpx.Client(timeout=timeout_config) as client:
            resp = client.post(
                url,
                json={"query": query, "top_k": 5, "mode": "hybrid"}
            )
            if resp.status_code == 200:
                data = resp.json()
                documents = data.get("results", [])
            else:
                print(f"[RetrieveNode] Backend returned status {resp.status_code}")
    except Exception as e:
        print(f"[RetrieveNode] Notice: Backend retrieval call failed: {e}")
        # If backend is unavailable, provide graceful fallback context
        documents = state.get("documents", [])

    return {
        "documents": documents,
        "steps": steps
    }


def grade_relevance_node(state: AgentState) -> Dict[str, Any]:
    """
    LLM evaluates each retrieved chunk for query relevance.
    """
    query = state.get("current_query") or state.get("query", "")
    documents = state.get("documents", [])
    steps = list(state.get("steps", []))
    steps.append("grade_relevance")

    llm = get_llm_provider()
    grades: List[RelevanceGrade] = []
    relevant_docs: List[ChunkItem] = []

    for doc in documents:
        chunk_text = doc.get("text", "")
        chunk_id = doc.get("chunkId", "")

        evaluation = llm.grade_relevance(query, chunk_text)
        is_relevant = bool(evaluation.get("relevant", False))

        grades.append({
            "chunkId": chunk_id,
            "relevant": is_relevant,
            "reason": evaluation.get("reason", "")
        })

        if is_relevant:
            relevant_docs.append(doc)

    return {
        "relevance_grades": grades,
        "relevant_documents": relevant_docs,
        "steps": steps
    }


def reformulate_query_node(state: AgentState) -> Dict[str, Any]:
    """
    LLM rewrites query to improve retrieval quality when initial search was insufficient.
    """
    query = state.get("query", "")
    retry_count = state.get("retry_count", 0) + 1
    steps = list(state.get("steps", []))
    steps.append(f"reformulate_query (attempt {retry_count})")

    llm = get_llm_provider()
    new_query = llm.reformulate_query(query, retry_count)

    return {
        "current_query": new_query,
        "retry_count": retry_count,
        "steps": steps
    }


def generate_node(state: AgentState) -> Dict[str, Any]:
    """
    Produces grounded response with citations based on filtered relevant documents.
    """
    query = state.get("query", "")
    relevant_docs = state.get("relevant_documents", [])
    steps = list(state.get("steps", []))
    steps.append("generate")

    # If no relevant docs exist and retries exhausted
    if not relevant_docs:
        return {
            "generation": "I am sorry, but the provided documents contain insufficient information to answer your question.",
            "citations": [],
            "grounded": True,
            "steps": steps
        }

    # Format context with chunk references
    context_blocks = []
    citations = []
    for idx, doc in enumerate(relevant_docs, 1):
        doc_id = doc.get("documentId", "doc")
        chunk_id = doc.get("chunkId", f"chunk_{idx}")
        ref = f"[{chunk_id}]"
        citations.append(ref)
        context_blocks.append(f"{ref} Document: {doc_id}\n{doc.get('text', '')}")

    context_str = "\n\n".join(context_blocks)

    system_prompt = (
        "You are an expert Q&A research assistant. Answer the user question strictly using only "
        "the provided context chunks. Cite sources using [chunk_id] notation. If the context does not "
        "contain the answer, state clearly that information is insufficient."
    )

    user_prompt = (
        f"Context:\n{context_str}\n\n"
        f"Question: {query}\n\n"
        "Provide a factual, grounded answer with citations."
    )

    llm = get_llm_provider()
    answer = llm.generate(user_prompt, system_prompt)

    return {
        "generation": answer,
        "citations": citations,
        "steps": steps
    }


def self_check_node(state: AgentState) -> Dict[str, Any]:
    """
    Checks generated answer against retrieved context to prevent hallucinations.
    """
    query = state.get("query", "")
    answer = state.get("generation", "")
    relevant_docs = state.get("relevant_documents", [])
    steps = list(state.get("steps", []))
    steps.append("self_check")

    # If already a fallback answer, grounding is satisfied
    if "insufficient information" in answer.lower():
        return {
            "grounded": True,
            "grounding_explanation": "Fallback response acknowledged lack of info",
            "steps": steps
        }

    context_str = "\n\n".join([d.get("text", "") for d in relevant_docs])

    llm = get_llm_provider()
    check_result = llm.self_check_grounding(query, answer, context_str)

    return {
        "grounded": bool(check_result.get("grounded", True)),
        "grounding_explanation": check_result.get("explanation", ""),
        "steps": steps
    }
