from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import cast

import pytest

from ai_job_copilot_backend.core.settings import Settings
from ai_job_copilot_backend.providers import generation
from ai_job_copilot_backend.providers.base import GenerationProvider
from ai_job_copilot_backend.resume_review.service import (
    ResumeReviewAnalysisService,
    ResumeReviewChatService,
)
from ai_job_copilot_backend.schemas.resume_review import (
    ResumeReviewAnalysisRequest,
    ResumeReviewChatRequest,
    RuntimeModelConfig,
)
from ai_job_copilot_backend.schemas.retrieval import (
    RetrievalChunk,
    RetrievalContext,
    RetrievalQuery,
)


def _build_resume_context() -> RetrievalContext:
    return RetrievalContext(
        query="resume",
        chunks=[
            RetrievalChunk(
                document_id="resume-001",
                chunk_id="resume-001:chunk:0",
                content="Built retrieval pipelines with FastAPI and Chroma.",
                score=0.91,
                metadata={"document_type": "resume", "filename": "resume.pdf"},
            )
        ],
    )


def _build_job_context() -> RetrievalContext:
    return RetrievalContext(
        query="job_description",
        chunks=[
            RetrievalChunk(
                document_id="jd-001",
                chunk_id="jd-001:chunk:1",
                content="Need strong backend engineering and retrieval system experience.",
                score=0.88,
                metadata={"document_type": "job_description", "filename": "jd.pdf"},
            )
        ],
    )


class StubRetrievalService:
    def __init__(
        self,
        *,
        resume_context: RetrievalContext,
        job_context: RetrievalContext,
    ) -> None:
        self._resume_context = resume_context
        self._job_context = job_context
        self.queries: list[RetrievalQuery] = []

    async def retrieve_context(
        self,
        query: RetrievalQuery,
        limit: int = 5,
    ) -> RetrievalContext:
        _ = limit
        self.queries.append(query)
        if query.document_type == "resume":
            return self._resume_context
        if query.document_type == "job_description":
            return self._job_context
        raise AssertionError(f"unexpected document_type={query.document_type}")


