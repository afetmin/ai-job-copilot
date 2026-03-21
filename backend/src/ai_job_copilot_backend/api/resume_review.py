"""简历优化分析 SSE 接口。"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol, cast

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from ai_job_copilot_backend.core.settings import Settings
from ai_job_copilot_backend.resume_review.service import (
    ResumeReviewAnalysisService,
    ResumeReviewGenerationService,
)
from ai_job_copilot_backend.schemas.resume_review import (
    ResumeReviewAnalysisRequest,
    ResumeReviewAnalysisStreamEvent,
    ResumeReviewRequest,
    ResumeReviewStreamEvent,
)

router = APIRouter(prefix="/api/resume-reviews", tags=["resume-review"])


class SSEEvent(Protocol):
    """编码为 SSE 时需要的最小事件接口。"""

    stage: str

    def model_dump_json(self) -> str:
        """返回 JSON 序列化结果。"""


class ResumeReviewStreamService(Protocol):
    """定义建议生成路由依赖的最小流式接口。"""

    def stream_resume_review(
        self,
        request: ResumeReviewRequest,
    ) -> AsyncIterator[ResumeReviewStreamEvent]:
        """按顺序返回流式事件。"""


class ResumeReviewAnalysisStreamService(Protocol):
    """定义初始分析路由依赖的最小流式接口。"""

    def stream_resume_review_analysis(
        self,
        request: ResumeReviewAnalysisRequest,
    ) -> AsyncIterator[ResumeReviewAnalysisStreamEvent]:
        """按顺序返回初始分析事件。"""


def get_resume_review_generation_service(request: Request) -> ResumeReviewGenerationService:
    """从应用配置构建简历优化建议生成服务。"""

    settings = cast(Settings, request.app.state.settings)
    return ResumeReviewGenerationService.from_settings(settings)


def get_resume_review_analysis_service(request: Request) -> ResumeReviewAnalysisService:
    """从应用配置构建简历初始分析服务。"""

    settings = cast(Settings, request.app.state.settings)
    return ResumeReviewAnalysisService.from_settings(settings)


def _format_sse(event: SSEEvent) -> str:
    """把事件编码成标准 SSE 文本块。"""

    return f"event: {event.stage}\ndata: {event.model_dump_json()}\n\n"


resume_review_generation_service_dependency = Depends(get_resume_review_generation_service)
resume_review_analysis_service_dependency = Depends(get_resume_review_analysis_service)


@router.post("/suggestions/stream")
async def stream_resume_review(
    payload: ResumeReviewRequest,
    service: ResumeReviewStreamService = resume_review_generation_service_dependency,
) -> StreamingResponse:
    """以 SSE 形式暴露简历优化建议生成流。"""

    async def event_stream() -> AsyncIterator[str]:
        async for event in service.stream_resume_review(payload):
            yield _format_sse(event)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.post("/analysis/stream")
async def stream_resume_review_analysis(
    payload: ResumeReviewAnalysisRequest,
    service: ResumeReviewAnalysisStreamService = resume_review_analysis_service_dependency,
) -> StreamingResponse:
    """以 SSE 形式暴露结果页初始分析流。"""

    async def event_stream() -> AsyncIterator[str]:
        async for event in service.stream_resume_review_analysis(payload):
            yield _format_sse(event)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
