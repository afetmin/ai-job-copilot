"""简历优化分析链路的基础请求与响应模型。"""

from typing import Literal

from pydantic import BaseModel, Field

from ai_job_copilot_backend.schemas.documents import DocumentType


class ResumeReviewRequest(BaseModel):
    """生成简历优化建议时使用的请求体。"""

    resume_document_id: str
    job_description_document_id: str
    suggestion_count: int = Field(default=5, ge=1, le=20)
    target_role: str | None = None


class RuntimeModelConfig(BaseModel):
    """请求级大模型配置覆盖。"""

    provider: str
    model: str
    api_key: str
    base_url: str = ""
    temperature: float | None = None


class ResumeReviewSuggestionSource(BaseModel):
    """优化建议引用的检索来源片段。"""

    document_id: str
    chunk_id: str
    document_type: DocumentType
    excerpt: str


class ResumeReviewSuggestion(BaseModel):
    """一条结构化简历优化建议。"""

    issue: str
    jd_alignment: str
    rewrite_example: str
    sources: list[ResumeReviewSuggestionSource] = Field(default_factory=list)


class GeneratedResumeReviewSuggestion(BaseModel):
    """模型返回的中间建议结构。"""

    issue: str
    jd_alignment: str
    rewrite_example: str
    source_chunk_ids: list[str] = Field(default_factory=list)


class GeneratedResumeReview(BaseModel):
    """模型返回的中间简历优化结果。"""

    suggestions: list[GeneratedResumeReviewSuggestion] = Field(default_factory=list)


class ResumeReviewResponse(BaseModel):
    """生成简历优化建议后返回的响应体。"""

    request_id: str
    suggestions: list[ResumeReviewSuggestion]


class ResumeReviewAnalysisRequest(BaseModel):
    """结果页初始分析阶段使用的请求体。"""

    review_id: str
    request_id: str | None = None
    resume_document_id: str
    job_description_document_id: str
    suggestion_count: int = Field(default=5, ge=1, le=20)
    target_role: str | None = None
    runtime_model_config: RuntimeModelConfig | None = None


class ResumeReviewCitation(BaseModel):
    """初始分析消息引用的来源片段。"""

    citation_id: str
    source_type: DocumentType
    document_id: str
    chunk_id: str
    title: str
    excerpt: str
    score: float | None = None


class ResumeReviewAnalysisMetadata(BaseModel):
    """初始分析首条消息的结构化摘要。"""

    review_id: str
    request_id: str
    target_role: str | None = None
    suggestion_count: int = Field(ge=1, le=20)
    resume_chunk_count: int = Field(ge=0)
    job_description_chunk_count: int = Field(ge=0)
    focus_points: list[str] = Field(default_factory=list)


ResumeReviewAnalysisStreamStage = Literal[
    "start",
    "metadata",
    "citation",
    "delta",
    "done",
    "error",
]


class ResumeReviewAnalysisStreamEvent(BaseModel):
    """后端初始分析 SSE 事件结构。"""

    review_id: str
    request_id: str
    stage: ResumeReviewAnalysisStreamStage
    metadata: ResumeReviewAnalysisMetadata | None = None
    citation: ResumeReviewCitation | None = None
    delta: str | None = None
    message: str | None = None


ResumeReviewStreamStage = Literal[
    "started",
    "retrieval_completed",
    "generation_delta",
    "completed",
    "error",
]


class ResumeReviewStreamEvent(BaseModel):
    """后端建议生成 SSE 接口输出的标准事件结构。"""

    request_id: str
    stage: ResumeReviewStreamStage
    resume_chunk_count: int | None = None
    job_description_chunk_count: int | None = None
    delta: str | None = None
    data: ResumeReviewResponse | None = None
    message: str | None = None
