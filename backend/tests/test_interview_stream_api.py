from collections.abc import AsyncIterator

from fastapi.testclient import TestClient

from ai_job_copilot_backend.api.interview import get_interview_pack_generation_service
from ai_job_copilot_backend.main import create_app
from ai_job_copilot_backend.schemas.interview import (
    InterviewPackRequest,
    InterviewPackResponse,
    InterviewPackStreamEvent,
    InterviewQuestion,
    InterviewQuestionSource,
)


class StubStreamService:
    async def stream_interview_pack(
        self,
        request: InterviewPackRequest,
    ) -> AsyncIterator[InterviewPackStreamEvent]:
        assert request.resume_document_id == "resume-001"
        assert request.job_description_document_id == "jd-001"

        yield InterviewPackStreamEvent(
            request_id="req-123",
            stage="started",
        )
        yield InterviewPackStreamEvent(
            request_id="req-123",
            stage="retrieval_completed",
            resume_chunk_count=1,
            job_description_chunk_count=1,
        )
        yield InterviewPackStreamEvent(
            request_id="req-123",
            stage="generation_delta",
            delta='{"questions":[',
        )
        yield InterviewPackStreamEvent(
            request_id="req-123",
            stage="completed",
            data=InterviewPackResponse(
                request_id="req-123",
                questions=[
                    InterviewQuestion(
                        question="Tell me about a retrieval project.",
                        follow_ups=["How did you evaluate it?"],
                        reference_answer="I used Chroma with structured chunks.",
                        sources=[
                            InterviewQuestionSource(
                                document_id="resume-001",
                                chunk_id="resume-001:chunk:0",
                                document_type="resume",
                                excerpt="Built retrieval pipelines with Chroma.",
                            )
                        ],
                    )
                ],
            ),
        )


class ErrorStreamService:
    async def stream_interview_pack(
        self,
        request: InterviewPackRequest,
    ) -> AsyncIterator[InterviewPackStreamEvent]:
        _ = request
        yield InterviewPackStreamEvent(
            request_id="req-123",
            stage="error",
            message="未找到 resume 的可用检索上下文",
        )


def test_stream_interview_pack_endpoint_returns_sse_events() -> None:
    app = create_app()
    app.dependency_overrides[get_interview_pack_generation_service] = StubStreamService
    client = TestClient(app)

    with client.stream(
        "POST",
        "/api/interview-packs/stream",
        json={
            "resume_document_id": "resume-001",
            "job_description_document_id": "jd-001",
            "question_count": 1,
            "target_role": "Backend Engineer",
        },
    ) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: started" in body
    assert "event: retrieval_completed" in body
    assert "event: generation_delta" in body
    assert "event: completed" in body
    assert '"request_id":"req-123"' in body


def test_stream_interview_pack_endpoint_emits_error_event() -> None:
    app = create_app()
    app.dependency_overrides[get_interview_pack_generation_service] = ErrorStreamService
    client = TestClient(app)

    with client.stream(
        "POST",
        "/api/interview-packs/stream",
        json={
            "resume_document_id": "resume-001",
            "job_description_document_id": "jd-001",
            "question_count": 1,
        },
    ) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert "event: error" in body
    assert "未找到 resume 的可用检索上下文" in body
