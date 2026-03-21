"""面试题包 SSE 接口。"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol, cast

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from ai_job_copilot_backend.core.settings import Settings
from ai_job_copilot_backend.interview.service import InterviewPackGenerationService
from ai_job_copilot_backend.schemas.interview import (
    InterviewPackRequest,
    InterviewPackStreamEvent,
)

router = APIRouter(prefix="/api/interview-packs", tags=["interview"])


class InterviewPackStreamService(Protocol):
    """定义路由依赖的最小流式接口。"""

    def stream_interview_pack(
        self,
        request: InterviewPackRequest,
    ) -> AsyncIterator[InterviewPackStreamEvent]:
        """按顺序返回流式事件。"""


def get_interview_pack_generation_service(request: Request) -> InterviewPackGenerationService:
    """从应用配置构建面试题生成服务。"""

    settings = cast(Settings, request.app.state.settings)
    return InterviewPackGenerationService.from_settings(settings)


def _format_sse(event: InterviewPackStreamEvent) -> str:
    """把事件编码成标准 SSE 文本块。"""

    return f"event: {event.stage}\ndata: {event.model_dump_json()}\n\n"


interview_pack_generation_service_dependency = Depends(get_interview_pack_generation_service)


@router.post("/stream")
async def stream_interview_pack(
    payload: InterviewPackRequest,
    service: InterviewPackStreamService = interview_pack_generation_service_dependency,
) -> StreamingResponse:
    """以 SSE 形式暴露面试题包生成流。"""

    async def event_stream() -> AsyncIterator[str]:
        async for event in service.stream_interview_pack(payload):
            yield _format_sse(event)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
