import json

import pytest

from ai_job_copilot_backend.interview.service import (
    InterviewPackGenerationService,
    InterviewPackPromptBuilder,
    MissingRetrievalContextError,
)
from ai_job_copilot_backend.providers.base import GenerationProvider
from ai_job_copilot_backend.schemas.interview import InterviewPackRequest
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

    async def generate(self, prompt: str) -> str:
        self.prompts.append(prompt)
        return self._payload


def test_prompt_builder_includes_resume_and_job_context_chunks() -> None:
    prompt_builder = InterviewPackPromptBuilder()
    request = InterviewPackRequest(
        resume_document_id="resume-001",
        job_description_document_id="jd-001",
        question_count=1,
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
async def test_generation_service_returns_structured_interview_pack_with_sources() -> None:
    retrieval_service = StubRetrievalService(
        resume_context=_build_resume_context(),
        job_context=_build_job_context(),
    )
    generation_provider = StubGenerationProvider(
        json.dumps(
            {
                "questions": [
                    {
                        "question": "How did you design the retrieval architecture?",
                        "follow_ups": ["How did you evaluate relevance quality?"],
                        "reference_answer": (
                            "I combined structured chunking with Chroma retrieval "
                            "and FastAPI orchestration."
                        ),
                        "source_chunk_ids": ["resume-001:chunk:0", "jd-001:chunk:1"],
                    }
                ]
            },
            ensure_ascii=False,
        )
    )
    service = InterviewPackGenerationService(
        retrieval_service=retrieval_service,
        generation_provider=generation_provider,
    )

    response = await service.generate_interview_pack(
        InterviewPackRequest(
            resume_document_id="resume-001",
            job_description_document_id="jd-001",
            question_count=1,
            target_role="Backend Engineer",
        )
    )

    assert response.request_id
    assert len(response.questions) == 1
    assert response.questions[0].question == "How did you design the retrieval architecture?"
    assert response.questions[0].follow_ups == ["How did you evaluate relevance quality?"]
    assert len(response.questions[0].sources) == 2
    assert response.questions[0].sources[0].chunk_id == "resume-001:chunk:0"
    assert response.questions[0].sources[1].document_id == "jd-001"
    assert generation_provider.prompts


@pytest.mark.anyio
async def test_generation_service_raises_clear_error_when_resume_context_is_missing() -> None:
    retrieval_service = StubRetrievalService(
        resume_context=RetrievalContext(query="resume", chunks=[]),
        job_context=_build_job_context(),
    )
    generation_provider = StubGenerationProvider('{"questions": []}')
    service = InterviewPackGenerationService(
        retrieval_service=retrieval_service,
        generation_provider=generation_provider,
    )

    with pytest.raises(MissingRetrievalContextError, match="resume"):
        await service.generate_interview_pack(
            InterviewPackRequest(
                resume_document_id="resume-001",
                job_description_document_id="jd-001",
                question_count=1,
            )
        )