class StubGenerationProvider(GenerationProvider[str, str]):
    provider_name = "stub"

    def __init__(self, payload: str) -> None:
        self._payload = payload
        self.prompts: list[str] = []
        self.stream_payloads: list[str] = []

    async def generate(self, prompt: str) -> str:
        self.prompts.append(prompt)
        return self._payload

    async def stream_generate(self, prompt: str) -> AsyncIterator[str]:
        self.stream_payloads.append(prompt)
        midpoint = max(len(self._payload) // 2, 1)
        yield self._payload[:midpoint]
        yield self._payload[midpoint:]


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
        self.responses = FakeResponsesAPI("# analysis markdown")
        self.__class__.instances.append(self)


@pytest.mark.anyio
async def test_analysis_service_streams_markdown_and_citations() -> None:
    retrieval_service = StubRetrievalService(
        resume_context=_build_resume_context(),
        job_context=_build_job_context(),
    )
    generation_provider = StubGenerationProvider(
        "# 初始分析\n\n## 主要问题诊断\n\n- 简历对检索成果的量化不够充分"
        "\n\n## 修改建议\n\n- 补充结果指标"
    )
    service = ResumeReviewAnalysisService(
        retrieval_service=retrieval_service,
        generation_provider_factory=lambda runtime_model_config: generation_provider,
    )

    events = [
        event
        async for event in service.stream_resume_review_analysis(
            ResumeReviewAnalysisRequest(
                review_id="pack-001",
                request_id="req-001",
                resume_document_id="resume-001",
                job_description_document_id="jd-001",
                suggestion_count=3,
                target_role="Backend Engineer",
            )
        )
    ]

    assert [event.stage for event in events] == [
        "start",
        "metadata",
        "citation",
        "citation",
        "delta",
        "delta",
        "done",
    ]
    assert events[1].metadata is not None
    assert events[1].metadata.suggestion_count == 3
    assert events[2].citation is not None
    assert events[2].citation.source_type == "resume"
    assert events[3].citation is not None
    assert events[3].citation.source_type == "job_description"
    assert "Backend Engineer" in generation_provider.stream_payloads[0]
    assert "resume-001:chunk:0" in generation_provider.stream_payloads[0]
    assert "jd-001:chunk:1" in generation_provider.stream_payloads[0]
    assert "".join(cast(str, event.delta) for event in events if event.delta) == (
        "# 初始分析\n\n## 主要问题诊断\n\n- 简历对检索成果的量化不够充分"
        "\n\n## 修改建议\n\n- 补充结果指标"
    )


@pytest.mark.anyio
async def test_chat_service_streams_context_citations_and_markdown_for_initial_turn() -> None:
    retrieval_service = StubRetrievalService(
        resume_context=_build_resume_context(),
        job_context=_build_job_context(),
    )
    generation_provider = StubGenerationProvider(
        "# 初始分析\n\n## 主要问题诊断\n\n- 简历对检索成果的量化不够充分"
    )
    service = ResumeReviewChatService(
        retrieval_service=retrieval_service,
        generation_provider_factory=lambda runtime_model_config: generation_provider,
    )

    events = [
        event
        async for event in service.stream_resume_review_chat(
            ResumeReviewChatRequest(
                review_id="pack-001",
                request_id="req-001",
                resume_document_id="resume-001",
                job_description_document_id="jd-001",
                suggestion_count=3,
                target_role="Backend Engineer",
                messages=[
                    {
                        "role": "system",
                        "content": "你是资深求职教练。",
                    },
                    {
                        "role": "user",
                        "content": "先给我整体分析。",
                    },
                ],
            )
        )
    ]

    assert [event.stage for event in events] == [
        "start",
        "context",
        "citation",
        "citation",
        "delta",
        "delta",
        "done",
    ]
    assert events[1].context is not None
    assert events[1].context.suggestion_count == 3
    assert events[2].citation is not None
    assert events[2].citation.source_type == "resume"
    assert events[3].citation is not None
    assert events[3].citation.source_type == "job_description"
    assert "历史对话" in generation_provider.stream_payloads[0]
    assert "先给我整体分析。" in generation_provider.stream_payloads[0]
    assert "Backend Engineer" in generation_provider.stream_payloads[0]


@pytest.mark.anyio
async def test_chat_service_includes_follow_up_history_in_prompt() -> None:
    retrieval_service = StubRetrievalService(
        resume_context=_build_resume_context(),
        job_context=_build_job_context(),
    )
    generation_provider = StubGenerationProvider("继续回答追问。")
    service = ResumeReviewChatService(
        retrieval_service=retrieval_service,
        generation_provider_factory=lambda runtime_model_config: generation_provider,
    )

    _ = [
        event
        async for event in service.stream_resume_review_chat(
            ResumeReviewChatRequest(
                review_id="pack-002",
                request_id="req-002",
                resume_document_id="resume-001",
                job_description_document_id="jd-001",
                suggestion_count=2,
                target_role="Backend Engineer",
                messages=[
                    {
                        "role": "user",
                        "content": "先给我整体分析。",
                    },
                    {
                        "role": "assistant",
                        "content": "这里是第一轮分析。",
                    },
                    {
                        "role": "user",
                        "content": "请重点改写项目经历部分。",
                    },
                ],
            )
        )
    ]

    prompt = generation_provider.stream_payloads[0]
    assert "请重点改写项目经历部分。" in prompt
    assert "这里是第一轮分析。" in prompt
    assert "不要把整份初始报告完整重复一遍" in prompt


@pytest.mark.anyio
async def test_chat_service_retargets_retrieval_queries_to_latest_user_message() -> None:
    retrieval_service = StubRetrievalService(
        resume_context=_build_resume_context(),
        job_context=_build_job_context(),
    )
    generation_provider = StubGenerationProvider("继续回答追问。")
    service = ResumeReviewChatService(
        retrieval_service=retrieval_service,
        generation_provider_factory=lambda runtime_model_config: generation_provider,
    )

    _ = [
        event
        async for event in service.stream_resume_review_chat(
            ResumeReviewChatRequest(
                review_id="pack-003",
                request_id="req-003",
                resume_document_id="resume-001",
                job_description_document_id="jd-001",
                suggestion_count=2,
                target_role="Backend Engineer",
                messages=[
                    {
                        "role": "user",
                        "content": "先给我整体分析。",
                    },
                    {
                        "role": "assistant",
                        "content": "这里是第一轮分析。",
                    },
                    {
                        "role": "user",
                        "content": "请重点改写项目经历部分。",
                    },
                ],
            )
        )
    ]

    assert len(retrieval_service.queries) == 2
    assert "请重点改写项目经历部分。" in retrieval_service.queries[0].query
    assert "请重点改写项目经历部分。" in retrieval_service.queries[1].query


@pytest.mark.anyio
async def test_create_generation_provider_prefers_runtime_model_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    FakeAsyncOpenAI.instances = []
    monkeypatch.setattr(generation, "AsyncOpenAI", FakeAsyncOpenAI)

    provider = generation.create_generation_provider(
        Settings(
            llm_provider="openai",
            llm_model="fallback-model",
            llm_api_key="fallback-key",
            llm_base_url="https://fallback.example/v1",
            llm_temperature=0.9,
        ),
        runtime_model_config=RuntimeModelConfig(
            provider="dashscope",
            model="runtime-model",
            api_key="runtime-key",
            base_url="https://runtime.example/v1",
            temperature=0.3,
        ),
    )

    output = await provider.generate("生成一个 Markdown")

    assert output == "# analysis markdown"
    assert len(FakeAsyncOpenAI.instances) == 1
    client = FakeAsyncOpenAI.instances[0]
    assert client.api_key == "runtime-key"
    assert client.base_url == "https://runtime.example/v1"
    assert client.responses.calls
    assert client.responses.calls[0]["model"] == "runtime-model"
    assert client.responses.calls[0]["input"] == [
        {
            "role": "developer",
            "content": "你是一个严谨的输出助手，必须严格遵循用户给定的格式与边界。",
        },
        {"role": "user", "content": "生成一个 Markdown"},
    ]
