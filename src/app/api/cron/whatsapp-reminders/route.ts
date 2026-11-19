import { NextRequest, NextResponse } from "next/server";
import { runAutomatedInternetReminders } from "@/lib/whatsappAutoNotifier";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Verificación simple de seguridad para llamadas de cron
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET || process.env.JWT_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    // Permitir llamadas locales desde localhost sin token
    const host = req.headers.get("host") || "";
    const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    if (!isLocal) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
  }

  try {
    if (process.env.WHATSAPP_AUTO_REMINDER_ENABLED !== "true") {
      return NextResponse.json({
        ok: true,
        message: "Recordatorios automáticos suspendidos temporalmente (WHATSAPP_AUTO_REMINDER_ENABLED != 'true').",
        suspended: true,
      });
    }

    const searchParams = req.nextUrl.searchParams;
    const dryRun = searchParams.get("dryRun") === "true";
    const includeDueToday = searchParams.get("includeDueToday") !== "false";

    const result = await runAutomatedInternetReminders({
      dryRun,
      includeDueToday,
    });

    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al procesar recordatorios automáticos." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

