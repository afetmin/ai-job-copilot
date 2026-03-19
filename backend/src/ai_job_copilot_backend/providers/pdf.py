"""PDF 输入 Provider。"""

from pathlib import Path

import fitz

from ai_job_copilot_backend.providers.base import InputProvider
from ai_job_copilot_backend.schemas.documents import DocumentInput, ParsedDocument


class PDFParseError(RuntimeError):
    """PDF 解析失败时抛出的异常。"""


class PDFInputProvider(InputProvider[DocumentInput, ParsedDocument]):
    """基于 PyMuPDF 的 PDF 输入 Provider。"""

    provider_name = "pdf"

    async def parse(self, payload: DocumentInput) -> ParsedDocument:
        """把 PDF 文件解析成统一的文档结构。"""

        pdf_path = Path(payload.content)

        try:
            with fitz.open(pdf_path) as document:
                raw_content = "".join(page.get_text() for page in document)
                page_count = document.page_count
        except Exception as exc:  # pragma: no cover - 第三方库异常类型较多，统一包装
            raise PDFParseError(f"无法解析 PDF 文件：{pdf_path}") from exc

        normalized_content = self._normalize_extracted_text(raw_content)
        if not normalized_content:
            raise PDFParseError(f"PDF 未提取到可用文本：{pdf_path}")

        metadata = {
            **payload.metadata,
            "source_path": str(pdf_path),
            "page_count": str(page_count),
        }
        return ParsedDocument(
            document_type=payload.document_type,
            source_type=payload.source_type,
            provider_name=self.provider_name,
            raw_content=raw_content,
            normalized_content=normalized_content,
            metadata=metadata,
        )

    @staticmethod
    def _normalize_extracted_text(raw_content: str) -> str:
        """清理 PDF 提取结果中的多余空白与空行。"""

        lines = [line.strip() for line in raw_content.splitlines() if line.strip()]
        return "\n".join(lines)
