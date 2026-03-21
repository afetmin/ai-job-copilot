import json
from collections.abc import AsyncIterator

import pytest

from ai_job_copilot_backend.providers.base import GenerationProvider
from ai_job_copilot_backend.resume_review.service import (
    MissingRetrievalContextError,
    ResumeReviewGenerationService,
    ResumeReviewPromptBuilder,
)
from ai_job_copilot_backend.schemas.resume_review import ResumeReviewRequest
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
                metadata={"document_type": "resume"},
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
                metadata={"document_type": "job_description"},
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

    async def retrieve_context(
        self,
        query: RetrievalQuery,
        limit: int = 5,
    ) -> RetrievalContext:
        _ = limit
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


def test_prompt_builder_includes_resume_and_job_context_chunks() -> None:
    prompt_builder = ResumeReviewPromptBuilder()
    request = ResumeReviewRequest(
        resume_document_id="resume-001",
        job_description_document_id="jd-001",
        suggestion_count=1,
        target_role="Backend Engineer",
    )

    prompt = prompt_builder.build(
        request=request,
        resume_context=_build_resume_context(),
        job_description_context=_build_job_context(),
    )

    assert "Backend Engineer" in prompt
    assert "resume-001:chunk:0" in prompt
    assert "jd-001:chunk:1" in prompt
    assert "source_chunk_ids" in prompt


@pytest.mark.anyio
async def test_generation_service_returns_structured_resume_review_with_sources() -> None:
    retrieval_service = StubRetrievalService(
        resume_context=_build_resume_context(),
        job_context=_build_job_context(),
    )
    generation_provider = StubGenerationProvider(
        json.dumps(
            {
                "suggestions": [
                    {
                        "issue": "简历写了检索系统经历，但没有写清楚产出和影响。",
                        "jd_alignment": "JD 明确要求候选人能证明检索系统设计与落地结果。",
                        "rewrite_example": (
                            "设计并落地基于 Chroma 的检索增强链路，结合 FastAPI 编排，"
                            "将候选人问答场景的召回质量稳定在业务可用阈值以上。"
                        ),
                        "source_chunk_ids": ["resume-001:chunk:0", "jd-001:chunk:1"],
                    }
                ]
            },
            ensure_ascii=False,
        )
    )
    service = ResumeReviewGenerationService(
        retrieval_service=retrieval_service,
        generation_provider=generation_provider,
    )

    response = await service.generate_resume_review(
        ResumeReviewRequest(
            resume_document_id="resume-001",
            job_description_document_id="jd-001",
            suggestion_count=1,
            target_role="Backend Engineer",
        )
    )

    assert response.request_id
    assert len(response.suggestions) == 1
    assert response.suggestions[0].issue == "简历写了检索系统经历，但没有写清楚产出和影响。"
    assert len(response.suggestions[0].sources) == 2
    assert response.suggestions[0].sources[0].chunk_id == "resume-001:chunk:0"
    assert response.suggestions[0].sources[1].document_id == "jd-001"
    assert generation_provider.prompts


@pytest.mark.anyio
async def test_generation_service_raises_clear_error_when_resume_context_is_missing() -> None:
    retrieval_service = StubRetrievalService(
        resume_context=RetrievalContext(query="resume", chunks=[]),
        job_context=_build_job_context(),
    )
    generation_provider = StubGenerationProvider('{"suggestions": []}')
    service = ResumeReviewGenerationService(
        retrieval_service=retrieval_service,
        generation_provider=generation_provider,
    )

    with pytest.raises(MissingRetrievalContextError, match="resume"):
        await service.generate_resume_review(
            ResumeReviewRequest(
                resume_document_id="resume-001",
                job_description_document_id="jd-001",
                suggestion_count=1,
            )
        )


@pytest.mark.anyio
async def test_stream_generation_service_emits_progress_and_completed_events() -> None:
    retrieval_service = StubRetrievalService(
        resume_context=_build_resume_context(),
        job_context=_build_job_context(),
    )
    generation_provider = StubGenerationProvider(
        json.dumps(
            {
                "suggestions": [
                    {
                        "issue": "简历中的检索经历缺少结果表达。",
                        "jd_alignment": "JD 需要看到系统设计和交付结果。",
                        "rewrite_example": (
                            "主导检索增强链路设计与交付，补充系统目标、评估方式和上线结果。"
                        ),
                        "source_chunk_ids": ["resume-001:chunk:0", "jd-001:chunk:1"],
                    }
                ]
            },
            ensure_ascii=False,
        )
    )
    service = ResumeReviewGenerationService(
        retrieval_service=retrieval_service,
        generation_provider=generation_provider,
    )

    events = [
        event
        async for event in service.stream_resume_review(
            ResumeReviewRequest(
                resume_document_id="resume-001",
                job_description_document_id="jd-001",
                suggestion_count=1,
                target_role="Backend Engineer",
            )
        )
    ]

    assert [event.stage for event in events] == [
        "started",
        "retrieval_completed",
        "generation_delta",
        "generation_delta",
        "completed",
    ]
    assert events[1].resume_chunk_count == 1
    assert events[1].job_description_chunk_count == 1
    assert events[-1].data is not None
    assert len(events[-1].data.suggestions) == 1
    assert generation_provider.stream_payloads
