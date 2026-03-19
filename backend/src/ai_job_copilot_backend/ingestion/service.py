"""统一文档录入调度服务。"""

from ai_job_copilot_backend.ingestion.registry import InputProviderRegistry
from ai_job_copilot_backend.schemas.documents import DocumentInput, ParsedDocument


class IngestionService:
    """根据输入类型调度对应 Provider 完成文档录入。"""

    def __init__(self, registry: InputProviderRegistry) -> None:
        self._registry = registry

    async def ingest(self, document_input: DocumentInput) -> ParsedDocument:
        """执行一次文档录入并返回标准化后的结果。"""

        provider = self._registry.get(document_input.source_type)
        parsed_document = await provider.parse(document_input)
        return parsed_document
