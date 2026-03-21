import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, createSessionToken } from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  await request.json();

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
