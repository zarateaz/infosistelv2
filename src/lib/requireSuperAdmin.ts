/**
 * lib/requireSuperAdmin.ts
 * Gate for the Usuarios section — proxy.ts only checks "is there a valid
 * admin session at all" (see proxy.ts), it doesn't know about roles. Pages
 * that manage other admin accounts call this to additionally require
 * role === "superadmin", redirecting ordinary admins back to the dashboard.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function requireSuperAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // proxy.ts already guarantees a valid session for anything under /taller-control
  // (except /taller-control/login) — a null session here means an expired/tampered
  // token slipped through a stale request, so send it through the same
  // re-auth path rather than a bare 403.
  if (!session) redirect("/taller-control/login");
  if (session.role !== "superadmin") redirect("/taller-control");

  return session;
}
