"""文档录入 API。"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Annotated, Protocol, cast

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from ai_job_copilot_backend.core.settings import Settings
from ai_job_copilot_backend.ingestion.registry import InputProviderRegistry
from ai_job_copilot_backend.ingestion.service import IngestionService
from ai_job_copilot_backend.providers.pdf import PDFInputProvider, PDFParseError
from ai_job_copilot_backend.providers.text import TextInputProvider
from ai_job_copilot_backend.retrieval.service import RetrievalService
from ai_job_copilot_backend.schemas.documents import (
    DocumentIngestResponse,
    DocumentIngestTextRequest,
    DocumentInput,
    DocumentType,
    ParsedDocument,
)
from ai_job_copilot_backend.schemas.retrieval import IndexedDocument

router = APIRouter(prefix="/api/documents", tags=["documents"])


class DocumentRetrievalService(Protocol):
    """定义路由依赖的最小检索接口。"""

    async def index_document(self, parsed_document: ParsedDocument) -> IndexedDocument:
        """把解析后的文档写入索引并返回摘要结果。"""


def get_document_ingestion_service(_: Request) -> IngestionService:
    """构建文档录入服务。"""

    registry = InputProviderRegistry()
    registry.register("text", TextInputProvider())
    registry.register("pdf", PDFInputProvider())
    return IngestionService(registry)


def get_document_retrieval_service(request: Request) -> RetrievalService:
    """从应用配置构建检索服务。"""

    settings = cast(Settings, request.app.state.settings)
    return RetrievalService.from_settings(settings)


def get_document_retrieval_service_factory(request: Request) -> Callable[[], RetrievalService]:
    """从应用配置构建延迟检索服务工厂。"""

    settings = cast(Settings, request.app.state.settings)
    return lambda: RetrievalService.from_settings(settings)


def _to_response(indexed_document: IndexedDocument) -> DocumentIngestResponse:
    return DocumentIngestResponse(
        document_id=indexed_document.document_id,
        document_type=indexed_document.document_type,
        source_type=indexed_document.source_type,
        chunk_count=indexed_document.chunk_count,
        metadata=indexed_document.metadata,
    )


def _parse_metadata(metadata: str | None) -> dict[str, str]:
    if metadata is None or metadata == "":
        return {}

    try:
        parsed_metadata = json.loads(metadata)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="metadata must be valid JSON") from exc

    if not isinstance(parsed_metadata, dict):
        raise HTTPException(status_code=400, detail="metadata must be a JSON object")

    return {str(key): str(value) for key, value in parsed_metadata.items()}


def _is_pdf_upload(filename: str, content_type: str | None) -> bool:
    return content_type == "application/pdf" and filename.lower().endswith(".pdf")


def _is_text_upload(filename: str, content_type: str | None) -> bool:
    normalized_content_type = (content_type or "").lower()
    return filename.lower().endswith(".txt") and normalized_content_type in {
        "",
        "application/octet-stream",
        "text/plain",
    }


document_ingestion_service_dependency = Depends(get_document_ingestion_service)
document_retrieval_service_dependency = Depends(get_document_retrieval_service)
document_retrieval_service_factory_dependency = Depends(get_document_retrieval_service_factory)


@router.post("/ingest-text", response_model=DocumentIngestResponse)
async def ingest_text(
    payload: DocumentIngestTextRequest,
    ingestion_service: IngestionService = document_ingestion_service_dependency,
    retrieval_service: DocumentRetrievalService = document_retrieval_service_dependency,
) -> DocumentIngestResponse:
    """录入纯文本内容并写入索引。"""

    parsed_document = await ingestion_service.ingest(
        DocumentInput(
            document_type=payload.document_type,
            source_type="text",
            content=payload.content,
            metadata=payload.metadata,
        )
    )
    indexed_document = await retrieval_service.index_document(parsed_document)
    return _to_response(indexed_document)


@router.post("/ingest-file", response_model=DocumentIngestResponse)
async def ingest_file(
    document_type: Annotated[DocumentType, Form()],
    file: Annotated[UploadFile, File()],
    metadata: Annotated[str | None, Form()] = None,
    ingestion_service: IngestionService = document_ingestion_service_dependency,
    retrieval_service_factory: Callable[[], DocumentRetrievalService] = (
        document_retrieval_service_factory_dependency
    ),
) -> DocumentIngestResponse:
    """录入上传文件，支持 PDF 和 UTF-8 编码的 TXT。"""

    filename = file.filename or ""
    file_bytes = await file.read()
    document_metadata = _parse_metadata(metadata)
    document_metadata["filename"] = filename

    if _is_pdf_upload(filename, file.content_type):
        temp_path: Path | None = None
        with NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file.write(file_bytes)
            temp_path = Path(temp_file.name)

        try:
            assert temp_path is not None
            try:
                parsed_document = await ingestion_service.ingest(
                    DocumentInput(
                        document_type=document_type,
                        source_type="pdf",
                        content=str(temp_path),
                        metadata=document_metadata,
                    )
                )
            except PDFParseError as exc:
                raise HTTPException(status_code=400, detail="unable to parse uploaded PDF") from exc
            retrieval_service = retrieval_service_factory()
            indexed_document = await retrieval_service.index_document(parsed_document)
            return _to_response(indexed_document)
        finally:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)

    if _is_text_upload(filename, file.content_type):
        try:
            text_content = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="only UTF-8 text files are supported") from exc

        parsed_document = await ingestion_service.ingest(
            DocumentInput(
                document_type=document_type,
                source_type="text",
                content=text_content,
                metadata=document_metadata,
            )
        )
        retrieval_service = retrieval_service_factory()
        indexed_document = await retrieval_service.index_document(parsed_document)
        return _to_response(indexed_document)

    raise HTTPException(status_code=400, detail="only PDF or TXT files are supported")
