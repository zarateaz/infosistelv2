/**
 * lib/requireSession.ts
 * Shared "give me the current admin or send them to login" check — proxy.ts
 * already guarantees a valid session for anything under /taller-control
 * (except the login page), so a null session here means an expired/tampered
 * token slipped through a stale request. Role-specific gates (see
 * requireSuperAdmin.ts) build on top of this.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function requireSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) redirect("/taller-control/login");
  return session;
}
