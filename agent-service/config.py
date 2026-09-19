import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from agent-service root
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)


class Config:
    PORT: int = int(os.getenv("PORT", "8000"))
    BACKEND_API_URL: str = os.getenv("BACKEND_API_URL", "http://localhost:4000")
    MAX_RETRIES: int = int(os.getenv("MAX_RETRIES", "2"))

    # Groq Configuration
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    # Gemini Configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

    # Determine Provider: user override or auto-detect
    _user_provider: str = os.getenv("LLM_PROVIDER", "").lower()

    @classmethod
    def get_provider_name(cls) -> str:
        if cls._user_provider in ("groq", "gemini", "mock"):
            # Check if required key exists for chosen provider
            if cls._user_provider == "groq" and not cls.GROQ_API_KEY:
                print("[Config] Warning: GROQ_API_KEY not set. Falling back to mock provider.")
                return "mock"
            if cls._user_provider == "gemini" and not cls.GEMINI_API_KEY:
                print("[Config] Warning: GEMINI_API_KEY not set. Falling back to mock provider.")
                return "mock"
            return cls._user_provider

        # Auto-detect based on available keys
        if cls.GROQ_API_KEY:
            return "groq"
        if cls.GEMINI_API_KEY:
            return "gemini"
        return "mock"


config = Config()
