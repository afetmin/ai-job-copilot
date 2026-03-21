import inspect

from ai_job_copilot_backend.providers.base import (
    EmbeddingProvider,
    GenerationProvider,
    InputProvider,
    RetrievalProvider,
)
from ai_job_copilot_backend.schemas.resume_review import (
    ResumeReviewRequest,
    ResumeReviewResponse,
    ResumeReviewSuggestion,
    ResumeReviewSuggestionSource,
)


def test_resume_review_schemas_validate_the_core_generation_contract() -> None:
    request = ResumeReviewRequest(
        resume_document_id="resume-001",
        job_description_document_id="jd-001",
    )
    response = ResumeReviewResponse(
        request_id="req-001",
        suggestions=[
            ResumeReviewSuggestion(
                issue="简历没有量化性能优化结果。",
                jd_alignment="JD 强调性能优化和结果导向，需要把影响量化写清楚。",
                rewrite_example="优化核心报表接口与缓存策略，接口 P95 延迟下降 40%，支撑高峰期稳定查询。",
                sources=[
                    ResumeReviewSuggestionSource(
                        document_id="resume-001",
                        chunk_id="resume-001:chunk:0",
                        document_type="resume",
                        excerpt="Reduced latency by 40% on a reporting endpoint.",
                    )
                ],
            )
        ],
    )

    assert request.suggestion_count == 5
    assert response.suggestions[0].issue == "简历没有量化性能优化结果。"
    assert response.suggestions[0].sources[0].document_type == "resume"


def test_provider_base_classes_define_the_expected_extension_points() -> None:
    assert inspect.isabstract(InputProvider)
    assert inspect.isabstract(EmbeddingProvider)
    assert inspect.isabstract(GenerationProvider)
    assert inspect.isabstract(RetrievalProvider)
    assert InputProvider.__abstractmethods__ == {"parse"}
    assert EmbeddingProvider.__abstractmethods__ == {"embed"}
    assert GenerationProvider.__abstractmethods__ == {"generate"}
    assert RetrievalProvider.__abstractmethods__ == {"retrieve"}
