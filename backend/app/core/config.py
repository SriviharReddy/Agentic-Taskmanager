from typing import List, Optional
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from langchain_google_genai import ChatGoogleGenerativeAI

class Settings(BaseSettings):
    PROJECT_NAME: str = "Agentic Task Manager"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Gemini / AI Config
    GOOGLE_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.7-flash"
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./tasks.db"
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"]
    
    # Timezone & Defaults
    DEFAULT_TIMEZONE: str = "UTC"
    
    @property
    def effective_api_key(self) -> str:
        return self.GOOGLE_API_KEY or os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY") or ""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

def get_chat_model(temperature: float = 0.2, model: Optional[str] = None) -> ChatGoogleGenerativeAI:
    """Factory for initializing ChatGoogleGenerativeAI with robust key fallback."""
    api_key = settings.effective_api_key or "unconfigured_key"
    return ChatGoogleGenerativeAI(
        model=model or settings.GEMINI_MODEL,
        temperature=temperature,
        api_key=api_key
    )
