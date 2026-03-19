import inspect

from ai_job_copilot_backend.providers.base import (
    EmbeddingProvider,
    InputProvider,
    RetrievalProvider,
)
from ai_job_copilot_backend.schemas.interview import (
    InterviewPackRequest,
    InterviewPackResponse,
    InterviewQuestion,
)


def test_interview_pack_schemas_validate_the_core_generation_contract() -> None:
    request = InterviewPackRequest(
        resume_document_id="resume-001",
        job_description_document_id="jd-001",
    )
    response = InterviewPackResponse(
        request_id="req-001",
        questions=[
            InterviewQuestion(
                question="Tell me about a project where you improved performance.",
                follow_ups=["How did you measure the impact?"],
                reference_answer="I optimized a reporting endpoint and reduced latency by 40%.",
            )
        ],
    )

    assert request.question_count == 5
    assert response.questions[0].follow_ups == ["How did you measure the impact?"]


def test_provider_base_classes_define_the_expected_extension_points() -> None:
    assert inspect.isabstract(InputProvider)
    assert inspect.isabstract(EmbeddingProvider)
    assert inspect.isabstract(RetrievalProvider)
    assert InputProvider.__abstractmethods__ == {"parse"}
    assert EmbeddingProvider.__abstractmethods__ == {"embed"}
    assert RetrievalProvider.__abstractmethods__ == {"retrieve"}
