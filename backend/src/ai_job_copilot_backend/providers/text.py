"""纯文本输入 Provider。"""

from ai_job_copilot_backend.providers.base import InputProvider
from ai_job_copilot_backend.schemas.documents import DocumentInput, ParsedDocument


class TextInputProvider(InputProvider[DocumentInput, ParsedDocument]):
    """处理文本粘贴场景的输入 Provider。"""

    provider_name = "text"

    async def parse(self, payload: DocumentInput) -> ParsedDocument:
        """把文本输入转换成统一的解析结果。"""

        return ParsedDocument(
            document_type=payload.document_type,
            source_type=payload.source_type,
            provider_name=self.provider_name,
            raw_content=payload.content,
            normalized_content=payload.content.strip(),
            metadata=payload.metadata,
        )
