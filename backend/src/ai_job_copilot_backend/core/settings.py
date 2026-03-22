"""从环境变量加载应用配置。"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """后端应用运行时配置。"""

    app_name: str = "AI Job Copilot API"
    service_name: str = "ai-job-copilot-api"
    environment: str = "development"
    embedding_provider: Literal["openai", "dashscope"] | str = ""
    embedding_model: str = ""
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    dashscope_api_key: str = ""
    llm_protocol: Literal["openai_compatible", "anthropic_compatible"] | str = ""
    llm_model: str = ""
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_temperature: float = 0.2
    chroma_persist_directory: str = "./data/chroma_db"
    chroma_collection_name: str = "documents"
    retrieval_chunk_size: int = 1000
    retrieval_chunk_overlap: int = 200
    interview_retrieval_limit: int = 4

    model_config = SettingsConfigDict(
        env_prefix="AI_JOB_COPILOT_",
        env_file=".env",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """返回当前进程复用的配置实例。"""

    return Settings()
