import { prisma } from "@/lib/prisma";
import { normalizeClientPayments } from "@/app/taller-control/(panel)/cobranza-internet/cobranza";
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
    const startStr = dateToInputValue(client.startDate);
    // Mismo criterio que la pantalla de Cobranza (meses marcados = fuente de verdad)
    const { map, nextPaymentDate: nextPayStr } = normalizeClientPayments({
      startDate: startStr,
      nextPaymentDate: dateToInputValue(client.nextPaymentDate),
      paidMonths: client.paidMonths,
      amount: client.amount,
    });

    // Filtrar por teléfono específico si se solicitó en el comando
    const clientPhoneDigits = client.whatsapp.replace(/\D/g, "");
    if (cleanTargetPhone && !clientPhoneDigits.includes(cleanTargetPhone)) {
      continue;
    }

    const [py, pm, pd] = nextPayStr.split("-").map(Number);
    const targetUtc = Date.UTC(py, pm - 1, pd);
    const diff = Math.round((targetUtc - nowUtc) / 86_400_000);


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

    // Re-verificar justo antes de enviar: si mientras corría el envío se registró un
    // pago o se editó el cliente, NO se le cobra con datos viejos (se reevalúa en la próxima corrida).
    const fresh = await prisma.internetClient.findUnique({
      where: { id: client.id },
      select: { paidMonths: true, nextPaymentDate: true, startDate: true },
    });
    if (
      !fresh ||
      fresh.paidMonths !== client.paidMonths ||
      fresh.nextPaymentDate.getTime() !== client.nextPaymentDate.getTime() ||
      fresh.startDate.getTime() !== client.startDate.getTime()
    ) {
      result.skippedPaid++;
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

      // Marcar recordatorio como enviado hoy. Se relee el registro y se guarda con
      // compare-and-swap: NUNCA se reescribe el historial con una copia vieja
      // (antes podía borrar un pago marcado mientras corría el envío).
      await markReminderSent(client.id, todayStr, currentMonthKey);

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

/**
 * Envía un mensaje formal, cálido y hermoso de agradecimiento por WhatsApp al
 * registrar el pago de un cliente de internet.
 * Incluye comprobante oficial, fecha del próximo vencimiento y ubicación del taller.
 */
export async function sendInternetPaymentThankYou(params: {
  clientName: string;
  clientCode?: string | null;
  whatsapp: string;
  galeria?: string | null;
  amount: number;
  monthKey: string;
  receiptNumber?: string | null;
  nextPaymentDate?: string;
  paymentMethod?: string;
  gatewayUrl?: string;
}): Promise<boolean> {
  const gatewayUrl = params.gatewayUrl || process.env.WHATSAPP_GATEWAY_URL || "http://127.0.0.1:3005";
  const cleanPhone = params.whatsapp.replace(/\D/g, "");
  if (!cleanPhone) return false;

  const fullPhone = cleanPhone.length === 9 ? `51${cleanPhone}` : cleanPhone;
  const codeTxt = params.clientCode ? ` (${params.clientCode})` : "";
  const ubicationTxt = params.galeria ? ` · ${params.galeria}` : "";
  const receiptTxt = params.receiptNumber ? `#${params.receiptNumber}` : "Generado en sistema";
  const amountTxt = `S/. ${params.amount.toFixed(2)}`;
  const methodTxt = params.paymentMethod || "Yape / Efectivo";
  const nextDateTxt = params.nextPaymentDate || "Próximo mes";

  const message =
    `✨ *¡PAGO CONFIRMADO CON ÉXITO! — INFOSISTEL INTERNET* ✨\n\n` +
    `Estimado(a) *${params.clientName}*${codeTxt}${ubicationTxt}, te saludamos con gran aprecio del equipo de *INFOSISTEL*.\n\n` +
    `Queremos darte las *¡GRACIAS INFINITAS POR TU PAGO Y PUNTUALIDAD!* 🌟🙌 Tu confianza nos impulsa a brindarte siempre la mejor señal y atención.\n\n` +
    `📋 *Detalle de tu comprobante oficial:*\n` +
    `• 🧾 *Recibo Oficial:* ${receiptTxt}\n` +
    `• 📅 *Mes cancelado:* ${params.monthKey}\n` +
    `• 💰 *Monto recibido:* ${amountTxt}\n` +
    `• 💳 *Medio de pago:* ${methodTxt}\n` +
    `• 📌 *Próximo vencimiento:* ${nextDateTxt}\n\n` +
    `Tu servicio se encuentra *100% activo y sin interrupciones*. 🚀\n\n` +
    `_¡Es un honor tenerte como parte de la familia INFOSISTEL! Estamos a tu servicio siempre._ 💙\n\n` +
    `🏢 *INFOSISTEL · Huancayo*\n` +
    `📍 Av. Giráldez 274, 1er Nivel Stand B-10`;

  try {
    const res = await fetch(`${gatewayUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: fullPhone,
        message,
      }),
    });

    if (res.ok) {
      console.log(`[WhatsApp] Agradecimiento de pago enviado exitosamente a ${params.clientName} (${fullPhone})`);
      return true;
    } else {
      console.warn(`[WhatsApp] No se pudo enviar agradecimiento a ${fullPhone}: HTTP ${res.status}`);
      return false;
    }
  } catch (err: any) {
    console.warn(`[WhatsApp] Gateway no disponible para enviar agradecimiento:`, err?.message);
    return false;
  }
}

async function markReminderSent(clientId: string, todayStr: string, monthKey: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const cur = await prisma.internetClient.findUnique({
      where: { id: clientId },
      select: { paidMonths: true },
    });
    if (!cur) return;
    let json: Record<string, unknown> = {};
    if (cur.paidMonths) {
      try {
        const parsed = JSON.parse(cur.paidMonths);
        if (!parsed || typeof parsed !== "object") return; // no tocar datos raros
        json = parsed;
      } catch {
        return; // JSON corrupto: no se sobrescribe para no perder historial
      }
    }
    json._lastReminderDate = todayStr;
    json._lastReminderMonthKey = monthKey;
    const res = await prisma.internetClient.updateMany({
      where: { id: clientId, paidMonths: cur.paidMonths },
      data: { paidMonths: JSON.stringify(json) },
    });
    if (res.count === 1) return;
  }
}
