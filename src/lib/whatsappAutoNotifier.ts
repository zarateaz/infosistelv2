import { prisma } from "@/lib/prisma";
import { daysUntil, parsePaidMonths, type PaidMonthsMap } from "@/app/taller-control/(panel)/cobranza-internet/cobranza";
import { dateToInputValue, todayInputValue } from "@/app/taller-control/(panel)/caja/month";
import { generateReminderMessage } from "@/lib/deepseek";

export interface ReminderRunResult {
  totalClientsChecked: number;
  eligibleTomorrow: number;
  sentCount: number;
  skippedAlreadySent: number;
  skippedPaid: number;
  failedCount: number;
  details: Array<{
    clientName: string;
    clientCode?: string | null;
    whatsapp: string;
    dueDate: string;
    daysDiff: number;
    status: "SENT" | "ALREADY_SENT_TODAY" | "ALREADY_PAID" | "GATEWAY_OFFLINE" | "ERROR";
    error?: string;
  }>;
}

/**
 * Revisa todos los clientes de internet y envía automáticamente por WhatsApp
 * el recordatorio preventivo a aquellos cuya fecha de pago vence MAÑANA (o hoy).
 * Incluye un retardo de seguridad (5 seg) entre envíos para no saturar la cuenta.
 */
export async function runAutomatedInternetReminders(options?: {
  includeDueToday?: boolean;
  dryRun?: boolean;
  gatewayUrl?: string;
}): Promise<ReminderRunResult> {
  const gatewayUrl = options?.gatewayUrl || process.env.WHATSAPP_GATEWAY_URL || "http://127.0.0.1:3005";
  const todayStr = todayInputValue();
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const now = new Date(Date.UTC(ty, tm - 1, td));

  const clients = await prisma.internetClient.findMany({
    orderBy: { nextPaymentDate: "asc" },
  });

  const result: ReminderRunResult = {
    totalClientsChecked: clients.length,
    eligibleTomorrow: 0,
    sentCount: 0,
    skippedAlreadySent: 0,
    skippedPaid: 0,
    failedCount: 0,
    details: [],
  };

  for (const client of clients) {
    const nextPayStr = dateToInputValue(client.nextPaymentDate);
    const startStr = dateToInputValue(client.startDate);
    const diff = daysUntil(nextPayStr, now);

    // ¿Vence mañana (diff === 1)? ¿O vence hoy si se solicita (diff === 0)?
    const isDueTomorrow = diff === 1;
    const isDueToday = Boolean(options?.includeDueToday && diff === 0);

    if (!isDueTomorrow && !isDueToday) {
      continue;
    }

    result.eligibleTomorrow++;

    const map: PaidMonthsMap = parsePaidMonths(
      client.paidMonths,
      startStr,
      nextPayStr,
      client.amount
    );

    // Verificar si el mes correspondiente a esa fecha ya está pagado
    const targetMonthKey = nextPayStr.slice(0, 7);
    if (map[targetMonthKey]?.status === "paid") {
      result.skippedPaid++;
      result.details.push({
        clientName: client.clientName,
        clientCode: client.clientCode,
        whatsapp: client.whatsapp,
        dueDate: nextPayStr,
        daysDiff: diff,
        status: "ALREADY_PAID",
      });
      continue;
    }

    // Verificar si ya se le envió aviso hoy (evita duplicados si el cron corre más de una vez)
    let parsedJson: any = {};
    try {
      parsedJson = client.paidMonths ? JSON.parse(client.paidMonths) : {};
    } catch {
      parsedJson = {};
    }

    if (parsedJson?._lastReminderDate === todayStr && parsedJson?._lastReminderMonthKey === targetMonthKey) {
      result.skippedAlreadySent++;
      result.details.push({
        clientName: client.clientName,
        clientCode: client.clientCode,
        whatsapp: client.whatsapp,
        dueDate: nextPayStr,
        daysDiff: diff,
        status: "ALREADY_SENT_TODAY",
      });
      continue;
    }

    // Si es dry run (modo prueba sin enviar)
    if (options?.dryRun) {
      result.sentCount++;
      result.details.push({
        clientName: client.clientName,
        clientCode: client.clientCode,
        whatsapp: client.whatsapp,
        dueDate: nextPayStr,
        daysDiff: diff,
        status: "SENT",
      });
      continue;
    }

    // Generar mensaje personalizado mediante DeepSeek / Plantilla oficial
    const messageText = await generateReminderMessage({
      clientName: client.clientName,
      clientCode: client.clientCode,
      galeria: client.galeria,
      router: client.router,
      portNumber: client.portNumber,
      amount: client.amount,
      dueDate: nextPayStr,
      isDueTomorrow,
      isDueToday,
      daysDiff: diff,
    });

    // Enviar a través del gateway de WhatsApp local
    try {
      const cleanPhone = client.whatsapp.replace(/\D/g, "");
      const fullPhone = cleanPhone.length === 9 ? `51${cleanPhone}` : cleanPhone;

      const response = await fetch(`${gatewayUrl}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fullPhone,
          message: messageText,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        result.failedCount++;
        result.details.push({
          clientName: client.clientName,
          clientCode: client.clientCode,
          whatsapp: client.whatsapp,
          dueDate: nextPayStr,
          daysDiff: diff,
          status: response.status === 503 ? "GATEWAY_OFFLINE" : "ERROR",
          error: errText || `Error HTTP ${response.status}`,
        });
        continue;
      }

      // Marcar recordatorio como enviado hoy
      parsedJson._lastReminderDate = todayStr;
      parsedJson._lastReminderMonthKey = targetMonthKey;
      await prisma.internetClient.update({
        where: { id: client.id },
        data: { paidMonths: JSON.stringify(parsedJson) },
      });

      result.sentCount++;
      result.details.push({
        clientName: client.clientName,
        clientCode: client.clientCode,
        whatsapp: client.whatsapp,
        dueDate: nextPayStr,
        daysDiff: diff,
        status: "SENT",
      });

      // Pausa de cortesía de 5 segundos entre clientes para proteger la línea
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (sendErr: any) {
      result.failedCount++;
      result.details.push({
        clientName: client.clientName,
        clientCode: client.clientCode,
        whatsapp: client.whatsapp,
        dueDate: nextPayStr,
        daysDiff: diff,
        status: "ERROR",
        error: sendErr?.message || "No se pudo conectar al Gateway de WhatsApp",
      });
    }
  }

  return result;
}

