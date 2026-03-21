"""文档录入链路使用的标准化领域模型。"""

from typing import Literal

from pydantic import BaseModel, Field

DocumentType = Literal["resume", "job_description"]
DocumentSourceType = Literal["text", "pdf"]


class DocumentInput(BaseModel):
    """文档录入前的统一输入模型。"""

    document_type: DocumentType
    source_type: DocumentSourceType
    content: str
    metadata: dict[str, str] = Field(default_factory=dict)


class ParsedDocument(BaseModel):
    """经过 Provider 标准化后的文档模型。"""

    document_type: DocumentType
    source_type: DocumentSourceType
    provider_name: str
    raw_content: str
    normalized_content: str
    metadata: dict[str, str] = Field(default_factory=dict)


class DocumentIngestTextRequest(BaseModel):
    """文本录入接口的请求体。"""

    document_type: DocumentType
    content: str
    metadata: dict[str, str] = Field(default_factory=dict)


class DocumentIngestResponse(BaseModel):
    """文档录入接口返回的摘要结果。"""

    document_id: str
    document_type: DocumentType
    source_type: DocumentSourceType
    chunk_count: int = Field(ge=0)
    metadata: dict[str, str] = Field(default_factory=dict)
