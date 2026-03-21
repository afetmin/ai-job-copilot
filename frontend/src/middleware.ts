import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";

const PROTECTED_PREFIXES = ["/workspace", "/results"];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (isValidSessionToken(sessionToken)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/workspace/:path*", "/results/:path*"],
};
