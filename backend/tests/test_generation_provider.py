import json
from types import SimpleNamespace
from typing import cast

import pytest

from ai_job_copilot_backend.core.settings import Settings
from ai_job_copilot_backend.providers import generation


class FakeResponsesAPI:
    def __init__(self, output_text: str) -> None:
        self._output_text = output_text
        self.calls: list[dict[str, object]] = []

    async def create(self, **kwargs: object) -> SimpleNamespace:
        self.calls.append(kwargs)
        return SimpleNamespace(output_text=self._output_text)


class FakeAsyncOpenAI:
    instances: list["FakeAsyncOpenAI"] = []

    def __init__(self, *, api_key: str, base_url: str) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.responses = FakeResponsesAPI('{"questions": []}')
        self.__class__.instances.append(self)


def _normalize_json_payload(raw_output: str) -> dict[str, object]:
    normalized_output = raw_output.strip()
    if normalized_output.startswith("```"):
        normalized_output = normalized_output.strip("`")
        normalized_output = normalized_output.removeprefix("json").strip()
    parsed_output = json.loads(normalized_output)
    if not isinstance(parsed_output, dict):
        raise AssertionError("模型输出必须是 JSON object")
    return cast(dict[str, object], parsed_output)


def _build_real_llm_settings() -> Settings:
    loaded_settings = Settings()
    if (
        not loaded_settings.llm_provider
        or not loaded_settings.llm_model
        or not loaded_settings.llm_api_key
    ):
        pytest.fail(
            "必须先设置 AI_JOB_COPILOT_LLM_PROVIDER、"
            "AI_JOB_COPILOT_LLM_MODEL 和 AI_JOB_COPILOT_LLM_API_KEY"
        )

    return Settings(
        llm_provider=loaded_settings.llm_provider,
        llm_model=loaded_settings.llm_model,
        llm_api_key=loaded_settings.llm_api_key,
        llm_base_url=loaded_settings.llm_base_url,
        openai_base_url=loaded_settings.openai_base_url,
        llm_temperature=loaded_settings.llm_temperature,
    )


def test_create_generation_provider_requires_explicit_provider_selection() -> None:
    settings = Settings(
        llm_provider="",
        llm_model="qwen3.5-plus",
        llm_api_key="test-key",
    )

    with pytest.raises(ValueError, match="llm_provider"):
        generation.create_generation_provider(settings)


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("provider_name", "expected_base_url"),
    [
        ("openai", "https://api.openai.com/v1"),
        (
            "dashscope",
            "https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1",
        ),
    ],
)
async def test_create_generation_provider_uses_responses_api(
    monkeypatch: pytest.MonkeyPatch,
    provider_name: str,
    expected_base_url: str,
) -> None:
    FakeAsyncOpenAI.instances = []
    monkeypatch.setattr(generation, "AsyncOpenAI", FakeAsyncOpenAI)

    provider = generation.create_generation_provider(
        Settings(
            llm_provider=provider_name,
            llm_model="qwen3.5-plus",
            llm_api_key="test-key",
            llm_base_url="",
        )
    )

    output = await provider.generate("生成一个 JSON")

    assert output == '{"questions": []}'
    assert len(FakeAsyncOpenAI.instances) == 1
    client = FakeAsyncOpenAI.instances[0]
    assert client.api_key == "test-key"
    assert client.base_url == expected_base_url
    assert client.responses.calls
    assert client.responses.calls[0]["model"] == "qwen3.5-plus"
    assert client.responses.calls[0]["input"] == [
        {
            "role": "developer",
            "content": "你是一个结构化输出助手，只返回合法 JSON，不要输出额外说明。",
        },
        {"role": "user", "content": "生成一个 JSON"},
    ]


@pytest.mark.anyio
async def test_generation_provider_calls_real_llm() -> None:
    settings = _build_real_llm_settings()
    provider = generation.create_generation_provider(settings)

    output = await provider.generate(
        '请只返回合法 JSON，格式严格为 {"questions": []}。不要输出解释，不要输出 Markdown。'
    )
    parsed_output = _normalize_json_payload(output)

    assert parsed_output == {"questions": []}
