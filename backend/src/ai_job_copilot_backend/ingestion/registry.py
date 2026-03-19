"""输入 Provider 的注册与查找能力。"""

from ai_job_copilot_backend.providers.base import InputProvider
from ai_job_copilot_backend.schemas.documents import DocumentInput, ParsedDocument


class InputProviderNotFoundError(LookupError):
    """未找到对应输入 Provider 时抛出的异常。"""


class InputProviderRegistry:
    """按输入类型管理可用的文档录入 Provider。"""

    def __init__(self) -> None:
        self._providers: dict[str, InputProvider[DocumentInput, ParsedDocument]] = {}

    def register(
        self,
        source_type: str,
        provider: InputProvider[DocumentInput, ParsedDocument],
    ) -> None:
        """注册指定输入类型对应的 Provider。"""

        self._providers[source_type] = provider

    def get(self, source_type: str) -> InputProvider[DocumentInput, ParsedDocument]:
        """根据输入类型返回对应 Provider。"""

        provider = self._providers.get(source_type)
        if provider is None:
            raise InputProviderNotFoundError(f"未注册 source_type={source_type} 的输入 Provider")
        return provider
