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
        self.responses = FakeResponsesAPI('{"suggestions": []}')
        self.__class__.instances.append(self)


class FakeHTTPXResponse:
    def __init__(
        self,
        *,
        json_payload: dict[str, object] | None = None,
        lines: list[str] | None = None,
    ) -> None:
        self._json_payload = json_payload or {}
        self._lines = lines or []

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return self._json_payload

    async def aiter_lines(self):
        for line in self._lines:
            yield line


class FakeHTTPXStreamContext:
    def __init__(self, response: FakeHTTPXResponse) -> None:
        self._response = response

    async def __aenter__(self) -> FakeHTTPXResponse:
        return self._response

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None


class FakeAsyncHTTPXClient:
    instances: list["FakeAsyncHTTPXClient"] = []

    def __init__(self, *, base_url: str, headers: dict[str, str]) -> None:
        self.base_url = base_url
        self.headers = headers
        self.post_calls: list[dict[str, object]] = []
        self.stream_calls: list[dict[str, object]] = []
        self.__class__.instances.append(self)

    async def post(self, url: str, *, json: dict[str, object]) -> FakeHTTPXResponse:
        self.post_calls.append({"url": url, "json": json})
        return FakeHTTPXResponse(
            json_payload={
                "content": [
                    {
                        "type": "text",
                        "text": '{"suggestions": []}',
                    }
                ]
            }
        )

    def stream(
        self,
        method: str,
        url: str,
        *,
        json: dict[str, object],
    ) -> FakeHTTPXStreamContext:
        self.stream_calls.append({"method": method, "url": url, "json": json})
        return FakeHTTPXStreamContext(
            FakeHTTPXResponse(
                lines=[
                    "event: content_block_delta",
                    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
                    "",
                    "event: content_block_delta",
                    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}',
                    "",
                ]
            )
        )


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
        not loaded_settings.llm_protocol
        or not loaded_settings.llm_model
        or not loaded_settings.llm_api_key
    ):
        pytest.skip(
            "必须先设置 AI_JOB_COPILOT_LLM_PROTOCOL、"
            "AI_JOB_COPILOT_LLM_MODEL 和 AI_JOB_COPILOT_LLM_API_KEY"
        )

    return Settings(
        llm_protocol=loaded_settings.llm_protocol,
        llm_model=loaded_settings.llm_model,
        llm_api_key=loaded_settings.llm_api_key,
        llm_base_url=loaded_settings.llm_base_url,
        openai_base_url=loaded_settings.openai_base_url,
        llm_temperature=loaded_settings.llm_temperature,
    )


def test_create_generation_provider_requires_explicit_provider_selection() -> None:
    settings = Settings(
        llm_protocol="",
        llm_model="qwen3.5-plus",
        llm_api_key="test-key",
    )

    with pytest.raises(ValueError, match="llm_protocol"):
        generation.create_generation_provider(settings)


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("protocol", "expected_base_url"),
    [
        ("openai_compatible", "https://api.openai.com/v1"),
    ],
)
async def test_create_generation_provider_uses_responses_api(
    monkeypatch: pytest.MonkeyPatch,
    protocol: str,
    expected_base_url: str,
) -> None:
    FakeAsyncOpenAI.instances = []
    monkeypatch.setattr(generation, "AsyncOpenAI", FakeAsyncOpenAI)

    provider = generation.create_generation_provider(
        Settings(
            llm_protocol=protocol,
            llm_model="qwen3.5-plus",
            llm_api_key="test-key",
            llm_base_url="",
        )
    )

    output = await provider.generate("生成一个 JSON")

    assert output == '{"suggestions": []}'
    assert len(FakeAsyncOpenAI.instances) == 1
    client = FakeAsyncOpenAI.instances[0]
    assert client.api_key == "test-key"
    assert client.base_url == expected_base_url
    assert client.responses.calls
    assert client.responses.calls[0]["model"] == "qwen3.5-plus"
    assert client.responses.calls[0]["input"] == [
        {
            "role": "developer",
            "content": "你是一个严谨的输出助手，必须严格遵循用户给定的格式与边界。",
        },
        {"role": "user", "content": "生成一个 JSON"},
    ]


@pytest.mark.anyio
async def test_create_generation_provider_uses_anthropic_messages_api(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    FakeAsyncHTTPXClient.instances = []
    monkeypatch.setattr(generation.httpx, "AsyncClient", FakeAsyncHTTPXClient)

    provider = generation.create_generation_provider(
        Settings(
            llm_protocol="anthropic_compatible",
            llm_model="claude-sonnet-4-5",
            llm_api_key="anthropic-key",
            llm_base_url="",
        )
    )

    output = await provider.generate("生成一个 JSON")
    streamed_output = [chunk async for chunk in provider.stream_generate("继续输出")]

    assert output == '{"suggestions": []}'
    assert streamed_output == ["Hello", " world"]
    assert len(FakeAsyncHTTPXClient.instances) == 1
    client = FakeAsyncHTTPXClient.instances[0]
    assert client.base_url == "https://api.anthropic.com"
    assert client.headers["x-api-key"] == "anthropic-key"
    assert client.headers["anthropic-version"] == "2023-06-01"
    assert client.post_calls == [
        {
            "url": "/messages",
            "json": {
                "model": "claude-sonnet-4-5",
                "system": "你是一个严谨的输出助手，必须严格遵循用户给定的格式与边界。",
                "messages": [{"role": "user", "content": "生成一个 JSON"}],
                "max_tokens": 4096,
                "temperature": 0.2,
                "stream": False,
            },
        }
    ]
    assert client.stream_calls == [
        {
            "method": "POST",
            "url": "/messages",
            "json": {
                "model": "claude-sonnet-4-5",
                "system": "你是一个严谨的输出助手，必须严格遵循用户给定的格式与边界。",
                "messages": [{"role": "user", "content": "继续输出"}],
                "max_tokens": 4096,
                "temperature": 0.2,
                "stream": True,
            },
        }
    ]


@pytest.mark.anyio
async def test_generation_provider_calls_real_llm() -> None:
    settings = _build_real_llm_settings()
    provider = generation.create_generation_provider(settings)

    output = await provider.generate(
        '请只返回合法 JSON，格式严格为 {"suggestions": []}。不要输出解释，不要输出 Markdown。'
    )
    parsed_output = _normalize_json_payload(output)

    assert parsed_output == {"suggestions": []}
