import { getResumeReviewChatStreamEndpoint } from "@/lib/backend";
import { getDefaultResumeReviewFreeAnalyses } from "@/lib/env";
import {
  RESUME_REVIEW_ACCESS_COOKIE_NAME,
} from "@/lib/resume-review-access";
import {
  createResumeReviewAccessCookie,
  parseResumeReviewAccessCookie,
} from "@/lib/resume-review-access-cookie";

type RuntimeModelSettings = {
  protocol: string;
  apiKey: string;
  model: string;
  baseUrl?: string | null;
};

type ChatMessageInput = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ResumeReviewChatRouteRequest = {
  reviewId: string;
  requestId?: string | null;
  resumeDocumentId: string;
  jobDescriptionDocumentId: string;
  suggestionCount: number;
  targetRole?: string | null;
  messages: ChatMessageInput[];
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
  if (typeof settings !== "object" || settings === null) {
    return false;
  }

  const { protocol, apiKey, model } = settings;
  return (
    typeof protocol === "string" &&
    typeof apiKey === "string" &&
    typeof model === "string" &&
    protocol.trim() !== "" &&
    apiKey.trim() !== "" &&
    model.trim() !== ""
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
        code: "CHAT_PROXY_ERROR",
        message,
      },
    },
    { status },
  );
}

export async function POST(request: Request): Promise<Response> {
  let payload: ResumeReviewChatRouteRequest;
  try {
    payload = (await request.json()) as ResumeReviewChatRouteRequest;
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
    accessCookie?.remainingFreeAnalyses ?? getDefaultResumeReviewFreeAnalyses();

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
    upstreamResponse = await fetch(getResumeReviewChatStreamEndpoint(), {
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
        messages: payload.messages,
        runtime_model_config:
          runtimeModelSettings === null
            ? null
            : {
                protocol: runtimeModelSettings.protocol,
                api_key: runtimeModelSettings.apiKey,
                model: runtimeModelSettings.model,
                base_url: runtimeModelSettings.baseUrl ?? "",
              },
      }),
    });
  } catch {
    return jsonError(502, "failed to reach resume review chat backend");
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
