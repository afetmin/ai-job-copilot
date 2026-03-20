"""Embedding provider 工厂。"""

from __future__ import annotations

from langchain_core.embeddings import Embeddings
from langchain_openai import OpenAIEmbeddings
from pydantic import SecretStr

from ai_job_copilot_backend.core.settings import Settings


def create_embedding_function(settings: Settings) -> Embeddings:
    """按环境变量指定的 provider 创建 embedding 实例。"""

    provider_name = settings.embedding_provider.strip().lower()
    if not provider_name:
        raise ValueError("embedding_provider 不能为空，必须显式指定 openai 或 dashscope")

    if not settings.embedding_model.strip():
        raise ValueError("embedding_model 不能为空")

    if provider_name == "openai":
        if not settings.openai_api_key.strip():
            raise ValueError("使用 openai provider 时必须设置 openai_api_key")
        return OpenAIEmbeddings(
            api_key=SecretStr(settings.openai_api_key),
            base_url=settings.openai_base_url,
            model=settings.embedding_model,
            check_embedding_ctx_length=False,
        )

    if provider_name == "dashscope":
        if not settings.dashscope_api_key.strip():
            raise ValueError("使用 dashscope provider 时必须设置 dashscope_api_key")

        from langchain_community.embeddings import DashScopeEmbeddings

        return DashScopeEmbeddings(
            dashscope_api_key=settings.dashscope_api_key,
            model=settings.embedding_model,
        )

    raise ValueError(f"不支持的 embedding_provider={settings.embedding_provider}")
