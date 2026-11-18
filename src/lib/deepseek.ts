/**
 * DeepSeek AI client & helpers for INFOSISTEL.
 * Uses DEEPSEEK_API_KEY from environment with graceful fallbacks.
 */

export interface InternetReminderParams {
  clientName: string;
  clientCode?: string | null;
  galeria?: string | null;
  router?: string | null;
  portNumber?: number | null;
  amount: number;
  totalDebt?: number;
  unpaidMonthsCount?: number;
  dueDate: string; // YYYY-MM-DD
  isDueTomorrow?: boolean;
  isDueToday?: boolean;
  isOverdue?: boolean;
  daysDiff?: number;
}

/**
 * Genera el texto del recordatorio de WhatsApp.
 * Si DEEPSEEK_API_KEY está configurada, puede generar una variante pulida;
 * si no, o en caso de error, retorna de inmediato la plantilla oficial con 0 fallos.
 */
export async function generateReminderMessage(params: InternetReminderParams): Promise<string> {
  const codeTxt = params.clientCode ? ` (${params.clientCode})` : "";
  const ubicationTxt = params.galeria ? ` · ${params.galeria}` : "";
  const totalAmount = params.totalDebt && params.totalDebt > 0 ? params.totalDebt : params.amount;
  const amountTxt = `S/. ${totalAmount.toFixed(2)}`;
  const monthsCount = params.unpaidMonthsCount || 1;
  const daysDiff = typeof params.daysDiff === "number" ? params.daysDiff : 0;
  const daysOverdue = Math.abs(daysDiff);

  let title = "RECORDATORIO DE PAGO";
  let bodyDetail = "";

  if (params.isOverdue || daysDiff < 0) {
    if (monthsCount > 1) {
      title = "AVISO DE VENCIMIENTO ACUMULADO";
      bodyDetail =
        `Le comunicamos que su servicio de internet presenta *${monthsCount} meses pendientes* de regularización (vencido hace ${daysOverdue} día(s)), acumulando una deuda de *${amountTxt}*.`;
    } else {
      title = "AVISO DE VENCIMIENTO";
      bodyDetail =
        `Le recordamos amablemente que su mensualidad del servicio de internet venció el *${params.dueDate}* (hace ${daysOverdue} día(s)) por un monto pendiente de *${amountTxt}*.`;
    }
  } else if (params.isDueToday || daysDiff === 0) {
    title = "RECORDATORIO: VENCE HOY";
    bodyDetail =
      `Le recordamos amablemente que su mensualidad del servicio de internet vence *HOY* (${params.dueDate}) por un monto de *${amountTxt}*.`;
  } else if (params.isDueTomorrow || daysDiff === 1) {
    title = "RECORDATORIO PREVENTIVO";
    bodyDetail =
      `Le recordamos de manera preventiva que su mensualidad del servicio de internet vence *mañana* (${params.dueDate}) por un monto de *${amountTxt}*.`;
  } else {
    title = "RECORDATORIO DE SERVICIO";
    bodyDetail =
      `Le recordamos que su próximo pago mensual del servicio de internet corresponde a la fecha *${params.dueDate}* por un monto de *${amountTxt}*.`;
  }

  // Plantilla oficial base predeterminada (100% confiable, formal y con cuentas verificadas)
  const defaultMessage =
    `🔔 *${title} — INFOSISTEL INTERNET*\n\n` +
    `Estimado(a) *${params.clientName}*${codeTxt}${ubicationTxt}, le saludamos cordialmente del equipo de *INFOSISTEL*.\n\n` +
    `${bodyDetail}\n\n` +
    `💳 *Canales oficiales para realizar su abono:*\n` +
    `• 📱 *YAPE 1:* *964 648 202* (A nombre de: *Edgar Caballero*)\n` +
    `• 📱 *YAPE 2:* *963 193 838* (A nombre de: *Yape Caja*)\n` +
    `• 🏢 *Pago Físico (Efectivo):* *Av. Giráldez 274, 1er Nivel Stand B-10, Huancayo*\n\n` +
    `Por favor envíenos la captura o foto del comprobante de pago por este chat para emitir su Recibo oficial y asegurar la continuidad ininterrumpida de su señal. ¡Agradecemos mucho su preferencia y puntualidad! 🚀\n\n` +
    `_INFOSISTEL · Soporte e Internet Huancayo_`;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return defaultMessage;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const prompt =
      `Eres el asistente oficial de INFOSISTEL (Huancayo, Perú). Genera un recordatorio formal, muy respetuoso, conciso y profesional para WhatsApp.\n` +
      `Cliente: ${params.clientName} ${codeTxt}\n` +
      `Ubicación: ${params.galeria || "Stand / Galería comercial"}\n` +
      `Situación: ${params.isOverdue ? `Deuda vencida de ${monthsCount} mes(es) por un total de ${amountTxt}` : params.isDueToday ? `Vence HOY por ${amountTxt}` : `Vence mañana por ${amountTxt}`}\n` +
      `Cuentas oficiales de pago obligatorias:\n` +
      `- YAPE 1: 964 648 202 (Edgar Caballero)\n` +
      `- YAPE 2: 963 193 838 (Yape Caja)\n` +
      `- Pago Físico: Av. Giráldez 274, 1er Nivel Stand B-10, Huancayo\n` +
      `Indica que envíe la captura para registrar su recibo oficial y asegurar la continuidad de su servicio. Mantén emojis profesionales (🔔, 💳, 📱, 🏢, 🚀). No agregues introducciones, solo el mensaje directo para WhatsApp.`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Generas mensajes de WhatsApp profesionales y directos para Infosistel Internet." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 30) {
        return text;
      }
    }
  } catch (err) {
    console.warn("[DeepSeek] Aviso automático usando plantilla estándar:", (err as Error)?.message);
  }

  return defaultMessage;
}

/**
 * Responde preguntas de clientes en WhatsApp mediante DeepSeek.
 */
export async function answerCustomerQuery(incomingText: string, clientName?: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const fallback =
    `Hola ${clientName || ""}, gracias por comunicarte con el soporte de INFOSISTEL.\n\n` +
    `Nuestros canales oficiales autorizados de pago son:\n` +
    `• 📱 *YAPE 1:* 964 648 202 (A nombre de Edgar Caballero)\n` +
    `• 📱 *YAPE 2:* 963 193 838 (A nombre de Yape Caja)\n` +
    `• 🏢 *Pago Físico:* Av. Giráldez 274, 1er Nivel Stand B-10, Huancayo\n\n` +
    `Por favor envíanos la captura o foto del comprobante por este chat para registrar tu pago y emitir tu recibo oficial. ¡Con gusto te atendemos!`;

  if (!apiKey || apiKey.trim() === "") return fallback;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "Eres el asistente de atención al cliente de INFOSISTEL en Huancayo (servicio de internet y soporte técnico). " +
              "Responde de manera muy amable, concisa y clara. " +
              "Cuentas para pago por Yape: YAPE 1: 964 648 202 (Edgar Caballero) y YAPE 2: 963 193 838 (Yape Caja). " +
              "Pago físico: Av. Giráldez 274, 1er Nivel Stand B-10, Huancayo. " +
              "Horario: Lunes a Sábado de 9:00 AM a 8:00 PM. " +
              "Pide siempre que envíen la captura del abono para emitir su recibo oficial.",
          },
          { role: "user", content: incomingText },
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (reply) return reply;
    }
  } catch {
    // ignore
  }

  return fallback;
}

