"""检索链路编排服务。"""

from __future__ import annotations

from typing import Any

from langchain_chroma import Chroma
from langchain_core.documents import Document

from ai_job_copilot_backend.core.settings import Settings
from ai_job_copilot_backend.providers.embeddings import create_embedding_function
from ai_job_copilot_backend.retrieval.chunking import ChunkingService
from ai_job_copilot_backend.schemas.documents import ParsedDocument
from ai_job_copilot_backend.schemas.retrieval import (
    IndexedDocument,
    RetrievalChunk,
    RetrievalContext,
    RetrievalQuery,
)


class RetrievalService:
    """编排切块、向量化、持久化与检索。"""

    def __init__(
        self,
        chunking_service: ChunkingService,
        vectorstore: Chroma,
    ) -> None:
        self._chunking_service = chunking_service
        self._vectorstore = vectorstore

    @classmethod
    def from_settings(cls, settings: Settings) -> RetrievalService:
        """根据配置构建 LangChain 检索服务。"""

        chunking_service = ChunkingService(
            chunk_size=settings.retrieval_chunk_size,
            chunk_overlap=settings.retrieval_chunk_overlap,
        )
        embedding_function = create_embedding_function(settings)
        vectorstore = Chroma(
            collection_name=settings.chroma_collection_name,
            embedding_function=embedding_function,
            persist_directory=settings.chroma_persist_directory,
            collection_metadata={"hnsw:space": "cosine"},
        )
        return cls(
            chunking_service=chunking_service,
            vectorstore=vectorstore,
        )

    async def index_document(
        self,
        parsed_document: ParsedDocument,
        document_id: str | None = None,
    ) -> IndexedDocument:
        """把文档切块后写入 LangChain Chroma。"""

        chunks = self._chunking_service.chunk_document(parsed_document, document_id=document_id)
        documents = [
            Document(
                id=chunk.chunk_id,
                page_content=chunk.content,
                metadata={
                    "document_id": chunk.document_id,
                    "chunk_id": chunk.chunk_id,
                    "document_type": chunk.document_type,
                    "source_type": chunk.source_type,
                    "chunk_index": str(chunk.chunk_index),
                    **chunk.metadata,
                },
            )
            for chunk in chunks
        ]

        if documents:
            self._vectorstore.add_documents(
                documents=documents,
                ids=[chunk.chunk_id for chunk in chunks],
            )

        resolved_document_id = self._chunking_service.build_document_id(
            parsed_document,
            document_id=document_id,
        )
        return IndexedDocument(
            document_id=resolved_document_id,
            document_type=parsed_document.document_type,
            source_type=parsed_document.source_type,
            chunk_count=len(chunks),
            metadata=parsed_document.metadata,
        )

    async def retrieve_context(
        self,
        query: RetrievalQuery,
        limit: int = 5,
    ) -> RetrievalContext:
        """根据查询条件返回检索上下文。"""

        filter_payload = self._build_filter(query)
        results = self._vectorstore.similarity_search_with_score(
            query=query.query,
            k=limit,
            filter=filter_payload,
        )

        chunks: list[RetrievalChunk] = []
        for document, score in results:
            metadata = self._stringify_metadata(document.metadata)
            chunks.append(
                RetrievalChunk(
                    document_id=metadata["document_id"],
                    chunk_id=metadata["chunk_id"],
                    content=document.page_content,
                    score=float(score),
                    metadata=metadata,
                )
            )

        return RetrievalContext(query=query.query, chunks=chunks)

    @staticmethod
    def _build_filter(query: RetrievalQuery) -> dict[str, Any] | None:
        filters: list[dict[str, Any]] = []
        if query.document_type is not None:
            filters.append({"document_type": query.document_type})
        if query.document_ids:
            filters.append({"document_id": {"$in": query.document_ids}})

        if not filters:
            return None
        if len(filters) == 1:
            return filters[0]
        return {"$and": filters}

    @staticmethod
    def _stringify_metadata(metadata: dict[str, Any]) -> dict[str, str]:
        return {key: str(value) for key, value in metadata.items()}
