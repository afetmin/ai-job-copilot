from collections.abc import AsyncIterator

from fastapi.testclient import TestClient

from ai_job_copilot_backend.api.resume_review import get_resume_review_generation_service
from ai_job_copilot_backend.main import create_app
from ai_job_copilot_backend.schemas.resume_review import (
    ResumeReviewAnalysisMetadata,
    ResumeReviewAnalysisRequest,
    ResumeReviewAnalysisStreamEvent,
    ResumeReviewCitation,
    ResumeReviewRequest,
    ResumeReviewResponse,
    ResumeReviewStreamEvent,
    ResumeReviewSuggestion,
    ResumeReviewSuggestionSource,
)


class StubStreamService:
    async def stream_resume_review(
        self,
        request: ResumeReviewRequest,
    ) -> AsyncIterator[ResumeReviewStreamEvent]:
        assert request.resume_document_id == "resume-001"
        assert request.job_description_document_id == "jd-001"

        yield ResumeReviewStreamEvent(
            request_id="req-123",
            stage="started",
        )
        yield ResumeReviewStreamEvent(
            request_id="req-123",
            stage="retrieval_completed",
            resume_chunk_count=1,
            job_description_chunk_count=1,
        )
        yield ResumeReviewStreamEvent(
            request_id="req-123",
            stage="generation_delta",
            delta='{"suggestions":[',
        )
        yield ResumeReviewStreamEvent(
            request_id="req-123",
            stage="completed",
            data=ResumeReviewResponse(
                request_id="req-123",
                suggestions=[
                    ResumeReviewSuggestion(
                        issue="简历对检索项目的结果表达不够具体。",
                        jd_alignment="JD 要求候选人展示检索系统设计与效果证明。",
                        rewrite_example="补充检索项目的系统目标、评估指标和最终结果，强化与岗位要求的对应关系。",
                        sources=[
                            ResumeReviewSuggestionSource(
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
    async def stream_resume_review(
        self,
        request: ResumeReviewRequest,
    ) -> AsyncIterator[ResumeReviewStreamEvent]:
        _ = request
        yield ResumeReviewStreamEvent(
            request_id="req-123",
            stage="error",
            message="未找到 resume 的可用检索上下文",
        )


class StubAnalysisStreamService:
    async def stream_resume_review_analysis(
        self,
        request: ResumeReviewAnalysisRequest,
    ) -> AsyncIterator[ResumeReviewAnalysisStreamEvent]:
        assert request.review_id == "pack-123"
        assert request.resume_document_id == "resume-001"
        assert request.job_description_document_id == "jd-001"
        assert request.runtime_model_config is not None
        assert request.runtime_model_config.provider == "dashscope"
        assert request.runtime_model_config.api_key == "user-key"
        assert request.runtime_model_config.model == "user-model"

        yield ResumeReviewAnalysisStreamEvent(
            review_id="pack-123",
            request_id="req-123",
            stage="start",
        )
        yield ResumeReviewAnalysisStreamEvent(
            review_id="pack-123",
            request_id="req-123",
            stage="metadata",
            metadata=ResumeReviewAnalysisMetadata(
                review_id="pack-123",
                request_id="req-123",
                target_role="Backend Engineer",
                suggestion_count=5,
                resume_chunk_count=1,
                job_description_chunk_count=1,
                focus_points=["准备项目经历"],
            ),
        )
        yield ResumeReviewAnalysisStreamEvent(
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
        yield ResumeReviewAnalysisStreamEvent(
            review_id="pack-123",
            request_id="req-123",
            stage="delta",
            delta="# 初始分析\n\n## 主要问题诊断\n\n- 简历里的结果表达不够具体",
        )
        yield ResumeReviewAnalysisStreamEvent(
            review_id="pack-123",
            request_id="req-123",
            stage="done",
        )


def test_stream_resume_review_endpoint_returns_sse_events() -> None:
    app = create_app()
    app.dependency_overrides[get_resume_review_generation_service] = StubStreamService
    client = TestClient(app)

    with client.stream(
        "POST",
        "/api/resume-reviews/suggestions/stream",
        json={
            "resume_document_id": "resume-001",
            "job_description_document_id": "jd-001",
            "suggestion_count": 1,
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


def test_stream_resume_review_endpoint_emits_error_event() -> None:
    app = create_app()
    app.dependency_overrides[get_resume_review_generation_service] = ErrorStreamService
    client = TestClient(app)

    with client.stream(
        "POST",
        "/api/resume-reviews/suggestions/stream",
        json={
            "resume_document_id": "resume-001",
            "job_description_document_id": "jd-001",
            "suggestion_count": 1,
        },
    ) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert "event: error" in body
    assert "未找到 resume 的可用检索上下文" in body


def test_analysis_stream_endpoint_returns_sse_events() -> None:
    app = create_app()
    from ai_job_copilot_backend.api.resume_review import get_resume_review_analysis_service

    app.dependency_overrides[get_resume_review_analysis_service] = StubAnalysisStreamService
    client = TestClient(app)

    with client.stream(
        "POST",
        "/api/resume-reviews/analysis/stream",
        json={
            "review_id": "pack-123",
            "request_id": "req-123",
            "resume_document_id": "resume-001",
            "job_description_document_id": "jd-001",
            "suggestion_count": 5,
            "target_role": "Backend Engineer",
            "runtime_model_config": {
                "provider": "dashscope",
                "model": "user-model",
                "api_key": "user-key",
                "base_url": "https://runtime.example/v1",
                "temperature": 0.3,
            },
        },
    ) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: start" in body
    assert "event: metadata" in body
    assert "event: citation" in body
    assert "event: delta" in body
    assert "event: done" in body
    assert '"review_id":"pack-123"' in body
    assert '"request_id":"req-123"' in body
