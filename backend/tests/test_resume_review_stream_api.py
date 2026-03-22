from collections.abc import AsyncIterator

import pytest
from fastapi.testclient import TestClient

from ai_job_copilot_backend.api.resume_review import get_resume_review_chat_service
from ai_job_copilot_backend.main import create_app
from ai_job_copilot_backend.schemas.resume_review import (
    ResumeReviewChatContext,
    ResumeReviewChatMessageInput,
    ResumeReviewChatRequest,
    ResumeReviewChatStreamEvent,
    ResumeReviewCitation,
    RuntimeModelConfig,
)


class StubChatStreamService:
    async def stream_resume_review_chat(
        self,
        request: ResumeReviewChatRequest,
    ) -> AsyncIterator[ResumeReviewChatStreamEvent]:
        assert request.review_id == "pack-123"
        assert request.resume_document_id == "resume-001"
        assert request.job_description_document_id == "jd-001"
        assert [message.role for message in request.messages] == ["system", "user"]
        assert request.messages[1].content == "先给我整体分析。"
        assert request.runtime_model_config is not None
        assert request.runtime_model_config.protocol == "anthropic_compatible"
        assert request.runtime_model_config.api_key == "user-key"
        assert request.runtime_model_config.model == "user-model"

        yield ResumeReviewChatStreamEvent(
            review_id="pack-123",
            request_id="req-123",
            stage="start",
        )
        yield ResumeReviewChatStreamEvent(
            review_id="pack-123",
            request_id="req-123",
            stage="context",
            context=ResumeReviewChatContext(
                review_id="pack-123",
                request_id="req-123",
                target_role="Backend Engineer",
                suggestion_count=5,
                resume_chunk_count=2,
                job_description_chunk_count=1,
                focus_points=["项目经历"],
            ),
        )
        yield ResumeReviewChatStreamEvent(
            review_id="pack-123",
            request_id="req-123",
            stage="citation",
            citation=ResumeReviewCitation(
                citation_id="resume:1",
                source_type="resume",
                document_id="resume-001",
                chunk_id="resume-001:chunk:0",
                title="resume.pdf",
                excerpt="Built retrieval pipelines with Chroma.",
                score=0.91,
            ),
        )
        yield ResumeReviewChatStreamEvent(
            review_id="pack-123",
            request_id="req-123",
            stage="delta",
            delta="先给出整体判断。",
        )
        yield ResumeReviewChatStreamEvent(
            review_id="pack-123",
            request_id="req-123",
            stage="done",
        )


def test_resume_review_chat_request_exposes_messages_array() -> None:
    request = ResumeReviewChatRequest(
        review_id="pack-123",
        request_id="req-123",
        resume_document_id="resume-001",
        job_description_document_id="jd-001",
        suggestion_count=5,
        target_role="Backend Engineer",
        messages=[
            ResumeReviewChatMessageInput(role="system", content="你是资深求职教练。"),
            ResumeReviewChatMessageInput(role="user", content="先给我整体分析。"),
        ],
        runtime_model_config=RuntimeModelConfig(
            protocol="anthropic_compatible",
            api_key="user-key",
            model="user-model",
            base_url="https://runtime.example",
            temperature=0.3,
        ),
    )

    assert request.review_id == "pack-123"
    assert request.messages[0].role == "system"
    assert request.messages[1].content == "先给我整体分析。"
    assert request.model_dump()["messages"][1]["role"] == "user"
    assert request.model_dump()["messages"][1]["content"] == "先给我整体分析。"


def test_resume_review_chat_context_keeps_summary_fields() -> None:
    context = ResumeReviewChatContext(
        review_id="pack-123",
        request_id="req-123",
        target_role="Backend Engineer",
        suggestion_count=5,
        resume_chunk_count=2,
        job_description_chunk_count=1,
        focus_points=["项目经历", "结果表达"],
    )

    assert context.review_id == "pack-123"
    assert context.resume_chunk_count == 2
    assert context.focus_points == ["项目经历", "结果表达"]


@pytest.mark.parametrize(
    "stage,payload",
    [
        ("start", {}),
        (
            "context",
            {
                "context": ResumeReviewChatContext(
                    review_id="pack-123",
                    request_id="req-123",
                    target_role="Backend Engineer",
                    suggestion_count=5,
                    resume_chunk_count=2,
                    job_description_chunk_count=1,
                    focus_points=["项目经历"],
                ),
            },
        ),
        (
            "citation",
            {
                "citation": ResumeReviewCitation(
                    citation_id="resume:1",
                    source_type="resume",
                    document_id="resume-001",
                    chunk_id="resume-001:chunk:0",
                    title="resume.pdf",
                    excerpt="Built retrieval pipelines with Chroma.",
                    score=0.91,
                ),
            },
        ),
        ("delta", {"delta": "先给出整体判断。"}),
        ("done", {}),
        ("error", {"message": "未找到 resume 的可用检索上下文"}),
    ],
)
def test_resume_review_chat_stream_event_uses_unified_event_names(
    stage: str,
    payload: dict[str, object],
) -> None:
    event = ResumeReviewChatStreamEvent(
        review_id="pack-123",
        request_id="req-123",
        stage=stage,  # type: ignore[arg-type]
        **payload,
    )

    assert event.stage == stage
    assert event.review_id == "pack-123"


def test_chat_stream_endpoint_returns_unified_sse_events() -> None:
    app = create_app()
    app.dependency_overrides[get_resume_review_chat_service] = StubChatStreamService
    client = TestClient(app)

    with client.stream(
        "POST",
        "/api/resume-reviews/chat/stream",
        json={
            "review_id": "pack-123",
            "request_id": "req-123",
            "resume_document_id": "resume-001",
            "job_description_document_id": "jd-001",
            "suggestion_count": 5,
            "target_role": "Backend Engineer",
            "messages": [
                {"role": "system", "content": "你是资深求职教练。"},
                {"role": "user", "content": "先给我整体分析。"},
            ],
            "runtime_model_config": {
                "protocol": "anthropic_compatible",
                "model": "user-model",
                "api_key": "user-key",
                "base_url": "https://runtime.example",
                "temperature": 0.3,
            },
        },
    ) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: start" in body
    assert "event: context" in body
    assert "event: citation" in body
    assert "event: delta" in body
    assert "event: done" in body
    unexpected_messages_payload = (
        '"messages":[{"role":"system","content":"你是资深求职教练。"},'
        '{"role":"user","content":"先给我整体分析。"}]'
    )
    assert unexpected_messages_payload not in body
    assert '"review_id":"pack-123"' in body
    assert '"request_id":"req-123"' in body
