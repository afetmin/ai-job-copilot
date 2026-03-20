"""检索链路使用的数据模型。"""

from pydantic import BaseModel, Field

from ai_job_copilot_backend.schemas.documents import DocumentSourceType, DocumentType


class DocumentChunk(BaseModel):
    """表示切分后的单个文档块。"""

    document_id: str
    chunk_id: str
    document_type: DocumentType
    source_type: DocumentSourceType
    chunk_index: int = Field(ge=0)
    content: str
    metadata: dict[str, str] = Field(default_factory=dict)


class IndexedDocument(BaseModel):
    """表示已经写入向量索引的文档。"""

    document_id: str
    document_type: DocumentType
    source_type: DocumentSourceType
    chunk_count: int = Field(ge=0)
    metadata: dict[str, str] = Field(default_factory=dict)


class RetrievalQuery(BaseModel):
    """表示一次检索请求。"""

    query: str
    document_type: DocumentType | None = None
    document_ids: list[str] = Field(default_factory=list)


class RetrievalChunk(BaseModel):
    """表示一次检索命中的上下文片段。"""

    document_id: str
    chunk_id: str
    content: str
    score: float = Field(ge=0.0)
    metadata: dict[str, str] = Field(default_factory=dict)


class RetrievalContext(BaseModel):
    """表示下游生成链路可直接消费的检索上下文。"""

    query: str
    chunks: list[RetrievalChunk] = Field(default_factory=list)
