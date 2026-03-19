"""供后续录入与检索功能复用的 Provider 抽象契约。"""

from abc import ABC, abstractmethod
from collections.abc import Sequence
from typing import Generic, TypeVar

InputPayloadT = TypeVar("InputPayloadT")
ParsedDocumentT = TypeVar("ParsedDocumentT")
EmbeddingInputT = TypeVar("EmbeddingInputT")
EmbeddingVectorT = TypeVar("EmbeddingVectorT")
RetrievalQueryT = TypeVar("RetrievalQueryT")
RetrievalResultT = TypeVar("RetrievalResultT")


class InputProvider(ABC, Generic[InputPayloadT, ParsedDocumentT]):
    """把原始输入解析成标准化文档结构。"""

    provider_name: str

    @abstractmethod
    async def parse(self, payload: InputPayloadT) -> ParsedDocumentT:
        """把输入载荷转换成标准化后的解析结果。"""

        raise NotImplementedError


class EmbeddingProvider(ABC, Generic[EmbeddingInputT, EmbeddingVectorT]):
    """把标准化内容转换成向量表示。"""

    provider_name: str

    @abstractmethod
    async def embed(
        self,
        values: Sequence[EmbeddingInputT],
    ) -> Sequence[EmbeddingVectorT]:
        """返回给定内容对应的向量结果。"""

        raise NotImplementedError


class RetrievalProvider(ABC, Generic[RetrievalQueryT, RetrievalResultT]):
    """为下游生成请求加载相关上下文。"""

    provider_name: str

    @abstractmethod
    async def retrieve(
        self,
        query: RetrievalQueryT,
        limit: int = 5,
    ) -> RetrievalResultT:
        """根据查询参数返回检索结果。"""

        raise NotImplementedError
