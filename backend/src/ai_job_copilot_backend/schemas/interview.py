"""面试题包生成链路的基础请求与响应模型。"""

from typing import Literal

from pydantic import BaseModel, Field

from ai_job_copilot_backend.schemas.documents import DocumentType


class InterviewPackRequest(BaseModel):
    """生成面试题包时使用的请求体。"""

    resume_document_id: str
    job_description_document_id: str
    question_count: int = Field(default=5, ge=1, le=20)
    target_role: str | None = None


class InterviewQuestionSource(BaseModel):
    """面试题引用的检索来源片段。"""

    document_id: str
    chunk_id: str
    document_type: DocumentType
    excerpt: str


class InterviewQuestion(BaseModel):
    """结构化面试题，包含追问与参考回答。"""

    question: str
    follow_ups: list[str] = Field(default_factory=list)
    reference_answer: str
    sources: list[InterviewQuestionSource] = Field(default_factory=list)


class GeneratedInterviewQuestion(BaseModel):
    """模型返回的中间题目结构。"""

    question: str
    follow_ups: list[str] = Field(default_factory=list)
    reference_answer: str
    source_chunk_ids: list[str] = Field(default_factory=list)


class GeneratedInterviewPack(BaseModel):
    """模型返回的中间面试包结构。"""

    questions: list[GeneratedInterviewQuestion] = Field(default_factory=list)


class InterviewPackResponse(BaseModel):
    """生成面试题包后返回的响应体。"""

    request_id: str
    questions: list[InterviewQuestion]


InterviewPackStreamStage = Literal[
    "started",
    "retrieval_completed",
    "generation_delta",
    "completed",
    "error",
]


class InterviewPackStreamEvent(BaseModel):
    """后端 SSE 接口输出的标准事件结构。"""

    request_id: str
    stage: InterviewPackStreamStage
    resume_chunk_count: int | None = None
    job_description_chunk_count: int | None = None
    delta: str | None = None
    data: InterviewPackResponse | None = None
    message: str | None = None
