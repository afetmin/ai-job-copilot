import { NextResponse } from "next/server";

import {
  buildResumeReviewAccessResponse,
  DEFAULT_RESUME_REVIEW_FREE_ANALYSES,
  RESUME_REVIEW_ACCESS_COOKIE_NAME,
} from "@/lib/resume-review-access";
import {
  createResumeReviewAccessCookieHeader,
  parseResumeReviewAccessCookie,
} from "@/lib/resume-review-access-cookie";

function readCookieHeader(request: Request): string | null {
  return request.headers.get("cookie");
}

function createAccessResponse(remainingFreeAnalyses: number): NextResponse {
  return NextResponse.json(
    buildResumeReviewAccessResponse(remainingFreeAnalyses),
    { status: 200 },
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  const cookieValue = parseResumeReviewAccessCookie(
    readCookieHeader(request)?.match(
      new RegExp(`(?:^|; )${RESUME_REVIEW_ACCESS_COOKIE_NAME}=([^;]*)`),
    )?.[1] ?? null,
  );

  const response = createAccessResponse(
    cookieValue?.remainingFreeAnalyses ?? DEFAULT_RESUME_REVIEW_FREE_ANALYSES,
  );

  if (cookieValue === null) {
    response.cookies.set(createResumeReviewAccessCookieHeader());
  }

  return response;
}
