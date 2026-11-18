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
  targetPhone?: string;
  force?: boolean;
}): Promise<ReminderRunResult> {
  const gatewayUrl = options?.gatewayUrl || process.env.WHATSAPP_GATEWAY_URL || "http://127.0.0.1:3005";
  
  // Fecha actual en hora oficial de Perú (America/Lima) con formato "YYYY-MM-DD"
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const nowUtc = Date.UTC(ty, tm - 1, td);

  const cleanTargetPhone = options?.targetPhone ? options.targetPhone.replace(/\D/g, "") : null;

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

    // Si se filtró por un teléfono específico
    const clientPhoneDigits = client.whatsapp.replace(/\D/g, "");
    if (cleanTargetPhone && !clientPhoneDigits.includes(cleanTargetPhone)) {
      continue;
    }

    const [py, pm, pd] = nextPayStr.split("-").map(Number);
    const targetUtc = Date.UTC(py, pm - 1, pd);
    const diff = Math.round((targetUtc - nowUtc) / 86_400_000);

    // ¿Vence mañana (diff === 1)? ¿O vence hoy si se solicita (diff === 0)?
    const isDueTomorrow = diff === 1;
    const isDueToday = diff === 0;
    const isOverdue = diff < 0;

    if (!options?.force && !isDueTomorrow && !(options?.includeDueToday && isDueToday)) {
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
    if (!options?.force && map[targetMonthKey]?.status === "paid") {
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

    if (!options?.force && parsedJson?._lastReminderDate === todayStr && parsedJson?._lastReminderMonthKey === targetMonthKey) {
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
      isOverdue,
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

