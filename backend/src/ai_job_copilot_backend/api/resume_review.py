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
    ResumeReviewChatContext,
    ResumeReviewChatRequest,
    ResumeReviewChatStreamEvent,
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


class ResumeReviewChatStreamService(Protocol):
    """定义统一聊天路由依赖的最小流式接口。"""

    def stream_resume_review_chat(
        self,
        request: ResumeReviewChatRequest,
    ) -> AsyncIterator[ResumeReviewChatStreamEvent]:
        """按顺序返回统一聊天事件。"""


class ResumeReviewChatServiceAdapter:
    """用现有初始分析服务提供统一 chat 路由的最小兼容实现。"""

    def __init__(self, analysis_service: ResumeReviewAnalysisService) -> None:
        self._analysis_service = analysis_service

    async def stream_resume_review_chat(
        self,
        request: ResumeReviewChatRequest,
    ) -> AsyncIterator[ResumeReviewChatStreamEvent]:
        analysis_request = ResumeReviewAnalysisRequest(
            review_id=request.review_id,
            request_id=request.request_id,
            resume_document_id=request.resume_document_id,
            job_description_document_id=request.job_description_document_id,
            suggestion_count=request.suggestion_count,
            target_role=request.target_role,
            runtime_model_config=request.runtime_model_config,
        )

        async for event in self._analysis_service.stream_resume_review_analysis(
            analysis_request,
        ):
            yield self._map_event(event)

    @staticmethod
    def _map_event(
        event: ResumeReviewAnalysisStreamEvent,
    ) -> ResumeReviewChatStreamEvent:
        context = None
        if event.metadata is not None:
            context = ResumeReviewChatContext(
                review_id=event.metadata.review_id,
                request_id=event.metadata.request_id,
                target_role=event.metadata.target_role,
                suggestion_count=event.metadata.suggestion_count,
                resume_chunk_count=event.metadata.resume_chunk_count,
                job_description_chunk_count=event.metadata.job_description_chunk_count,
                focus_points=event.metadata.focus_points,
            )

        stage = "context" if event.stage == "metadata" else event.stage
        return ResumeReviewChatStreamEvent(
            review_id=event.review_id,
            request_id=event.request_id,
            stage=stage,
            context=context,
            citation=event.citation,
            delta=event.delta,
            message=event.message,
        )


def get_resume_review_generation_service(request: Request) -> ResumeReviewGenerationService:
    """从应用配置构建简历优化建议生成服务。"""

    settings = cast(Settings, request.app.state.settings)
    return ResumeReviewGenerationService.from_settings(settings)


def get_resume_review_analysis_service(request: Request) -> ResumeReviewAnalysisService:
    """从应用配置构建简历初始分析服务。"""

    settings = cast(Settings, request.app.state.settings)
    return ResumeReviewAnalysisService.from_settings(settings)


def get_resume_review_chat_service(request: Request) -> ResumeReviewChatStreamService:
    """基于现有初始分析服务提供统一 chat 路由的兼容适配。"""

    return ResumeReviewChatServiceAdapter(get_resume_review_analysis_service(request))


def _format_sse(event: SSEEvent) -> str:
    """把事件编码成标准 SSE 文本块。"""

    return f"event: {event.stage}\ndata: {event.model_dump_json()}\n\n"


resume_review_generation_service_dependency = Depends(get_resume_review_generation_service)
resume_review_analysis_service_dependency = Depends(get_resume_review_analysis_service)
resume_review_chat_service_dependency = Depends(get_resume_review_chat_service)


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


@router.post("/chat/stream")
async def stream_resume_review_chat(
    payload: ResumeReviewChatRequest,
    service: ResumeReviewChatStreamService = resume_review_chat_service_dependency,
) -> StreamingResponse:
    """以 SSE 形式暴露统一聊天流。"""

    async def event_stream() -> AsyncIterator[str]:
        async for event in service.stream_resume_review_chat(payload):
            yield _format_sse(event)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
