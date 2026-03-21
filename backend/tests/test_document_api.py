from pathlib import Path

import fitz
import pytest
from fastapi.testclient import TestClient

from ai_job_copilot_backend.api.documents import (
    get_document_retrieval_service,
    get_document_retrieval_service_factory,
)
from ai_job_copilot_backend.main import create_app
from ai_job_copilot_backend.schemas.documents import ParsedDocument
from ai_job_copilot_backend.schemas.retrieval import IndexedDocument


def _create_pdf(path: Path, text: str) -> None:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    document.save(path)
    document.close()


class StubDocumentRetrievalService:
    async def index_document(self, parsed_document: ParsedDocument) -> IndexedDocument:
        if parsed_document.source_type == "text":
            if parsed_document.document_type == "resume":
                assert parsed_document.normalized_content == "Built reliable hiring workflows."
                metadata = parsed_document.metadata
            else:
                assert parsed_document.document_type == "job_description"
                assert parsed_document.normalized_content == "Build reliable hiring workflows."
                metadata = {"filename": "jd.txt", **parsed_document.metadata}
            return IndexedDocument(
                document_id="doc-123",
                document_type=parsed_document.document_type,
                source_type=parsed_document.source_type,
                chunk_count=2,
                metadata=metadata,
            )

        assert parsed_document.document_type == "resume"
        assert parsed_document.source_type == "pdf"
        assert parsed_document.metadata["filename"] == "resume.pdf"
        assert parsed_document.metadata["page_count"] == "1"
        assert parsed_document.normalized_content == "Candidate Summary\nBuilt hiring copilots."

        return IndexedDocument(
            document_id="doc-123",
            document_type=parsed_document.document_type,
            source_type=parsed_document.source_type,
            chunk_count=2,
            metadata={**parsed_document.metadata, "indexed_by": "retrieval-stub"},
        )


def test_ingest_text_returns_indexed_document_summary() -> None:
    app = create_app()
    app.dependency_overrides[get_document_retrieval_service] = StubDocumentRetrievalService
    client = TestClient(app)

    response = client.post(
        "/api/documents/ingest-text",
        json={
            "document_type": "resume",
            "content": "  Built reliable hiring workflows.  ",
            "metadata": {"candidate_name": "Alex"},
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "document_id": "doc-123",
        "document_type": "resume",
        "source_type": "text",
        "chunk_count": 2,
        "metadata": {"candidate_name": "Alex"},
    }


def test_ingest_file_returns_indexed_metadata_for_pdf_upload(tmp_path: Path) -> None:
    pdf_path = tmp_path / "resume.pdf"
    _create_pdf(pdf_path, "Candidate Summary\nBuilt hiring copilots.")

    app = create_app()
    app.dependency_overrides[get_document_retrieval_service_factory] = (
        lambda: StubDocumentRetrievalService
    )
    client = TestClient(app)

    with pdf_path.open("rb") as pdf_file:
        response = client.post(
            "/api/documents/ingest-file",
            data={
                "document_type": "resume",
                "metadata": '{"candidate_name":"Alex","filename":"malicious.txt"}',
            },
            files={"file": ("resume.pdf", pdf_file.read(), "application/pdf")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["document_id"] == "doc-123"
    assert body["document_type"] == "resume"
    assert body["source_type"] == "pdf"
    assert body["chunk_count"] == 2
    assert body["metadata"]["filename"] == "resume.pdf"
    assert body["metadata"]["candidate_name"] == "Alex"
    assert body["metadata"]["page_count"] == "1"
    assert body["metadata"]["indexed_by"] == "retrieval-stub"
    assert body["metadata"]["source_path"].endswith(".pdf")


def test_ingest_file_returns_indexed_metadata_for_text_upload() -> None:
    app = create_app()
    app.dependency_overrides[get_document_retrieval_service_factory] = (
        lambda: StubDocumentRetrievalService
    )
    client = TestClient(app)

    response = client.post(
        "/api/documents/ingest-file",
        data={
            "document_type": "job_description",
            "metadata": '{"team":"platform"}',
        },
        files={"file": ("jd.txt", b"Build reliable hiring workflows.", "text/plain")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "document_id": "doc-123",
        "document_type": "job_description",
        "source_type": "text",
        "chunk_count": 2,
        "metadata": {
            "filename": "jd.txt",
            "team": "platform",
        },
    }


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("resume.txt", "application/pdf"),
        ("resume.pdf", "text/plain"),
    ],
)
def test_ingest_file_rejects_non_pdf_filename_or_content_type(
    tmp_path: Path,
    filename: str,
    content_type: str,
) -> None:
    app = create_app()
    client = TestClient(app)

    file_bytes = b"plain text content"
    if content_type == "application/pdf":
        pdf_path = tmp_path / "upload.pdf"
        _create_pdf(pdf_path, "Candidate Summary\nBuilt hiring copilots.")
        file_bytes = pdf_path.read_bytes()

    response = client.post(
        "/api/documents/ingest-file",
        data={"document_type": "resume"},
        files={"file": (filename, file_bytes, content_type)},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "only PDF or TXT files are supported"}


def test_ingest_file_returns_400_for_non_utf8_text_upload() -> None:
    app = create_app()
    client = TestClient(app, raise_server_exceptions=False)

    response = client.post(
        "/api/documents/ingest-file",
        data={"document_type": "job_description"},
        files={"file": ("jd.txt", b"\xff\xfe\x00\x00", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "only UTF-8 text files are supported"}


def test_ingest_file_returns_400_for_corrupt_pdf_upload() -> None:
    app = create_app()
    client = TestClient(app, raise_server_exceptions=False)

    response = client.post(
        "/api/documents/ingest-file",
        data={"document_type": "resume"},
        files={"file": ("resume.pdf", b"not a real pdf", "application/pdf")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "unable to parse uploaded PDF"}
