"""FastAPI 应用入口。"""

from fastapi import FastAPI

from ai_job_copilot_backend.api.documents import router as documents_router
from ai_job_copilot_backend.api.resume_review import router as resume_review_router
from ai_job_copilot_backend.core.settings import Settings, get_settings
from ai_job_copilot_backend.schemas.health import HealthResponse


def create_app(settings: Settings | None = None) -> FastAPI:
    """创建并配置 FastAPI 应用。"""

    app_settings = settings or get_settings()
    app = FastAPI(title=app_settings.app_name)
    app.state.settings = app_settings

    @app.get("/healthz", response_model=HealthResponse, tags=["system"])
    def healthcheck() -> HealthResponse:
        """返回轻量级健康检查结果。"""

        return HealthResponse(
            status="ok",
            service=app_settings.service_name,
            environment=app_settings.environment,
        )

    app.include_router(resume_review_router)
    app.include_router(documents_router)

    return app


app = create_app()
