"""文档切块服务。"""

from __future__ import annotations

import json
from uuid import NAMESPACE_URL, uuid5

from langchain_text_splitters import RecursiveCharacterTextSplitter

from ai_job_copilot_backend.schemas.documents import ParsedDocument
from ai_job_copilot_backend.schemas.retrieval import DocumentChunk


class ChunkingService:
    """把标准化文档切成可索引的文本块。"""

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200) -> None:
        if chunk_size <= 0:
            raise ValueError("chunk_size 必须大于 0")
        if chunk_overlap < 0:
            raise ValueError("chunk_overlap 不能为负数")
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap 必须小于 chunk_size")

        # 采用 LangChain 官方 splitter，优先按段落和句子边界切分，
        # 保留我们自己的 document_id / chunk_id / metadata 约定。
        self._text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " "],
        )

    def build_document_id(
        self,
        parsed_document: ParsedDocument,
        document_id: str | None = None,
    ) -> str:
        """返回文档在索引中的稳定标识。"""

        if document_id is not None:
            return document_id

        payload = json.dumps(
            {
                "document_type": parsed_document.document_type,
                "source_type": parsed_document.source_type,
                "normalized_content": parsed_document.normalized_content,
                "metadata": parsed_document.metadata,
            },
            ensure_ascii=False,
            sort_keys=True,
        )
        suffix = uuid5(NAMESPACE_URL, payload).hex
        return f"{parsed_document.document_type}-{suffix}"

    def chunk_document(
        self,
        parsed_document: ParsedDocument,
        document_id: str | None = None,
    ) -> list[DocumentChunk]:
        """把文档切成顺序稳定的多个文本块。"""

        resolved_document_id = self.build_document_id(parsed_document, document_id)
        base_metadata = {
            **parsed_document.metadata,
            "document_type": parsed_document.document_type,
            "source_type": parsed_document.source_type,
            "provider_name": parsed_document.provider_name,
        }

        chunks: list[DocumentChunk] = []
        for chunk_index, chunk_content in enumerate(
            self._split_text(parsed_document.normalized_content)
        ):
            chunks.append(
                DocumentChunk(
                    document_id=resolved_document_id,
                    chunk_id=f"{resolved_document_id}:chunk:{chunk_index}",
                    document_type=parsed_document.document_type,
                    source_type=parsed_document.source_type,
                    chunk_index=chunk_index,
                    content=chunk_content,
                    metadata=base_metadata,
                )
            )
        return chunks

    def _split_text(self, text: str) -> list[str]:
        """使用 LangChain splitter 生成文本块。"""

        normalized_text = text.strip()
        if not normalized_text:
            return []
        return [
            chunk.strip()
            for chunk in self._text_splitter.split_text(normalized_text)
            if chunk.strip()
        ]
