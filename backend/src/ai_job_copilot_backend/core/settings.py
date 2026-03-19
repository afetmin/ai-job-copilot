"""从环境变量加载应用配置。"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """后端应用运行时配置。"""

    app_name: str = "AI Job Copilot API"
    service_name: str = "ai-job-copilot-api"
    environment: str = "development"

    model_config = SettingsConfigDict(
        env_prefix="AI_JOB_COPILOT_",
        env_file=".env",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """返回当前进程复用的配置实例。"""

    return Settings()
