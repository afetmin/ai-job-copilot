from pathlib import Path

import pytest

from ai_job_copilot_backend.core.settings import Settings
from ai_job_copilot_backend.ingestion.registry import InputProviderRegistry
from ai_job_copilot_backend.ingestion.service import IngestionService
from ai_job_copilot_backend.providers.embeddings import create_embedding_function
from ai_job_copilot_backend.providers.text import TextInputProvider
from ai_job_copilot_backend.retrieval.chunking import ChunkingService
from ai_job_copilot_backend.retrieval.service import RetrievalService
from ai_job_copilot_backend.schemas.documents import DocumentInput, DocumentType, ParsedDocument
from ai_job_copilot_backend.schemas.retrieval import RetrievalQuery


def test_chunking_service_uses_langchain_text_splitter() -> None:
    chunking_service = ChunkingService(chunk_size=40, chunk_overlap=8)
    parsed_document = ParsedDocument(
        document_type="resume",
        source_type="text",
        provider_name="text",
        raw_content="ignored",
        normalized_content=(
            "Built retrieval pipelines with Chroma for hiring teams.\n\n"
            "Improved answer quality with better chunking."
        ),
        metadata={"candidate_name": "Alex"},
    )

    chunks = chunking_service.chunk_document(parsed_document, document_id="resume-001")

    assert len(chunks) >= 2
    assert chunks[0].chunk_id == "resume-001:chunk:0"
    assert chunks[0].document_id == "resume-001"
    assert chunks[0].metadata["candidate_name"] == "Alex"
    assert "provider_name" in chunks[0].metadata
    assert all(chunk.content for chunk in chunks)


def test_create_embedding_function_requires_explicit_provider_selection() -> None:
    settings = Settings(
        embedding_provider="",
        embedding_model="text-embedding-v3",
    )

    with pytest.raises(ValueError, match="embedding_provider"):
        create_embedding_function(settings)


async def _ingest_text_document(
    service: IngestionService,
    *,
    document_type: DocumentType,
    content: str,
    metadata: dict[str, str],
) -> ParsedDocument:
    return await service.ingest(
        DocumentInput(
            document_type=document_type,
            source_type="text",
            content=content,
            metadata=metadata,
        )
    )


async def _build_parsed_documents() -> tuple[ParsedDocument, ParsedDocument]:
    registry = InputProviderRegistry()
    registry.register("text", TextInputProvider())
    ingestion_service = IngestionService(registry)

    resume_document = await _ingest_text_document(
        ingestion_service,
        document_type="resume",
        content=(
            "Designed a Chroma-backed retrieval system for recruiting workflows. "
            "Implemented chunking, embeddings, and semantic search."
        ),
        metadata={"filename": "resume.txt"},
    )
    job_document = await _ingest_text_document(
        ingestion_service,
        document_type="job_description",
        content=(
            "Looking for a backend engineer with FastAPI experience. "
            "Bonus points for retrieval and ranking systems."
        ),
        metadata={"filename": "jd.txt"},
    )
    return resume_document, job_document


def _build_settings(persist_directory: str) -> Settings:
    loaded_settings = Settings()
    if not loaded_settings.embedding_provider or not loaded_settings.embedding_model:
        pytest.fail(
            "必须先设置 AI_JOB_COPILOT_EMBEDDING_PROVIDER "
            "和 AI_JOB_COPILOT_EMBEDDING_MODEL"
        )

    return Settings(
        embedding_provider=loaded_settings.embedding_provider,
        embedding_model=loaded_settings.embedding_model,
        chroma_persist_directory=persist_directory,
        openai_api_key=loaded_settings.openai_api_key,
        openai_base_url=loaded_settings.openai_base_url,
        dashscope_api_key=loaded_settings.dashscope_api_key,
    )


@pytest.mark.anyio
async def test_retrieval_service_indexes_documents_and_returns_relevant_context(
    tmp_path: Path,
) -> None:
    resume_document, job_document = await _build_parsed_documents()
    settings = _build_settings(str(tmp_path / "chroma"))

    retrieval_service = RetrievalService.from_settings(settings)

    indexed_resume = await retrieval_service.index_document(resume_document)
    indexed_job = await retrieval_service.index_document(job_document)

    reloaded_service = RetrievalService.from_settings(settings)
    retrieval_context = await reloaded_service.retrieve_context(
        RetrievalQuery(
            query="How did you build Chroma retrieval pipelines?",
            document_ids=[indexed_resume.document_id],
            document_type="resume",
        ),
        limit=2,
    )

    assert indexed_resume.chunk_count >= 1
    assert indexed_job.chunk_count >= 1
    assert retrieval_context.query == "How did you build Chroma retrieval pipelines?"
    assert retrieval_context.chunks
    assert retrieval_context.chunks[0].document_id == indexed_resume.document_id
    assert retrieval_context.chunks[0].metadata["document_type"] == "resume"
    assert retrieval_context.chunks[0].score >= 0.0
