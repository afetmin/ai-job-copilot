import inspect

from ai_job_copilot_backend.providers.base import (
    EmbeddingProvider,
    GenerationProvider,
    InputProvider,
    RetrievalProvider,
)
from ai_job_copilot_backend.schemas.interview import (
    InterviewPackRequest,
    InterviewPackResponse,
    InterviewQuestion,
    InterviewQuestionSource,
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
                sources=[
                    InterviewQuestionSource(
                        document_id="resume-001",
                        chunk_id="resume-001:chunk:0",
                        document_type="resume",
                        excerpt="Reduced latency by 40% on a reporting endpoint.",
                    )
                ],
            )
        ],
    )

    assert request.question_count == 5
    assert response.questions[0].follow_ups == ["How did you measure the impact?"]
    assert response.questions[0].sources[0].document_type == "resume"


def test_provider_base_classes_define_the_expected_extension_points() -> None:
    assert inspect.isabstract(InputProvider)
    assert inspect.isabstract(EmbeddingProvider)
    assert inspect.isabstract(GenerationProvider)
    assert inspect.isabstract(RetrievalProvider)
    assert InputProvider.__abstractmethods__ == {"parse"}
    assert EmbeddingProvider.__abstractmethods__ == {"embed"}
    assert GenerationProvider.__abstractmethods__ == {"generate"}
    assert RetrievalProvider.__abstractmethods__ == {"retrieve"}
