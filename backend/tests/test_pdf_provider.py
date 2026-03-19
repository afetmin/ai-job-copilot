from pathlib import Path

import fitz
import pytest

from ai_job_copilot_backend.ingestion.registry import InputProviderRegistry
from ai_job_copilot_backend.ingestion.service import IngestionService
from ai_job_copilot_backend.providers.pdf import PDFInputProvider, PDFParseError
from ai_job_copilot_backend.schemas.documents import DocumentInput


def _create_pdf(path: Path, text: str) -> None:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    document.save(path)
    document.close()


def _find_real_pdf_files() -> list[Path]:
    return sorted(Path(__file__).parent.glob("*.pdf"))


@pytest.mark.anyio
async def test_pdf_input_provider_extracts_text_via_ingestion_service(
    tmp_path: Path,
) -> None:
    pdf_path = tmp_path / "resume.pdf"
    _create_pdf(pdf_path, "Candidate Summary\nBuilt hiring copilots.")

    registry = InputProviderRegistry()
    registry.register("pdf", PDFInputProvider())
    service = IngestionService(registry)

    parsed_document = await service.ingest(
        DocumentInput(
            document_type="resume",
            source_type="pdf",
            content=str(pdf_path),
            metadata={"filename": "resume.pdf"},
        )
    )

    assert parsed_document.provider_name == "pdf"
    assert parsed_document.raw_content == "Candidate Summary\nBuilt hiring copilots.\n"
    assert parsed_document.normalized_content == "Candidate Summary\nBuilt hiring copilots."
    assert parsed_document.metadata == {
        "filename": "resume.pdf",
        "page_count": "1",
        "source_path": str(pdf_path),
    }


@pytest.mark.anyio
async def test_pdf_input_provider_raises_clear_error_for_invalid_pdf(
    tmp_path: Path,
) -> None:
    fake_pdf_path = tmp_path / "broken.pdf"
    fake_pdf_path.write_text("this is not a real pdf", encoding="utf-8")

    provider = PDFInputProvider()

    with pytest.raises(PDFParseError, match="broken.pdf"):
        await provider.parse(
            DocumentInput(
                document_type="job_description",
                source_type="pdf",
                content=str(fake_pdf_path),
            )
        )


@pytest.mark.anyio
async def test_pdf_input_provider_can_parse_real_pdf_files_in_tests_directory() -> None:
    pdf_files = _find_real_pdf_files()
    if not pdf_files:
        pytest.skip("backend/tests 目录下没有可供回归验证的 PDF 文件")

    registry = InputProviderRegistry()
    registry.register("pdf", PDFInputProvider())
    service = IngestionService(registry)

    for pdf_path in pdf_files:
        parsed_document = await service.ingest(
            DocumentInput(
                document_type="job_description",
                source_type="pdf",
                content=str(pdf_path),
                metadata={"filename": pdf_path.name},
            )
        )

        assert parsed_document.provider_name == "pdf"
        assert parsed_document.metadata["filename"] == pdf_path.name
        assert parsed_document.metadata["source_path"] == str(pdf_path)
        assert parsed_document.metadata["page_count"].isdigit()
        assert parsed_document.normalized_content
