"""面试包生成所需的模型 provider。"""

from __future__ import annotations

from openai import AsyncOpenAI

from ai_job_copilot_backend.core.settings import Settings
from ai_job_copilot_backend.providers.base import GenerationProvider


class OpenAIChatGenerationProvider(GenerationProvider[str, str]):
    """基于 OpenAI Python SDK 的最小文本生成 provider。"""

    provider_name = "openai_chat"

    def __init__(
        self,
        *,
        model: str,
        api_key: str,
        base_url: str,
        temperature: float = 0.2,
    ) -> None:
        self._model = model
        self._temperature = temperature
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
        )

    async def generate(self, payload: str) -> str:
        """根据 prompt 生成纯文本结果。"""

        response = await self._client.chat.completions.create(
            model=self._model,
            temperature=self._temperature,
            messages=[
                {
                    "role": "system",
                    "content": "你是一个结构化输出助手，只返回合法 JSON，不要输出额外说明。",
                },
                {"role": "user", "content": payload},
            ],
        )
        content = response.choices[0].message.content or ""
        if not content.strip():
            raise ValueError("模型未返回可用内容")
        return content


def create_generation_provider(settings: Settings) -> GenerationProvider[str, str]:
    """根据当前配置创建面试包生成 provider。"""

    if not settings.llm_model.strip():
        raise ValueError("llm_model 不能为空")
    if not settings.openai_api_key.strip():
        raise ValueError("openai_api_key 不能为空")

    return OpenAIChatGenerationProvider(
        model=settings.llm_model,
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        temperature=settings.llm_temperature,
    )
