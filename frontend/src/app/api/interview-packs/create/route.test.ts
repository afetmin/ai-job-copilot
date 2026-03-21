import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDocumentFileIngestEndpoint,
  getDocumentTextIngestEndpoint,
} from "@/lib/backend";

import { POST } from "./route";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function buildRequest(formData: FormData): Request {
  return new Request("http://localhost/api/interview-packs/create", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/interview-packs/create", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ["resume", { jobDescriptionText: "Backend role requires strong systems design." }],
    ["job description", { resumeText: "Built hiring workflows and interview tooling." }],
  ])(
    "returns a validation error when %s input is missing",
    async (_label, partialInputs) => {
      const formData = new FormData();
      formData.append("questionCount", "5");
      formData.append("targetRole", "Backend Engineer");

      if ("resumeText" in partialInputs) {
        formData.append("resumeText", partialInputs.resumeText);
      }
      if ("jobDescriptionText" in partialInputs) {
        formData.append("jobDescriptionText", partialInputs.jobDescriptionText);
      }

      const response = await POST(buildRequest(formData));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: `${_label} must include either text or file input`,
        },
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("calls the text and file ingestion endpoints in order and returns the generation payload", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ document_id: "resume-doc-1" }))
      .mockResolvedValueOnce(jsonResponse({ document_id: "jd-doc-1" }));

    const formData = new FormData();
    formData.append("resumeText", "Built hiring workflows and interview tooling.");
    formData.append(
      "jobDescriptionFile",
      new File(["job description pdf"], "jd.pdf", { type: "application/pdf" }),
    );
    formData.append("questionCount", "5");
    formData.append("targetRole", "Backend Engineer");

    const request = {
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as Request;

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      requestId: expect.any(String),
      resumeDocumentId: "resume-doc-1",
      jobDescriptionDocumentId: "jd-doc-1",
      questionCount: 5,
      targetRole: "Backend Engineer",
      streamPayload: {
        resume_document_id: "resume-doc-1",
        job_description_document_id: "jd-doc-1",
        question_count: 5,
        target_role: "Backend Engineer",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      getDocumentTextIngestEndpoint(),
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      getDocumentFileIngestEndpoint(),
      expect.objectContaining({
        method: "POST",
      }),
    );

    const firstCallBody = fetchMock.mock.calls[0]?.[1]?.body;
    expect(JSON.parse(firstCallBody as string)).toEqual({
      document_type: "resume",
      content: "Built hiring workflows and interview tooling.",
      metadata: {},
    });

    const secondCallBody = fetchMock.mock.calls[1]?.[1]?.body as FormData;
    expect(secondCallBody).toBeInstanceOf(FormData);
    expect(secondCallBody.get("document_type")).toBe("job_description");
    expect(secondCallBody.get("file")).toBeInstanceOf(File);
  });

  it("treats an empty file field as absent and uses text ingestion", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ document_id: "resume-doc-1" }))
      .mockResolvedValueOnce(jsonResponse({ document_id: "jd-doc-1" }));

    const formData = new FormData();
    formData.append("resumeText", "Built hiring workflows and interview tooling.");
    formData.append("jobDescriptionText", "Backend role requires strong systems design.");
    formData.append("jobDescriptionFile", new File([], ""));
    formData.append("questionCount", "5");

    const request = {
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as Request;

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      getDocumentTextIngestEndpoint(),
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      getDocumentTextIngestEndpoint(),
      expect.objectContaining({
        method: "POST",
      }),
    );

    const secondCallBody = fetchMock.mock.calls[1]?.[1]?.body as string;
    expect(JSON.parse(secondCallBody)).toEqual({
      document_type: "job_description",
      content: "Backend role requires strong systems design.",
      metadata: {},
    });
  });

  it("returns a controlled validation error when formData parsing fails", async () => {
    const request = {
      formData: vi.fn().mockRejectedValue(new TypeError("invalid body")),
    } as unknown as Request;

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "request body must be valid multipart form data",
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes upstream 4xx failures into a predictable JSON error", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ document_id: "resume-doc-1" }))
      .mockResolvedValueOnce(
        jsonResponse({ detail: "missing metadata" }, 422),
      );

    const formData = new FormData();
    formData.append("resumeText", "Built hiring workflows and interview tooling.");
    formData.append("jobDescriptionText", "Backend role requires strong systems design.");
    formData.append("questionCount", "5");

    const response = await POST(buildRequest(formData));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: "UPSTREAM_ERROR",
        message: "job description ingestion failed",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("normalizes upstream failures into a predictable JSON error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: "backend exploded" }, 500),
    );

    const formData = new FormData();
    formData.append("resumeText", "Built hiring workflows and interview tooling.");
    formData.append("jobDescriptionText", "Backend role requires strong systems design.");
    formData.append("questionCount", "5");

    const response = await POST(buildRequest(formData));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: "UPSTREAM_ERROR",
        message: "resume ingestion failed",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
