import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (isValidSessionToken(sessionToken)) {
    redirect("/workspace");
  }

  redirect("/login");
}
