"""系统级响应模型。"""

from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """健康检查接口返回的响应体。"""

    status: Literal["ok"]
    service: str
    environment: str
