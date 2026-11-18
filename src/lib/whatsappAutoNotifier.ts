import { prisma } from "@/lib/prisma";
import { parsePaidMonths, type PaidMonthsMap } from "@/app/taller-control/(panel)/cobranza-internet/cobranza";
import { dateToInputValue } from "@/app/taller-control/(panel)/caja/month";
import { generateReminderMessage } from "@/lib/deepseek";

export interface ReminderRunResult {
  totalClientsChecked: number;
  eligibleTotal: number;
  eligibleOverdue: number;
  eligibleTodayOrTomorrow: number;
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
    unpaidMonthsCount: number;
    totalDebt: number;
    status: "SENT" | "ALREADY_SENT_TODAY" | "ALREADY_PAID" | "GATEWAY_OFFLINE" | "ERROR";
    error?: string;
  }>;
}

/**
 * Revisa todos los clientes de internet en la base de datos y envía por WhatsApp
 * un mensaje formal de cobranza a:
 *  1. Clientes con deuda vencida (1, 2 o más meses vencidos).
 *  2. Clientes cuya fecha de pago vence HOY o MAÑANA.
 *
 * Reglas de seguridad:
 *  - 1 solo mensaje por día por cliente (_lastReminderDate === todayStr).
 *  - Pausa de 5 segundos entre envíos para proteger la línea de WhatsApp.
 *  - Cuentas oficiales de pago: Yape 1, Yape 2 y Pago físico en Huancayo.
 */
export async function runAutomatedInternetReminders(options?: {
  includeDueToday?: boolean;
  dryRun?: boolean;
  gatewayUrl?: string;
  targetPhone?: string;
  force?: boolean;
}): Promise<ReminderRunResult> {
  const gatewayUrl = options?.gatewayUrl || process.env.WHATSAPP_GATEWAY_URL || "http://127.0.0.1:3005";

  // Fecha actual oficial en Perú (America/Lima) "YYYY-MM-DD"
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const currentMonthKey = todayStr.slice(0, 7);
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const nowUtc = Date.UTC(ty, tm - 1, td);

  const cleanTargetPhone = options?.targetPhone ? options.targetPhone.replace(/\D/g, "") : null;

  const clients = await prisma.internetClient.findMany({
    orderBy: { nextPaymentDate: "asc" },
  });

  const result: ReminderRunResult = {
    totalClientsChecked: clients.length,
    eligibleTotal: 0,
    eligibleOverdue: 0,
    eligibleTodayOrTomorrow: 0,
    sentCount: 0,
    skippedAlreadySent: 0,
    skippedPaid: 0,
    failedCount: 0,
    details: [],
  };

  for (const client of clients) {
    const nextPayStr = dateToInputValue(client.nextPaymentDate);
    const startStr = dateToInputValue(client.startDate);

    // Filtrar por teléfono específico si se solicitó en el comando
    const clientPhoneDigits = client.whatsapp.replace(/\D/g, "");
    if (cleanTargetPhone && !clientPhoneDigits.includes(cleanTargetPhone)) {
      continue;
    }

    const [py, pm, pd] = nextPayStr.split("-").map(Number);
    const targetUtc = Date.UTC(py, pm - 1, pd);
    const diff = Math.round((targetUtc - nowUtc) / 86_400_000);

    // Mapeo de meses pagados
    const map: PaidMonthsMap = parsePaidMonths(
      client.paidMonths,
      startStr,
      nextPayStr,
      client.amount
    );

    // Calcular meses impagos desde inicio hasta el mes actual
    const [sy, sm] = startStr.split("-").map(Number);
    let cy = sy;
    let cm = sm;
    const unpaidMonths: string[] = [];

    while (true) {
      const k = `${cy}-${String(cm).padStart(2, "0")}`;
      if (k > currentMonthKey) break;
      if (map[k]?.status !== "paid") {
        unpaidMonths.push(k);
      }
      cm++;
      if (cm > 12) {
        cm = 1;
        cy++;
      }
      if (cy > ty + 2) break;
    }

    const isDueTomorrow = diff === 1;
    const isDueToday = diff === 0;
    const isOverdue = diff < 0 || (unpaidMonths.length > 0 && unpaidMonths[0] < currentMonthKey);

    // Si no tiene deuda y no vence hoy/mañana, y no se especificó --force, está al día
    if (!options?.force && !isOverdue && !isDueToday && !isDueTomorrow) {
      result.skippedPaid++;
      continue;
    }

    // Calcular meses y monto de deuda
    const unpaidMonthsCount = Math.max(
      unpaidMonths.length,
      isDueToday || isDueTomorrow || isOverdue ? 1 : 0
    );
    const totalDebt = unpaidMonthsCount * client.amount;

    result.eligibleTotal++;
    if (isOverdue) result.eligibleOverdue++;
    if (isDueToday || isDueTomorrow) result.eligibleTodayOrTomorrow++;

    // Verificar si ya se le envió aviso hoy (regla estricta: 1 mensaje al día por cliente)
    let parsedJson: any = {};
    try {
      parsedJson = client.paidMonths ? JSON.parse(client.paidMonths) : {};
    } catch {
      parsedJson = {};
    }

    if (!options?.force && parsedJson?._lastReminderDate === todayStr) {
      result.skippedAlreadySent++;
      result.details.push({
        clientName: client.clientName,
        clientCode: client.clientCode,
        whatsapp: client.whatsapp,
        dueDate: nextPayStr,
        daysDiff: diff,
        unpaidMonthsCount,
        totalDebt,
        status: "ALREADY_SENT_TODAY",
      });
      continue;
    }

    // Modo simulación (--dry-run)
    if (options?.dryRun) {
      result.sentCount++;
      result.details.push({
        clientName: client.clientName,
        clientCode: client.clientCode,
        whatsapp: client.whatsapp,
        dueDate: nextPayStr,
        daysDiff: diff,
        unpaidMonthsCount,
        totalDebt,
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
      totalDebt,
      unpaidMonthsCount,
      dueDate: nextPayStr,
      isDueTomorrow,
      isDueToday,
      isOverdue,
      daysDiff: diff,
    });

    // Enviar a través del gateway de WhatsApp local (Baileys)
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
          unpaidMonthsCount,
          totalDebt,
          status: response.status === 503 ? "GATEWAY_OFFLINE" : "ERROR",
          error: errText || `Error HTTP ${response.status}`,
        });
        continue;
      }

      // Marcar recordatorio como enviado hoy en la base de datos
      parsedJson._lastReminderDate = todayStr;
      parsedJson._lastReminderMonthKey = currentMonthKey;
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
        unpaidMonthsCount,
        totalDebt,
        status: "SENT",
      });

      // Pausa preventiva de 5 segundos entre clientes para proteger la línea contra bloqueos
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (sendErr: any) {
      result.failedCount++;
      result.details.push({
        clientName: client.clientName,
        clientCode: client.clientCode,
        whatsapp: client.whatsapp,
        dueDate: nextPayStr,
        daysDiff: diff,
        unpaidMonthsCount,
        totalDebt,
        status: "ERROR",
        error: sendErr?.message || "No se pudo conectar al Gateway de WhatsApp",
      });
    }
  }

  return result;
}
