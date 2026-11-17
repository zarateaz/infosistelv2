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
  const amountTxt = `S/. ${params.amount.toFixed(2)}`;

  let timePhrase = "mañana";
  let title = "RECORDATORIO PREVENTIVO DE PAGO";

  if (params.isDueToday) {
    timePhrase = "HOY";
    title = "RECORDATORIO: VENCE HOY";
  } else if (params.isOverdue) {
    const days = params.daysDiff ? Math.abs(params.daysDiff) : 1;
    timePhrase = `hace ${days} día(s)`;
    title = "AVISO DE VENCIMIENTO DE SERVICIO";
  }

  // Plantilla oficial base predeterminada (100% confiable y formal)
  const defaultMessage =
    `🔔 *${title} — INFOSISTEL INTERNET*\n\n` +
    `Estimado(a) *${params.clientName}*${codeTxt}${ubicationTxt}, te saludamos cordialmente del equipo de INFOSISTEL.\n\n` +
    `Te recordamos que tu pago mensual del servicio de internet vence *${timePhrase}* (${params.dueDate}):\n` +
    `• 💰 *Monto a cancelar:* ${amountTxt}\n` +
    `• 📅 *Fecha de vencimiento:* ${params.dueDate}\n` +
    `• 💳 *Medios disponibles:* Efectivo en taller, Yape 1 o Yape 2.\n\n` +
    `Por favor confírmanos tu pago por este medio para emitir tu Recibo oficial y asegurar la continuidad ininterrumpida de tu señal. ¡Agradecemos mucho tu puntualidad! 🚀\n\n` +
    `_INFOSISTEL · Huancayo_`;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return defaultMessage;
  }

  try {
    // Llamada con timeout de 5 segundos para que el cron job no se quede colgado
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const prompt =
      `Eres el asistente oficial de INFOSISTEL (Huancayo, Perú). Genera un recordatorio breve, formal, amable y profesional para WhatsApp.\n` +
      `Cliente: ${params.clientName} ${codeTxt}\n` +
      `Ubicación: ${params.galeria || "Stand comercial"}\n` +
      `Monto: ${amountTxt}\n` +
      `Vence: ${timePhrase} (${params.dueDate})\n` +
      `Indica que puede pagar por Yape o en efectivo en tienda para emitir su recibo oficial. Mantén emojis profesionales (🔔, 💰, 📅, 🚀). No agregues texto introductorio, solo el mensaje directo.`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Generas mensajes de WhatsApp profesionales y directos para Infosistel." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 250,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 20) {
        return text;
      }
    }
  } catch (err) {
    // Si la API falla, cae silenciosamente en la plantilla oficial sin romper el flujo
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
    `Hola ${clientName || ""}, gracias por comunicarte con INFOSISTEL.\n` +
    `Para pagos por Yape puedes realizarlo a nuestras cuentas autorizadas:\n` +
    `• YAPE 1: 964 648 202 (Titular INFOSISTEL)\n` +
    `• YAPE 2: 954 812 305 (Titular INFOSISTEL)\n\n` +
    `Envíanos tu captura por este chat para registrar tu comprobante de 6 dígitos. ¡Muchas gracias!`;

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
              "Cuentas para pago por Yape: Yape 1 (964 648 202) y Yape 2 (954 812 305). " +
              "Horario del taller: Lunes a Sábado de 9:00 AM a 8:00 PM. " +
              "Pide que envíen la captura del abono para emitir su recibo oficial.",
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

