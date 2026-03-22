import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { EntryGate } from "@/components/auth/entry-gate";
import { SESSION_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (isValidSessionToken(sessionToken)) {
    redirect("/workspace");
  }

  return <EntryGate />;
}
