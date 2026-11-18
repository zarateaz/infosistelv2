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
import { prisma } from "@/lib/prisma";

export async function requireSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    cookieStore.delete(SESSION_COOKIE);
    redirect("/taller-control/login");
  }

  // Brecha V3.3.1/V3.3.3: Invalidación del lado del servidor
  const admin = await prisma.admin.findUnique({
    where: { id: session.sub },
    select: { tokenVersion: true },
  });

  if (!admin || admin.tokenVersion !== session.v) {
    cookieStore.delete(SESSION_COOKIE);
    redirect("/taller-control/login");
  }

  return session;
}
