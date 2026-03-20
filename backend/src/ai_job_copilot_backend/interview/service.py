"""面试题包生成服务。"""

from __future__ import annotations

import json
from typing import Protocol, cast
from uuid import uuid4

from ai_job_copilot_backend.core.settings import Settings
from ai_job_copilot_backend.providers.base import GenerationProvider
from ai_job_copilot_backend.providers.generation import create_generation_provider
from ai_job_copilot_backend.retrieval.service import RetrievalService
from ai_job_copilot_backend.schemas.documents import DocumentType
from ai_job_copilot_backend.schemas.interview import (
    GeneratedInterviewPack,
    InterviewPackRequest,
    InterviewPackResponse,
    InterviewQuestion,
    InterviewQuestionSource,
)
from ai_job_copilot_backend.schemas.retrieval import (
    RetrievalChunk,
    RetrievalContext,
    RetrievalQuery,
)


class MissingRetrievalContextError(ValueError):
    """检索不到生成所需上下文时抛出的异常。"""


class InterviewPackParsingError(ValueError):
    """模型输出无法解析为结构化面试包时抛出的异常。"""


class RetrievalContextLoader(Protocol):
    """定义生成服务依赖的最小检索接口。"""

    async def retrieve_context(
        self,
        query: RetrievalQuery,
        limit: int = 5,
    ) -> RetrievalContext:
        """根据查询条件返回检索上下文。"""


class InterviewPackPromptBuilder:
    """负责把检索结果整理成面试包生成 prompt。"""

    def build(
        self,
        *,
        request: InterviewPackRequest,
        resume_context: RetrievalContext,
        job_description_context: RetrievalContext,
    ) -> str:
        """构造面试包生成 prompt。"""

        target_role = request.target_role or "目标岗位未指定"
        return (
            "你是一个资深面试官，请基于候选人简历片段和职位描述片段，"
            "生成结构化面试题包。\n\n"
            "输出要求：\n"
            "1. 只返回合法 JSON，不要输出解释。\n"
            "2. JSON 结构必须为：\n"
            '{\n  "questions": [\n    {\n      "question": "string",\n'
            '      "follow_ups": ["string"],\n'
            '      "reference_answer": "string",\n'
            '      "source_chunk_ids": ["chunk-id"]\n'
            "    }\n  ]\n}\n"
            f"3. questions 数量必须等于 {request.question_count}。\n"
            "4. 每道题都必须同时尽量结合简历与 JD 线索。\n"
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


class InterviewPackGenerationService:
    """编排检索、prompt 组装、模型生成和结构化解析。"""

    def __init__(
        self,
        *,
        retrieval_service: RetrievalContextLoader,
        generation_provider: GenerationProvider[str, str],
        prompt_builder: InterviewPackPromptBuilder | None = None,
        retrieval_limit: int = 4,
    ) -> None:
        self._retrieval_service = retrieval_service
        self._generation_provider = generation_provider
        self._prompt_builder = prompt_builder or InterviewPackPromptBuilder()
        self._retrieval_limit = retrieval_limit

    @classmethod
    def from_settings(cls, settings: Settings) -> InterviewPackGenerationService:
        """根据配置构建面试包生成服务。"""

        return cls(
            retrieval_service=RetrievalService.from_settings(settings),
            generation_provider=create_generation_provider(settings),
            retrieval_limit=settings.interview_retrieval_limit,
        )

    async def generate_interview_pack(
        self,
        request: InterviewPackRequest,
    ) -> InterviewPackResponse:
        """生成结构化面试题包。"""

        resume_context = await self._retrieval_service.retrieve_context(
            RetrievalQuery(
                query=self._build_resume_query(request),
                document_type="resume",
                document_ids=[request.resume_document_id],
            ),
            limit=self._retrieval_limit,
        )
        if not resume_context.chunks:
            raise MissingRetrievalContextError("未找到 resume 的可用检索上下文")

        job_description_context = await self._retrieval_service.retrieve_context(
            RetrievalQuery(
                query=self._build_job_description_query(request),
                document_type="job_description",
                document_ids=[request.job_description_document_id],
            ),
            limit=self._retrieval_limit,
        )
        if not job_description_context.chunks:
            raise MissingRetrievalContextError("未找到 job_description 的可用检索上下文")

        prompt = self._prompt_builder.build(
            request=request,
            resume_context=resume_context,
            job_description_context=job_description_context,
        )
        raw_output = await self._generation_provider.generate(prompt)
        parsed_output = self._parse_generation_output(raw_output, request.question_count)

        source_lookup = self._build_source_lookup(
            resume_context=resume_context,
            job_description_context=job_description_context,
        )

        questions: list[InterviewQuestion] = []
        for generated_question in parsed_output.questions:
            sources = self._resolve_sources(
                source_chunk_ids=generated_question.source_chunk_ids,
                source_lookup=source_lookup,
            )
            questions.append(
                InterviewQuestion(
                    question=generated_question.question,
                    follow_ups=generated_question.follow_ups,
                    reference_answer=generated_question.reference_answer,
                    sources=sources,
                )
            )

        return InterviewPackResponse(
            request_id=str(uuid4()),
            questions=questions,
        )

    @staticmethod
    def _build_resume_query(request: InterviewPackRequest) -> str:
        target_role = request.target_role or "面试岗位"
        return f"{target_role} 项目经历 技术技能 业务成果 领导力"

    @staticmethod
    def _build_job_description_query(request: InterviewPackRequest) -> str:
        target_role = request.target_role or "面试岗位"
        return f"{target_role} 岗位职责 技术要求 任职要求 业务目标"

    @staticmethod
    def _parse_generation_output(
        raw_output: str,
        expected_question_count: int,
    ) -> GeneratedInterviewPack:
        normalized_output = raw_output.strip()
        if normalized_output.startswith("```"):
            normalized_output = normalized_output.strip("`")
            normalized_output = normalized_output.removeprefix("json").strip()

        try:
            parsed_json = json.loads(normalized_output)
            parsed_output = GeneratedInterviewPack.model_validate(parsed_json)
        except Exception as exc:
            raise InterviewPackParsingError("模型输出不是合法的面试包 JSON") from exc

        if len(parsed_output.questions) != expected_question_count:
            raise InterviewPackParsingError(
                f"模型返回的 questions 数量不正确，期望 {expected_question_count}，"
                f"实际 {len(parsed_output.questions)}"
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

    @staticmethod
    def _resolve_sources(
        *,
        source_chunk_ids: list[str],
        source_lookup: dict[str, RetrievalChunk],
    ) -> list[InterviewQuestionSource]:
        sources: list[InterviewQuestionSource] = []
        for chunk_id in source_chunk_ids:
            chunk = source_lookup.get(chunk_id)
            if chunk is None:
                raise InterviewPackParsingError(f"模型返回了未知的 source_chunk_id={chunk_id}")

            document_type = chunk.metadata.get("document_type")
            if document_type not in {"resume", "job_description"}:
                raise InterviewPackParsingError(
                    f"来源 chunk 缺少合法 document_type，chunk_id={chunk_id}"
                )

            sources.append(
                InterviewQuestionSource(
                    document_id=chunk.document_id,
                    chunk_id=chunk.chunk_id,
                    document_type=cast(DocumentType, document_type),
                    excerpt=chunk.content,
                )
            )

        if not sources:
            raise InterviewPackParsingError("每道题至少需要一个可解析的 source_chunk_id")
        return sources
