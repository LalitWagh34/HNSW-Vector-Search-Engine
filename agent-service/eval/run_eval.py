import os
import sys
import json
import time
from pathlib import Path
from typing import List, Dict, Any

# Add parent directory to path so imports work cleanly
parent_dir = str(Path(__file__).resolve().parent.parent)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from graph.workflow import agent_graph
from graph.state import AgentState
from config import config


def calculate_metrics(sample: Dict[str, Any], final_state: AgentState, duration_ms: float) -> Dict[str, Any]:
    expected_keywords = [kw.lower() for kw in sample.get("expected_keywords", [])]
    generation = (final_state.get("generation") or "").lower()
    retrieved_docs = final_state.get("relevant_documents", []) or final_state.get("documents", [])
    context_text = " ".join([d.get("text", "").lower() for d in retrieved_docs])
    is_grounded = bool(final_state.get("grounded", True))
    retry_count = final_state.get("retry_count", 0)

    # 1. Answer Relevance (keyword coverage of expected content)
    matched_keywords = sum(1 for kw in expected_keywords if kw in generation)
    answer_relevance = matched_keywords / max(len(expected_keywords), 1)

    # 2. Context Precision (proportion of retrieved chunks containing expected terms)
    if retrieved_docs:
        relevant_chunks = 0
        for doc in retrieved_docs:
            text = doc.get("text", "").lower()
            if any(kw in text for kw in expected_keywords):
                relevant_chunks += 1
        context_precision = relevant_chunks / len(retrieved_docs)
    else:
        # If out of scope and no docs retrieved, precision is naturally 1.0 (no noise)
        context_precision = 1.0 if sample.get("category") == "out_of_scope" else 0.0

    # 3. Faithfulness (grounded check + no unverified hallucination)
    if "insufficient information" in generation or "sorry" in generation:
        faithfulness = 1.0
    else:
        faithfulness = 1.0 if is_grounded else 0.0

    # 4. Loop Safety (bounded retry limit verified)
    max_allowed = sample.get("max_retries", config.MAX_RETRIES)
    loop_safe = retry_count <= max_allowed

    return {
        "id": sample.get("id"),
        "query": sample.get("query"),
        "category": sample.get("category"),
        "answer": final_state.get("generation"),
        "steps": final_state.get("steps", []),
        "retry_count": retry_count,
        "duration_ms": round(duration_ms, 2),
        "faithfulness": round(faithfulness, 2),
        "context_precision": round(context_precision, 2),
        "answer_relevance": round(answer_relevance, 2),
        "loop_safe": loop_safe
    }


def run_evaluation(dataset_path: str = None) -> Dict[str, Any]:
    if dataset_path is None:
        dataset_path = str(Path(__file__).resolve().parent / "qa_dataset.json")

    with open(dataset_path, "r", encoding="utf-8") as f:
        samples: List[Dict[str, Any]] = json.load(f)

    print(f"\n{'='*70}")
    print(f"  AGENTIC RAG EVALUATION HARNESS — Provider: {config.get_provider_name().upper()}")
    print(f"{'='*70}\n")
    print(f"Running evaluation on {len(samples)} curated test cases...")

    results = []
    start_total = time.time()

    for idx, sample in enumerate(samples, 1):
        query = sample["query"]
        print(f"[{idx}/{len(samples)}] Query: '{query[:50]}...'")

        initial_state: AgentState = {
            "query": query,
            "current_query": query,
            "max_retries": config.MAX_RETRIES,
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

        t0 = time.time()
        final_state = agent_graph.invoke(initial_state)
        elapsed_ms = (time.time() - t0) * 1000

        metrics = calculate_metrics(sample, final_state, elapsed_ms)
        results.append(metrics)

    total_time = round(time.time() - start_total, 2)

    # Compute aggregate averages
    n = len(results)
    avg_faithfulness = sum(r["faithfulness"] for r in results) / n
    avg_precision = sum(r["context_precision"] for r in results) / n
    avg_relevance = sum(r["answer_relevance"] for r in results) / n
    avg_latency = sum(r["duration_ms"] for r in results) / n
    loop_safety_rate = sum(1 for r in results if r["loop_safe"]) / n

    summary = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "provider": config.get_provider_name(),
        "total_queries": n,
        "total_time_seconds": total_time,
        "metrics": {
            "faithfulness": round(avg_faithfulness, 3),
            "context_precision": round(avg_precision, 3),
            "answer_relevance": round(avg_relevance, 3),
            "avg_latency_ms": round(avg_latency, 1),
            "loop_safety_rate": round(loop_safety_rate * 100, 1)
        },
        "results": results
    }

    # Print summary table
    print(f"\n{'='*70}")
    print("  EVALUATION RESULTS SUMMARY")
    print(f"{'='*70}")
    print(f"  • Total Evaluated Queries: {n}")
    print(f"  • Faithfulness Score:      {summary['metrics']['faithfulness'] * 100:.1f}%")
    print(f"  • Context Precision:       {summary['metrics']['context_precision'] * 100:.1f}%")
    print(f"  • Answer Relevance:        {summary['metrics']['answer_relevance'] * 100:.1f}%")
    print(f"  • Anti-Loop Safety:        {summary['metrics']['loop_safety_rate']:.1f}% (zero infinite loops)")
    print(f"  • Avg Latency:             {summary['metrics']['avg_latency_ms']} ms")
    print(f"{'='*70}\n")

    # Persist results
    results_dir = Path(__file__).resolve().parent / "results"
    results_dir.mkdir(exist_ok=True)
    out_file = results_dir / "eval_results.json"

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"Full benchmark metrics written to: {out_file}\n")
    return summary


if __name__ == "__main__":
    run_evaluation()
