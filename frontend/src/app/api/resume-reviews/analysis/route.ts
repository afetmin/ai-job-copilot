import { getResumeReviewAnalysisStreamEndpoint } from "@/lib/backend";
import {
  createResumeReviewAccessCookie,
  DEFAULT_RESUME_REVIEW_FREE_ANALYSES,
  RESUME_REVIEW_ACCESS_COOKIE_NAME,
  parseResumeReviewAccessCookie,
} from "@/lib/resume-review-access";

type RuntimeModelSettings = {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string | null;
};

type ResumeReviewAnalysisRouteRequest = {
  reviewId: string;
  requestId?: string | null;
  resumeDocumentId: string;
  jobDescriptionDocumentId: string;
  suggestionCount: number;
  targetRole?: string | null;
  localModelSettings?: RuntimeModelSettings | null;
};

function getCookieValue(request: Request, name: string): string | null {
  const rawCookie = request.headers.get("cookie");
  if (rawCookie === null) {
    return null;
  }

  return rawCookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ?? null;
}

function hasRuntimeModelSettings(
  settings: RuntimeModelSettings | null | undefined,
): settings is RuntimeModelSettings {
  return (
    settings !== null &&
    settings !== undefined &&
    settings.provider.trim() !== "" &&
    settings.apiKey.trim() !== "" &&
    settings.model.trim() !== ""
  );
}

function serializeCookie(value: string): string {
  const parts = [
    `${RESUME_REVIEW_ACCESS_COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 365}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function jsonError(status: number, message: string): Response {
  return Response.json(
    {
        error: {
          code: "ANALYSIS_PROXY_ERROR",
          message,
        },
    },
    { status },
  );
}

export async function POST(request: Request): Promise<Response> {
  let payload: ResumeReviewAnalysisRouteRequest;
  try {
    payload = (await request.json()) as ResumeReviewAnalysisRouteRequest;
  } catch {
    return jsonError(400, "request body must be valid JSON");
  }

  const runtimeModelSettings = hasRuntimeModelSettings(payload.localModelSettings)
    ? payload.localModelSettings
    : null;
  const accessCookie = parseResumeReviewAccessCookie(
    getCookieValue(request, RESUME_REVIEW_ACCESS_COOKIE_NAME),
  );
  const remainingFreeAnalyses =
    accessCookie?.remainingFreeAnalyses ?? DEFAULT_RESUME_REVIEW_FREE_ANALYSES;

  if (runtimeModelSettings === null && remainingFreeAnalyses <= 0) {
    return Response.json(
      {
        error: {
          code: "FREE_TIER_EXHAUSTED",
          message: "free analysis quota exhausted",
        },
      },
      { status: 403 },
    );
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(getResumeReviewAnalysisStreamEndpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify({
        review_id: payload.reviewId,
        request_id: payload.requestId ?? null,
        resume_document_id: payload.resumeDocumentId,
        job_description_document_id: payload.jobDescriptionDocumentId,
        suggestion_count: payload.suggestionCount,
        target_role: payload.targetRole ?? null,
        runtime_model_config:
          runtimeModelSettings === null
            ? null
            : {
                provider: runtimeModelSettings.provider,
                api_key: runtimeModelSettings.apiKey,
                model: runtimeModelSettings.model,
                base_url: runtimeModelSettings.baseUrl ?? "",
              },
      }),
    });
  } catch {
    return jsonError(502, "failed to reach resume review analysis backend");
  }

  const response = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      "content-type":
        upstreamResponse.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });

  if (runtimeModelSettings === null && upstreamResponse.ok) {
    response.headers.append(
      "set-cookie",
      serializeCookie(createResumeReviewAccessCookie(remainingFreeAnalyses - 1)),
    );
  }

  return response;
}
