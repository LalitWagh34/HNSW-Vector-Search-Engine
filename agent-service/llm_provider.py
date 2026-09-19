import json
import re
from abc import ABC, abstractmethod
from typing import Dict, Any
from config import config


class BaseLLMProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str, system_instruction: str = "") -> str:
        """Generate general text response"""
        pass

    @abstractmethod
    def grade_relevance(self, query: str, doc_text: str) -> Dict[str, Any]:
        """Judge whether a document chunk contains information relevant to the query"""
        pass

    @abstractmethod
    def reformulate_query(self, query: str, attempt: int) -> str:
        """Rewrite a query that yielded insufficient retrieval results"""
        pass

    @abstractmethod
    def self_check_grounding(self, query: str, answer: str, context: str) -> Dict[str, Any]:
        """Verify whether an answer is strictly grounded in the retrieved context"""
        pass


class GroqProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile"):
        from groq import Groq
        self.client = Groq(api_key=api_key)
        self.model = model

    def generate(self, prompt: str, system_instruction: str = "") -> str:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.2,
            max_tokens=1024
        )
        return response.choices[0].message.content.strip()

    def grade_relevance(self, query: str, doc_text: str) -> Dict[str, Any]:
        prompt = (
            f"Query: {query}\n\n"
            f"Document snippet:\n{doc_text}\n\n"
            "Does this document contain information relevant to answering the query? "
            "Respond ONLY with a JSON object in this format: {\"relevant\": true/false, \"reason\": \"brief explanation\"}"
        )
        resp = self.generate(prompt, "You are a precise document relevance grader. Return only JSON.")
        return _extract_json(resp, fallback={"relevant": True, "reason": "Defaulted by grader"})

    def reformulate_query(self, query: str, attempt: int) -> str:
        prompt = (
            f"Original user query: '{query}'\n\n"
            f"This is search attempt #{attempt + 1}. The previous retrieval did not return sufficient documents.\n"
            "Reformulate the query into a more targeted, clear search query using different keywords or simpler concepts.\n"
            "Respond with ONLY the reformulated query string, nothing else."
        )
        return self.generate(prompt, "You are a search query reformulation expert. Return only the new query text.")

    def self_check_grounding(self, query: str, answer: str, context: str) -> Dict[str, Any]:
        prompt = (
            f"Query: {query}\n\n"
            f"Retrieved Context:\n{context}\n\n"
            f"Proposed Answer:\n{answer}\n\n"
            "Is every factual claim in the proposed answer strictly supported by the retrieved context? "
            "Respond ONLY with a JSON object in this format: {\"grounded\": true/false, \"explanation\": \"reason\"}"
        )
        resp = self.generate(prompt, "You are a strict factual hallucination checker. Return only JSON.")
        return _extract_json(resp, fallback={"grounded": True, "explanation": "Defaulted check"})


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str = "gemini-3.6-flash"):
        from google import genai
        self.client = genai.Client(api_key=api_key)
        self.model = model

    def generate(self, prompt: str, system_instruction: str = "") -> str:
        full_content = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
        response = self.client.models.generate_content(
            model=self.model,
            contents=full_content
        )
        return response.text.strip()

    def grade_relevance(self, query: str, doc_text: str) -> Dict[str, Any]:
        prompt = (
            f"Query: {query}\n\n"
            f"Document snippet:\n{doc_text}\n\n"
            "Does this document contain information relevant to answering the query? "
            "Respond ONLY with a JSON object in this format: {\"relevant\": true/false, \"reason\": \"brief explanation\"}"
        )
        resp = self.generate(prompt, "You are a precise document relevance grader. Return only JSON.")
        return _extract_json(resp, fallback={"relevant": True, "reason": "Defaulted by grader"})

    def reformulate_query(self, query: str, attempt: int) -> str:
        prompt = (
            f"Original user query: '{query}'\n\n"
            f"Search attempt #{attempt + 1} yielded insufficient documents.\n"
            "Rewrite this query into a clearer keyword-oriented query.\n"
            "Output ONLY the new query string."
        )
        return self.generate(prompt, "You are a query optimizer. Output only the reformulated query.")

    def self_check_grounding(self, query: str, answer: str, context: str) -> Dict[str, Any]:
        prompt = (
            f"Query: {query}\n\n"
            f"Retrieved Context:\n{context}\n\n"
            f"Proposed Answer:\n{answer}\n\n"
            "Is the proposed answer strictly grounded in the context without hallucination? "
            "Respond ONLY with JSON: {\"grounded\": true/false, \"explanation\": \"...\"}"
        )
        resp = self.generate(prompt, "You are a strict hallucination auditor. Output only JSON.")
        return _extract_json(resp, fallback={"grounded": True, "explanation": "Defaulted check"})


class MockProvider(BaseLLMProvider):
    """
    Deterministic offline provider for testing and zero-key local operation.
    """
    def generate(self, prompt: str, system_instruction: str = "") -> str:
        return (
            "Based on the retrieved context, the system provides approximate nearest-neighbor "
            "search using a custom HNSW graph and BM25 hybrid ranking."
        )

    def grade_relevance(self, query: str, doc_text: str) -> Dict[str, Any]:
        query_words = set(re.findall(r"\w+", query.lower()))
        doc_words = set(re.findall(r"\w+", doc_text.lower()))
        overlap = query_words.intersection(doc_words)

        is_relevant = len(overlap) > 0 or len(doc_text.strip()) > 30
        return {
            "relevant": is_relevant,
            "reason": f"Matched {len(overlap)} terms in context" if is_relevant else "No term overlap"
        }

    def reformulate_query(self, query: str, attempt: int) -> str:
        words = query.split()
        if len(words) > 3:
            return " ".join(words[:4]) + " overview"
        return f"{query} details"

    def self_check_grounding(self, query: str, answer: str, context: str) -> Dict[str, Any]:
        # Out of domain check
        if "quantum" in query.lower() and "quantum" not in context.lower():
            return {
                "grounded": False,
                "explanation": "Context does not mention quantum concepts."
            }
        return {
            "grounded": True,
            "explanation": "Answer facts appear aligned with retrieved context."
        }


def _extract_json(text: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # Match JSON block if enclosed in markdown backticks
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1)
        return json.loads(text.strip())
    except Exception:
        # Simple regex heuristics for boolean
        if "true" in text.lower():
            return {"relevant": True, "grounded": True, "reason": "Parsed from response"}
        if "false" in text.lower():
            return {"relevant": False, "grounded": False, "reason": "Parsed from response"}
        return fallback


_provider_instance: BaseLLMProvider = None


def get_llm_provider() -> BaseLLMProvider:
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    provider_name = config.get_provider_name()
    if provider_name == "groq" and config.GROQ_API_KEY:
        print(f"[LLMProvider] Initializing Groq Provider (model: {config.GROQ_MODEL})")
        _provider_instance = GroqProvider(config.GROQ_API_KEY, config.GROQ_MODEL)
    elif provider_name == "gemini" and config.GEMINI_API_KEY:
        print(f"[LLMProvider] Initializing Gemini Provider (model: {config.GEMINI_MODEL})")
        _provider_instance = GeminiProvider(config.GEMINI_API_KEY, config.GEMINI_MODEL)
    else:
        print("[LLMProvider] Initializing Mock/Offline Provider (zero-key mode)")
        _provider_instance = MockProvider()

    return _provider_instance
