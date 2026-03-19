"""面试题包生成链路的基础请求与响应模型。"""

from pydantic import BaseModel, Field


class InterviewPackRequest(BaseModel):
    """生成面试题包时使用的请求体。"""

    resume_document_id: str
    job_description_document_id: str
    question_count: int = Field(default=5, ge=1, le=20)
    target_role: str | None = None


class InterviewQuestion(BaseModel):
    """结构化面试题，包含追问与参考回答。"""

    question: str
    follow_ups: list[str] = Field(default_factory=list)
    reference_answer: str


class InterviewPackResponse(BaseModel):
    """生成面试题包后返回的响应体。"""

    request_id: str
    questions: list[InterviewQuestion]
