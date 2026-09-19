from langgraph.graph import StateGraph, START, END
from graph.state import AgentState
from graph.nodes import (
    retrieve_node,
    grade_relevance_node,
    reformulate_query_node,
    generate_node,
    self_check_node
)
from graph.edges import (
    decide_to_generate_or_reformulate,
    decide_grounding_or_retry
)


def create_agent_graph():
    """
    Constructs and compiles the LangGraph Agentic RAG workflow.
    """
    workflow = StateGraph(AgentState)

    # 1. Add nodes
    workflow.add_node("retrieve", retrieve_node)
    workflow.add_node("grade_relevance", grade_relevance_node)
    workflow.add_node("reformulate_query", reformulate_query_node)
    workflow.add_node("generate", generate_node)
    workflow.add_node("self_check", self_check_node)

    # 2. Add fixed edges
    workflow.add_edge(START, "retrieve")
    workflow.add_edge("retrieve", "grade_relevance")
    workflow.add_edge("reformulate_query", "retrieve")
    workflow.add_edge("generate", "self_check")

    # 3. Add conditional routing edges
    workflow.add_conditional_edges(
        "grade_relevance",
        decide_to_generate_or_reformulate,
        {
            "generate": "generate",
            "reformulate_query": "reformulate_query"
        }
    )

    workflow.add_conditional_edges(
        "self_check",
        decide_grounding_or_retry,
        {
            "end": END,
            "reformulate_query": "reformulate_query"
        }
    )

    return workflow.compile()


# Precompiled singleton graph runnable
agent_graph = create_agent_graph()
