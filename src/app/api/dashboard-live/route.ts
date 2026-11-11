import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getDashboardLiveSnapshot } from "@/lib/dashboardLive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const admin = await prisma.admin.findUnique({
    where: { id: session.sub },
    select: { tokenVersion: true },
  });
  if (!admin || admin.tokenVersion !== session.v) {
    return NextResponse.json({ error: "Sesión expirada." }, { status: 401 });
  }

  const snapshot = await getDashboardLiveSnapshot();
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

