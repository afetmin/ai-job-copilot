"""面试包生成所需的大语言模型 provider。"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, cast

from openai import AsyncOpenAI

from ai_job_copilot_backend.core.settings import Settings
from ai_job_copilot_backend.providers.base import GenerationProvider

DEFAULT_DASHSCOPE_RESPONSES_BASE_URL = (
    "https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1"
)


class OpenAIResponsesGenerationProvider(GenerationProvider[str, str]):
    """基于 OpenAI Responses API 的纯文本生成 provider。"""

    def __init__(
        self,
        *,
        provider_name: str,
        model: str,
        api_key: str,
        base_url: str,
        temperature: float = 0.2,
    ) -> None:
        self.provider_name = provider_name
        self._model = model
        self._temperature = temperature
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
        )

    async def generate(self, payload: str) -> str:
        """根据 prompt 生成纯文本结果。"""

        response = await self._client.responses.create(
            model=self._model,
            temperature=self._temperature,
            input=cast(Any, self._build_input(payload)),
        )
        return self._extract_output_text(response)

    async def stream_generate(self, payload: str) -> AsyncIterator[str]:
        """根据 prompt 流式返回纯文本结果。"""

        stream = await self._client.responses.create(
            model=self._model,
            temperature=self._temperature,
            input=cast(Any, self._build_input(payload)),
            stream=True,
        )
        async for event in cast(AsyncIterator[Any], stream):
            if getattr(event, "type", None) != "response.output_text.delta":
                continue
            delta = getattr(event, "delta", None)
            if isinstance(delta, str) and delta:
                yield delta

    @staticmethod
    def _build_input(payload: str) -> list[dict[str, str]]:
        return [
            {
                "role": "developer",
                "content": "你是一个结构化输出助手，只返回合法 JSON，不要输出额外说明。",
            },
            {"role": "user", "content": payload},
        ]

    @staticmethod
    def _extract_output_text(response: Any) -> str:
        """优先使用 SDK 暴露的 output_text，缺失时再回退解析 output。"""

        output_text = getattr(response, "output_text", None)
        if isinstance(output_text, str) and output_text.strip():
            return output_text

        output_items = getattr(response, "output", None)
        if isinstance(output_items, list):
            parts: list[str] = []
            for item in output_items:
                if getattr(item, "type", None) != "message":
                    continue
                content_items = getattr(item, "content", None)
                if not isinstance(content_items, list):
                    continue
                for content_item in content_items:
                    if getattr(content_item, "type", None) != "output_text":
                        continue
                    text = getattr(content_item, "text", None)
                    if isinstance(text, str) and text.strip():
                        parts.append(text)
            if parts:
                return "\n".join(parts)

        raise ValueError("模型未返回可用内容")


def create_generation_provider(settings: Settings) -> GenerationProvider[str, str]:
    """根据当前配置创建面试包生成 provider。"""

    provider_name = settings.llm_provider.strip().lower()
    if not provider_name:
        raise ValueError("llm_provider 不能为空，必须显式指定 openai 或 dashscope")
    if not settings.llm_model.strip():
        raise ValueError("llm_model 不能为空")
    if not settings.llm_api_key.strip():
        raise ValueError("llm_api_key 不能为空")

    if provider_name == "openai":
        base_url = settings.llm_base_url.strip() or settings.openai_base_url
        return OpenAIResponsesGenerationProvider(
            provider_name="openai_responses",
            model=settings.llm_model,
            api_key=settings.llm_api_key,
            base_url=base_url,
            temperature=settings.llm_temperature,
        )

    if provider_name == "dashscope":
        base_url = settings.llm_base_url.strip() or DEFAULT_DASHSCOPE_RESPONSES_BASE_URL
        return OpenAIResponsesGenerationProvider(
            provider_name="dashscope_responses",
            model=settings.llm_model,
            api_key=settings.llm_api_key,
            base_url=base_url,
            temperature=settings.llm_temperature,
        )

    raise ValueError(f"不支持的 llm_provider={settings.llm_provider}")
