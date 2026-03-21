"""简历优化建议与初始分析服务。"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Callable
from typing import Protocol, cast
from uuid import uuid4

from ai_job_copilot_backend.core.settings import Settings
from ai_job_copilot_backend.providers.base import GenerationProvider
from ai_job_copilot_backend.providers.generation import create_generation_provider
from ai_job_copilot_backend.retrieval.service import RetrievalService
from ai_job_copilot_backend.schemas.documents import DocumentType
from ai_job_copilot_backend.schemas.resume_review import (
    GeneratedResumeReview,
    ResumeReviewAnalysisMetadata,
    ResumeReviewAnalysisRequest,
    ResumeReviewAnalysisStreamEvent,
    ResumeReviewChatContext,
    ResumeReviewChatMessageInput,
    ResumeReviewChatRequest,
    ResumeReviewChatStreamEvent,
    ResumeReviewCitation,
    ResumeReviewRequest,
    ResumeReviewResponse,
    ResumeReviewStreamEvent,
    ResumeReviewSuggestion,
    ResumeReviewSuggestionSource,
    RuntimeModelConfig,
)
from ai_job_copilot_backend.schemas.retrieval import (
    RetrievalChunk,
    RetrievalContext,
    RetrievalQuery,
)


class MissingRetrievalContextError(ValueError):
    """检索不到生成所需上下文时抛出的异常。"""


class ResumeReviewParsingError(ValueError):
    """模型输出无法解析为结构化简历优化建议时抛出的异常。"""


class RetrievalContextLoader(Protocol):
    """定义生成服务依赖的最小检索接口。"""

    async def retrieve_context(
        self,
        query: RetrievalQuery,
        limit: int = 5,
    ) -> RetrievalContext:
        """根据查询条件返回检索上下文。"""


class ResumeReviewContextRequest(Protocol):
    """能提供简历和 JD 文档 ID 的请求对象。"""

    resume_document_id: str
    job_description_document_id: str
    target_role: str | None


def _build_resume_query(request: ResumeReviewContextRequest) -> str:
    target_role = request.target_role or "目标岗位"
    return f"{target_role} 项目经历 技术技能 业务成果 领导力"


def _build_job_description_query(request: ResumeReviewContextRequest) -> str:
    target_role = request.target_role or "目标岗位"
    return f"{target_role} 岗位职责 技术要求 任职要求 业务目标"


async def _load_contexts(
    retrieval_service: RetrievalContextLoader,
    request: ResumeReviewContextRequest,
    retrieval_limit: int,
) -> tuple[RetrievalContext, RetrievalContext]:
    resume_context = await retrieval_service.retrieve_context(
        RetrievalQuery(
            query=_build_resume_query(request),
            document_type="resume",
            document_ids=[request.resume_document_id],
        ),
        limit=retrieval_limit,
    )
    if not resume_context.chunks:
        raise MissingRetrievalContextError("未找到 resume 的可用检索上下文")

    job_description_context = await retrieval_service.retrieve_context(
        RetrievalQuery(
            query=_build_job_description_query(request),
            document_type="job_description",
            document_ids=[request.job_description_document_id],
        ),
        limit=retrieval_limit,
    )
    if not job_description_context.chunks:
        raise MissingRetrievalContextError("未找到 job_description 的可用检索上下文")

    return resume_context, job_description_context


class ResumeReviewPromptBuilder:
    """负责把检索结果整理成优化建议生成 prompt。"""

    def build(
        self,
        *,
        request: ResumeReviewRequest,
        resume_context: RetrievalContext,
        job_description_context: RetrievalContext,
    ) -> str:
        """构造简历优化建议生成 prompt。"""

        target_role = request.target_role or "目标岗位未指定"
        return (
            "你是一个资深求职教练，请基于候选人简历片段和职位描述片段，"
            "生成结构化简历优化建议。\n\n"
            "输出要求：\n"
            "1. 只返回合法 JSON，不要输出解释。\n"
            "2. JSON 结构必须为：\n"
            '{\n  "suggestions": [\n    {\n      "issue": "string",\n'
            '      "jd_alignment": "string",\n'
            '      "rewrite_example": "string",\n'
            '      "source_chunk_ids": ["chunk-id"]\n'
            "    }\n  ]\n}\n"
            f"3. suggestions 数量必须等于 {request.suggestion_count}。\n"
            "4. 每条建议都必须同时结合简历事实与 JD 要求。\n"
            "5. source_chunk_ids 只能引用下面提供的 chunk_id。\n\n"
            f"目标岗位：{target_role}\n\n"
            "【简历检索片段】\n"
            f"{self._format_context(resume_context)}\n\n"
            "【职位描述检索片段】\n"
            f"{self._format_context(job_description_context)}"
        )

    @staticmethod
    def _format_context(context: RetrievalContext) -> str:
        parts: list[str] = []
        for chunk in context.chunks:
            parts.append(
                f"- chunk_id={chunk.chunk_id}\n"
                f"  document_id={chunk.document_id}\n"
                f"  content={chunk.content}"
            )
        return "\n".join(parts)


class ResumeReviewGenerationService:
    """编排检索、prompt 组装、模型生成和结构化解析。"""

    def __init__(
        self,
        *,
        retrieval_service: RetrievalContextLoader,
        generation_provider: GenerationProvider[str, str],
        prompt_builder: ResumeReviewPromptBuilder | None = None,
        retrieval_limit: int = 4,
    ) -> None:
        self._retrieval_service = retrieval_service
        self._generation_provider = generation_provider
        self._prompt_builder = prompt_builder or ResumeReviewPromptBuilder()
        self._retrieval_limit = retrieval_limit

    @classmethod
    def from_settings(cls, settings: Settings) -> ResumeReviewGenerationService:
        """根据配置构建简历优化建议生成服务。"""

        return cls(
            retrieval_service=RetrievalService.from_settings(settings),
            generation_provider=create_generation_provider(settings),
            retrieval_limit=settings.interview_retrieval_limit,
        )

    async def generate_resume_review(
        self,
        request: ResumeReviewRequest,
    ) -> ResumeReviewResponse:
        """生成结构化简历优化建议。"""

        request_id = str(uuid4())
        resume_context, job_description_context = await _load_contexts(
            self._retrieval_service,
            request,
            self._retrieval_limit,
        )
        prompt = self._prompt_builder.build(
            request=request,
            resume_context=resume_context,
            job_description_context=job_description_context,
        )
        raw_output = await self._generation_provider.generate(prompt)
        parsed_output = self._parse_generation_output(raw_output, request.suggestion_count)

        source_lookup = self._build_source_lookup(
            resume_context=resume_context,
            job_description_context=job_description_context,
        )
        return self._build_resume_review_response(
            request_id=request_id,
            parsed_output=parsed_output,
            source_lookup=source_lookup,
        )

    async def stream_resume_review(
        self,
        request: ResumeReviewRequest,
    ) -> AsyncIterator[ResumeReviewStreamEvent]:
        """按 SSE 友好的事件流输出简历优化建议生成进度。"""

        request_id = str(uuid4())
        yield ResumeReviewStreamEvent(
            request_id=request_id,
            stage="started",
        )

        try:
            resume_context, job_description_context = await _load_contexts(
                self._retrieval_service,
                request,
                self._retrieval_limit,
            )
            yield ResumeReviewStreamEvent(
                request_id=request_id,
                stage="retrieval_completed",
                resume_chunk_count=len(resume_context.chunks),
                job_description_chunk_count=len(job_description_context.chunks),
            )

            prompt = self._prompt_builder.build(
                request=request,
                resume_context=resume_context,
                job_description_context=job_description_context,
            )

            raw_output_parts: list[str] = []
            async for delta in self._generation_provider.stream_generate(prompt):
                raw_output_parts.append(delta)
                yield ResumeReviewStreamEvent(
                    request_id=request_id,
                    stage="generation_delta",
                    delta=delta,
                )

            raw_output = "".join(raw_output_parts)
            parsed_output = self._parse_generation_output(raw_output, request.suggestion_count)
            source_lookup = self._build_source_lookup(
                resume_context=resume_context,
                job_description_context=job_description_context,
            )
            response = self._build_resume_review_response(
                request_id=request_id,
                parsed_output=parsed_output,
                source_lookup=source_lookup,
            )
            yield ResumeReviewStreamEvent(
                request_id=request_id,
                stage="completed",
                data=response,
            )
        except Exception as exc:
            yield ResumeReviewStreamEvent(
                request_id=request_id,
                stage="error",
                message=str(exc),
            )

    @staticmethod
    def _parse_generation_output(
        raw_output: str,
        expected_suggestion_count: int,
    ) -> GeneratedResumeReview:
        normalized_output = raw_output.strip()
        if normalized_output.startswith("```"):
            normalized_output = normalized_output.strip("`")
            normalized_output = normalized_output.removeprefix("json").strip()

        try:
            parsed_json = json.loads(normalized_output)
            parsed_output = GeneratedResumeReview.model_validate(parsed_json)
        except Exception as exc:
            raise ResumeReviewParsingError("模型输出不是合法的简历优化建议 JSON") from exc

        if len(parsed_output.suggestions) != expected_suggestion_count:
            raise ResumeReviewParsingError(
                f"模型返回的 suggestions 数量不正确，期望 {expected_suggestion_count}，"
                f"实际 {len(parsed_output.suggestions)}"
            )
        return parsed_output

    @staticmethod
    def _build_source_lookup(
        *,
        resume_context: RetrievalContext,
        job_description_context: RetrievalContext,
    ) -> dict[str, RetrievalChunk]:
        source_lookup: dict[str, RetrievalChunk] = {}
        for chunk in [*resume_context.chunks, *job_description_context.chunks]:
            source_lookup[chunk.chunk_id] = chunk
        return source_lookup

    def _build_resume_review_response(
        self,
        *,
        request_id: str,
        parsed_output: GeneratedResumeReview,
        source_lookup: dict[str, RetrievalChunk],
    ) -> ResumeReviewResponse:
        suggestions: list[ResumeReviewSuggestion] = []
        for suggestion in parsed_output.suggestions:
            sources = self._resolve_sources(
                source_chunk_ids=suggestion.source_chunk_ids,
                source_lookup=source_lookup,
            )
            suggestions.append(
                ResumeReviewSuggestion(
                    issue=suggestion.issue,
                    jd_alignment=suggestion.jd_alignment,
                    rewrite_example=suggestion.rewrite_example,
                    sources=sources,
                )
            )

        return ResumeReviewResponse(
            request_id=request_id,
            suggestions=suggestions,
        )

    @staticmethod
    def _resolve_sources(
        *,
        source_chunk_ids: list[str],
        source_lookup: dict[str, RetrievalChunk],
    ) -> list[ResumeReviewSuggestionSource]:
        sources: list[ResumeReviewSuggestionSource] = []
        for chunk_id in source_chunk_ids:
            chunk = source_lookup.get(chunk_id)
            if chunk is None:
                raise ResumeReviewParsingError(f"模型返回了未知的 source_chunk_id={chunk_id}")

            document_type = chunk.metadata.get("document_type")
            if document_type not in {"resume", "job_description"}:
                raise ResumeReviewParsingError(
                    f"来源 chunk 缺少合法 document_type，chunk_id={chunk_id}"
                )

            sources.append(
                ResumeReviewSuggestionSource(
                    document_id=chunk.document_id,
                    chunk_id=chunk.chunk_id,
                    document_type=cast(DocumentType, document_type),
                    excerpt=chunk.content,
                )
            )

        if not sources:
            raise ResumeReviewParsingError("每条建议至少需要一个可解析的 source_chunk_id")
        return sources


class ResumeReviewAnalysisPromptBuilder:
    """负责把初始分析检索结果整理成 Markdown 提示词。"""

    def build(
        self,
        *,
        request: ResumeReviewAnalysisRequest,
        resume_context: RetrievalContext,
        job_description_context: RetrievalContext,
    ) -> str:
        """构造初始分析 Markdown prompt。"""

        target_role = request.target_role or "目标岗位未指定"
        return (
            "你是一个资深求职辅导助手，请根据简历片段和岗位描述片段，"
            "直接输出用于聊天界面的 Markdown。\n\n"
            "输出要求：\n"
            "1. 只输出 Markdown，不要输出 JSON、代码块或额外解释。\n"
            "2. 建议包含以下小节：\n"
            "   - # 初始分析\n"
            "   - ## 主要问题诊断\n"
            "   - ## 与 JD 的错位点\n"
            "   - ## 修改建议\n"
            "   - ## 可直接替换的改写示例\n"
            f"3. 至少覆盖 {request.suggestion_count} 条高优先级建议。\n"
            "4. 不要编造上下文中没有出现的信息。\n\n"
            f"目标岗位：{target_role}\n"
            f"建议条数：{request.suggestion_count}\n\n"
            "【简历检索片段】\n"
            f"{self._format_context(resume_context)}\n\n"
            "【职位描述检索片段】\n"
            f"{self._format_context(job_description_context)}"
        )

    @staticmethod
    def _format_context(context: RetrievalContext) -> str:
        parts: list[str] = []
        for chunk in context.chunks:
            parts.append(
                f"- chunk_id={chunk.chunk_id}\n"
                f"  document_id={chunk.document_id}\n"
                f"  content={chunk.content}"
            )
        return "\n".join(parts)


def _format_chat_history(messages: list[ResumeReviewChatMessageInput]) -> str:
    if not messages:
        return "- user: 请先给我整体分析和修改建议。"

    lines = [f"- {message.role}: {message.content}" for message in messages]
    return "\n".join(lines)


def _latest_user_message(messages: list[ResumeReviewChatMessageInput]) -> str:
    for message in reversed(messages):
        if message.role == "user":
            return message.content

    return "请先给我整体分析和修改建议。"


class ResumeReviewChatPromptBuilder:
    """负责把统一聊天上下文整理成 Markdown 提示词。"""

    def build(
        self,
        *,
        request: ResumeReviewChatRequest,
        resume_context: RetrievalContext,
        job_description_context: RetrievalContext,
    ) -> str:
        target_role = request.target_role or "目标岗位未指定"
        latest_user_message = _latest_user_message(request.messages)
        is_initial_turn = not any(
            message.role == "assistant" and message.content.strip() for message in request.messages
        )

        response_shape = (
            (
                "请给出首轮整体分析，包含匹配判断、主要问题、与 JD 的错位点、"
                "优先修改建议和可直接替换的改写示例。"
            )
            if is_initial_turn
            else "请直接回答用户本轮追问，延续之前对话，不要把整份初始报告完整重复一遍。"
        )

        return (
            "你是一个资深求职辅导助手，请根据简历片段、岗位描述片段和现有对话，"
            "输出用于聊天界面的 Markdown。\n\n"
            "输出要求：\n"
            "1. 只输出 Markdown，不要输出 JSON、代码块或额外解释。\n"
            "2. 不要编造上下文中没有出现的信息。\n"
            f"3. {response_shape}\n"
            f"4. 本轮至少覆盖 {request.suggestion_count} 条高优先级建议或回答要点。\n\n"
            f"目标岗位：{target_role}\n"
            f"用户本轮问题：{latest_user_message}\n\n"
            "【历史对话】\n"
            f"{_format_chat_history(request.messages)}\n\n"
            "【简历检索片段】\n"
            f"{ResumeReviewAnalysisPromptBuilder._format_context(resume_context)}\n\n"
            "【职位描述检索片段】\n"
            f"{ResumeReviewAnalysisPromptBuilder._format_context(job_description_context)}"
        )


ResumeReviewAnalysisProviderFactory = Callable[
    [RuntimeModelConfig | None],
    GenerationProvider[str, str],
]


class ResumeReviewAnalysisService:
    """生成结果页首条初始分析消息。"""

    def __init__(
        self,
        *,
        retrieval_service: RetrievalContextLoader,
        generation_provider_factory: ResumeReviewAnalysisProviderFactory,
        prompt_builder: ResumeReviewAnalysisPromptBuilder | None = None,
        retrieval_limit: int = 4,
    ) -> None:
        self._retrieval_service = retrieval_service
        self._generation_provider_factory = generation_provider_factory
        self._prompt_builder = prompt_builder or ResumeReviewAnalysisPromptBuilder()
        self._retrieval_limit = retrieval_limit

    @classmethod
    def from_settings(cls, settings: Settings) -> ResumeReviewAnalysisService:
        """根据配置构建初始分析服务。"""

        def generation_provider_factory(
            runtime_model_config: RuntimeModelConfig | None,
        ) -> GenerationProvider[str, str]:
            return create_generation_provider(
                settings,
                runtime_model_config=runtime_model_config,
            )

        return cls(
            retrieval_service=RetrievalService.from_settings(settings),
            generation_provider_factory=generation_provider_factory,
            retrieval_limit=settings.interview_retrieval_limit,
        )

    async def stream_resume_review_analysis(
        self,
        request: ResumeReviewAnalysisRequest,
    ) -> AsyncIterator[ResumeReviewAnalysisStreamEvent]:
        """按 SSE 友好的事件流输出初始分析首条消息。"""

        request_id = request.request_id or request.review_id
        yield ResumeReviewAnalysisStreamEvent(
            review_id=request.review_id,
            request_id=request_id,
            stage="start",
        )

        try:
            resume_context, job_description_context = await _load_contexts(
                self._retrieval_service,
                request,
                self._retrieval_limit,
            )

            metadata = ResumeReviewAnalysisMetadata(
                review_id=request.review_id,
                request_id=request_id,
                target_role=request.target_role,
                suggestion_count=request.suggestion_count,
                resume_chunk_count=len(resume_context.chunks),
                job_description_chunk_count=len(job_description_context.chunks),
                focus_points=self._build_focus_points(request),
            )
            yield ResumeReviewAnalysisStreamEvent(
                review_id=request.review_id,
                request_id=request_id,
                stage="metadata",
                metadata=metadata,
            )

            for citation in self._build_citations(
                resume_context=resume_context,
                job_description_context=job_description_context,
            ):
                yield ResumeReviewAnalysisStreamEvent(
                    review_id=request.review_id,
                    request_id=request_id,
                    stage="citation",
                    citation=citation,
                )

            prompt = self._prompt_builder.build(
                request=request,
                resume_context=resume_context,
                job_description_context=job_description_context,
            )
            generation_provider = self._generation_provider_factory(
                request.runtime_model_config,
            )
            async for delta in generation_provider.stream_generate(prompt):
                yield ResumeReviewAnalysisStreamEvent(
                    review_id=request.review_id,
                    request_id=request_id,
                    stage="delta",
                    delta=delta,
                )

            yield ResumeReviewAnalysisStreamEvent(
                review_id=request.review_id,
                request_id=request_id,
                stage="done",
            )
        except Exception as exc:
            yield ResumeReviewAnalysisStreamEvent(
                review_id=request.review_id,
                request_id=request_id,
                stage="error",
                message=str(exc),
            )

    @staticmethod
    def _build_focus_points(request: ResumeReviewAnalysisRequest) -> list[str]:
        focus_points = [
            "先修最影响 JD 匹配度的表达问题",
            "优先补强可量化的结果和业务影响",
        ]
        if request.target_role:
            focus_points.insert(0, f"围绕 {request.target_role} 的核心要求展开")
        focus_points.append(f"本次初始分析将覆盖 {request.suggestion_count} 条高优先级建议")
        return focus_points

    @staticmethod
    def _build_citations(
        *,
        resume_context: RetrievalContext,
        job_description_context: RetrievalContext,
    ) -> list[ResumeReviewCitation]:
        citations: list[ResumeReviewCitation] = []
        for source_type, context in [
            ("resume", resume_context),
            ("job_description", job_description_context),
        ]:
            for index, chunk in enumerate(context.chunks, start=1):
                title_prefix = "简历" if source_type == "resume" else "JD"
                title = chunk.metadata.get("filename") or f"{title_prefix} 片段 {index}"
                citations.append(
                    ResumeReviewCitation(
                        citation_id=f"{source_type}:{index}",
                        source_type=cast(DocumentType, source_type),
                        document_id=chunk.document_id,
                        chunk_id=chunk.chunk_id,
                        title=title,
                        excerpt=chunk.content,
                        score=chunk.score,
                    )
                )
        return citations


class ResumeReviewChatService:
    """生成统一聊天流中的 assistant 消息。"""

    def __init__(
        self,
        *,
        retrieval_service: RetrievalContextLoader,
        generation_provider_factory: ResumeReviewAnalysisProviderFactory,
        prompt_builder: ResumeReviewChatPromptBuilder | None = None,
        retrieval_limit: int = 4,
    ) -> None:
        self._retrieval_service = retrieval_service
        self._generation_provider_factory = generation_provider_factory
        self._prompt_builder = prompt_builder or ResumeReviewChatPromptBuilder()
        self._retrieval_limit = retrieval_limit

    @classmethod
    def from_settings(cls, settings: Settings) -> ResumeReviewChatService:
        """根据配置构建统一聊天服务。"""

        def generation_provider_factory(
            runtime_model_config: RuntimeModelConfig | None,
        ) -> GenerationProvider[str, str]:
            return create_generation_provider(
                settings,
                runtime_model_config=runtime_model_config,
            )

        return cls(
            retrieval_service=RetrievalService.from_settings(settings),
            generation_provider_factory=generation_provider_factory,
            retrieval_limit=settings.interview_retrieval_limit,
        )

    async def stream_resume_review_chat(
        self,
        request: ResumeReviewChatRequest,
    ) -> AsyncIterator[ResumeReviewChatStreamEvent]:
        """按 SSE 友好的事件流输出统一聊天响应。"""

        request_id = request.request_id or request.review_id
        yield ResumeReviewChatStreamEvent(
            review_id=request.review_id,
            request_id=request_id,
            stage="start",
        )

        try:
            resume_context, job_description_context = await _load_contexts(
                self._retrieval_service,
                request,
                self._retrieval_limit,
            )

            context = ResumeReviewChatContext(
                review_id=request.review_id,
                request_id=request_id,
                target_role=request.target_role,
                suggestion_count=request.suggestion_count,
                resume_chunk_count=len(resume_context.chunks),
                job_description_chunk_count=len(job_description_context.chunks),
                focus_points=self._build_focus_points(request),
            )
            yield ResumeReviewChatStreamEvent(
                review_id=request.review_id,
                request_id=request_id,
                stage="context",
                context=context,
            )

            for citation in ResumeReviewAnalysisService._build_citations(
                resume_context=resume_context,
                job_description_context=job_description_context,
            ):
                yield ResumeReviewChatStreamEvent(
                    review_id=request.review_id,
                    request_id=request_id,
                    stage="citation",
                    citation=citation,
                )

            prompt = self._prompt_builder.build(
                request=request,
                resume_context=resume_context,
                job_description_context=job_description_context,
            )
            generation_provider = self._generation_provider_factory(
                request.runtime_model_config,
            )
            async for delta in generation_provider.stream_generate(prompt):
                yield ResumeReviewChatStreamEvent(
                    review_id=request.review_id,
                    request_id=request_id,
                    stage="delta",
                    delta=delta,
                )

            yield ResumeReviewChatStreamEvent(
                review_id=request.review_id,
                request_id=request_id,
                stage="done",
            )
        except Exception as exc:
            yield ResumeReviewChatStreamEvent(
                review_id=request.review_id,
                request_id=request_id,
                stage="error",
                message=str(exc),
            )

    @staticmethod
    def _build_focus_points(request: ResumeReviewChatRequest) -> list[str]:
        focus_points = [
            "优先回答用户当前最关心的修改问题",
            "继续围绕可量化结果和 JD 匹配度给建议",
        ]
        if request.target_role:
            focus_points.insert(0, f"围绕 {request.target_role} 的核心要求展开")
        focus_points.append(f"本轮按 {request.suggestion_count} 条高优先级建议或要点组织输出")
        return focus_points
