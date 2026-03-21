import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  getDocumentFileIngestEndpoint,
  getDocumentTextIngestEndpoint,
} from "@/lib/backend";

const DEFAULT_QUESTION_COUNT = 5;

type CreateInterviewPackErrorCode = "VALIDATION_ERROR" | "UPSTREAM_ERROR";

function jsonError(
  status: number,
  code: CreateInterviewPackErrorCode,
  message: string,
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

function getString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function getFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  if (!(value instanceof File)) {
    return null;
  }

  if (value.name === "" && value.size === 0) {
    return null;
  }

  return value;
}

function parseQuestionCount(rawValue: string | null): number | null {
  if (rawValue === null || rawValue.trim() === "") {
    return DEFAULT_QUESTION_COUNT;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    return null;
  }

  return parsed;
}

function normalizeTargetRole(rawValue: string | null): string | null {
  if (rawValue === null) {
    return null;
  }

  const trimmed = rawValue.trim();
  return trimmed === "" ? null : trimmed;
}

function validationError(message: string): NextResponse {
  return jsonError(400, "VALIDATION_ERROR", message);
}

function getDocumentInput(
  formData: FormData,
  textKey: string,
  fileKey: string,
): { text: string | null; file: File | null } {
  return {
    text: getString(formData, textKey),
    file: getFile(formData, fileKey),
  };
}

function validateDocumentInput(
  input: { text: string | null; file: File | null },
  label: "resume" | "job description",
): NextResponse | null {
  if (input.file === null && (input.text === null || input.text.trim() === "")) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      `${label} must include either text or file input`,
    );
  }

  return null;
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body = (await response.json()) as unknown;
    if (body !== null && typeof body === "object") {
      return body as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

async function ingestDocument(
  documentType: "resume" | "job_description",
  label: "resume" | "job description",
  input: { text: string | null; file: File | null },
): Promise<string | NextResponse> {
  if (input.file !== null) {
    const upstreamFormData = new FormData();
    upstreamFormData.append("document_type", documentType);
    upstreamFormData.append("file", input.file);

    let response: Response;
    try {
      response = await fetch(getDocumentFileIngestEndpoint(), {
        method: "POST",
        body: upstreamFormData,
      });
    } catch {
      return jsonError(502, "UPSTREAM_ERROR", `${label} ingestion failed`);
    }

    const payload = await readJson(response);
    if (!response.ok) {
      return jsonError(502, "UPSTREAM_ERROR", `${label} ingestion failed`);
    }

    const documentId = payload?.document_id;
    if (typeof documentId !== "string" || documentId.trim() === "") {
      return jsonError(502, "UPSTREAM_ERROR", `${label} ingestion failed`);
    }

    return documentId;
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(getDocumentTextIngestEndpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        document_type: documentType,
        content: input.text,
        metadata: {},
      }),
    });
  } catch {
    return jsonError(502, "UPSTREAM_ERROR", `${label} ingestion failed`);
  }

  const payload = await readJson(upstreamResponse);
  if (!upstreamResponse.ok) {
    return jsonError(502, "UPSTREAM_ERROR", `${label} ingestion failed`);
  }

  const documentId = payload?.document_id;
  if (typeof documentId !== "string" || documentId.trim() === "") {
    return jsonError(502, "UPSTREAM_ERROR", `${label} ingestion failed`);
  }

  return documentId;
}

export async function POST(request: Request): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return validationError("request body must be valid multipart form data");
  }

  const requestId = randomUUID();

  const resumeInput = getDocumentInput(formData, "resumeText", "resumeFile");
  const jobDescriptionInput = getDocumentInput(
    formData,
    "jobDescriptionText",
    "jobDescriptionFile",
  );

  const resumeValidationError = validateDocumentInput(resumeInput, "resume");
  if (resumeValidationError !== null) {
    return resumeValidationError;
  }

  const jobDescriptionValidationError = validateDocumentInput(
    jobDescriptionInput,
    "job description",
  );
  if (jobDescriptionValidationError !== null) {
    return jobDescriptionValidationError;
  }

  const questionCount = parseQuestionCount(getString(formData, "questionCount"));
  if (questionCount === null) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "questionCount must be an integer between 1 and 20",
    );
  }

  const targetRole = normalizeTargetRole(getString(formData, "targetRole"));

  const resumeDocumentIdResult = await ingestDocument("resume", "resume", resumeInput);
  if (typeof resumeDocumentIdResult !== "string") {
    return resumeDocumentIdResult;
  }

  const jobDescriptionDocumentIdResult = await ingestDocument(
    "job_description",
    "job description",
    jobDescriptionInput,
  );
  if (typeof jobDescriptionDocumentIdResult !== "string") {
    return jobDescriptionDocumentIdResult;
  }

  const streamPayload = {
    resume_document_id: resumeDocumentIdResult,
    job_description_document_id: jobDescriptionDocumentIdResult,
    question_count: questionCount,
    target_role: targetRole,
  };

  return NextResponse.json({
    requestId,
    resumeDocumentId: resumeDocumentIdResult,
    jobDescriptionDocumentId: jobDescriptionDocumentIdResult,
    questionCount,
    targetRole,
    streamPayload,
  });
}
