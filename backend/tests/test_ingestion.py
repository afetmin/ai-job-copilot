import pytest

from ai_job_copilot_backend.ingestion.registry import (
    InputProviderNotFoundError,
    InputProviderRegistry,
)
from ai_job_copilot_backend.ingestion.service import IngestionService
from ai_job_copilot_backend.providers.text import TextInputProvider
from ai_job_copilot_backend.schemas.documents import DocumentInput, ParsedDocument


def test_document_models_capture_standardized_ingestion_fields() -> None:
    document_input = DocumentInput(
        document_type="resume",
        source_type="text",
        content="  Leading backend projects at scale.  ",
        metadata={"candidate_name": "Alex"},
    )
    parsed_document = ParsedDocument(
        document_type="resume",
        source_type="text",
        provider_name="text",
        raw_content="  Leading backend projects at scale.  ",
        normalized_content="Leading backend projects at scale.",
        metadata={"candidate_name": "Alex"},
    )

    assert document_input.metadata["candidate_name"] == "Alex"
    assert parsed_document.provider_name == "text"
    assert parsed_document.normalized_content == "Leading backend projects at scale."


def test_registry_raises_clear_error_for_unknown_input_provider() -> None:
    registry = InputProviderRegistry()

    with pytest.raises(InputProviderNotFoundError, match="pdf"):
        registry.get("pdf")


@pytest.mark.anyio
async def test_ingestion_service_uses_text_provider_and_returns_parsed_document() -> None:
    registry = InputProviderRegistry()
    registry.register("text", TextInputProvider())
    service = IngestionService(registry)

    parsed_document = await service.ingest(
        DocumentInput(
            document_type="job_description",
            source_type="text",
            content="  Build reliable retrieval pipelines.  ",
            metadata={"company": "OpenAI"},
        )
    )

    assert parsed_document == ParsedDocument(
        document_type="job_description",
        source_type="text",
        provider_name="text",
        raw_content="  Build reliable retrieval pipelines.  ",
        normalized_content="Build reliable retrieval pipelines.",
        metadata={"company": "OpenAI"},
    )
