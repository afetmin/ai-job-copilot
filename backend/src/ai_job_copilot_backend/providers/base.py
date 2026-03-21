"""供后续录入与检索功能复用的 Provider 抽象契约。"""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Sequence
from typing import Generic, TypeVar

InputPayloadT = TypeVar("InputPayloadT")
ParsedDocumentT = TypeVar("ParsedDocumentT")
EmbeddingInputT = TypeVar("EmbeddingInputT")
EmbeddingVectorT = TypeVar("EmbeddingVectorT")
GenerationInputT = TypeVar("GenerationInputT")
GenerationOutputT = TypeVar("GenerationOutputT")
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


class GenerationProvider(ABC, Generic[GenerationInputT, GenerationOutputT]):
    """根据提示词生成下游可消费的模型输出。"""

    provider_name: str

    @abstractmethod
    async def generate(self, payload: GenerationInputT) -> GenerationOutputT:
        """返回给定生成输入对应的模型输出。"""

        raise NotImplementedError

    def stream_generate(
        self,
        payload: GenerationInputT,
    ) -> AsyncIterator[GenerationOutputT]:
        """按流式方式返回给定生成输入对应的模型输出。"""

        raise NotImplementedError("当前 generation provider 不支持流式输出")


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
