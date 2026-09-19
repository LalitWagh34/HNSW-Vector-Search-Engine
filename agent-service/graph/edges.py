from typing import Literal
from graph.state import AgentState
from config import config


def decide_to_generate_or_reformulate(state: AgentState) -> Literal["generate", "reformulate_query"]:
    """
    Evaluates relevance grade results:
    - If any documents are relevant: proceed to 'generate'.
    - If no documents are relevant and retries are within limits: 'reformulate_query'.
    - If retries are exhausted: proceed to 'generate' to trigger graceful fallback answer.
    """
    relevant_docs = state.get("relevant_documents", [])
    retry_count = state.get("retry_count", 0)
    max_retries = state.get("max_retries", config.MAX_RETRIES)

    if len(relevant_docs) > 0:
        return "generate"

    if retry_count < max_retries:
        return "reformulate_query"

    return "generate"


def decide_grounding_or_retry(state: AgentState) -> Literal["end", "reformulate_query"]:
    """
    Evaluates self-check grounding validation:
    - If grounded: terminate successfully.
    - If ungrounded (hallucination detected) and retries remain: loop back to 'reformulate_query'.
    - If retries exhausted: terminate to avoid infinite loops.
    """
    is_grounded = state.get("grounded", True)
    retry_count = state.get("retry_count", 0)
    max_retries = state.get("max_retries", config.MAX_RETRIES)

    if is_grounded:
        return "end"

    if retry_count < max_retries:
        return "reformulate_query"

    return "end"
