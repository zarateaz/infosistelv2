import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";
import { buscarProductos } from "@/lib/chatTools";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Eres el asistente virtual de INFOSISTEL, una tienda y taller técnico en Huancayo, Perú.

DATOS DEL NEGOCIO:
- Dirección: Av. Giráldez 274, Huancayo (Semisótano Stand S25, y 1er Nivel Stand B-10).
- WhatsApp / Teléfono: +51 964 648 202
- Correo: ecaballero@hotmail.com
- Horario: Lunes a Sábado, 9:00 AM a 7:00 PM (domingos cerrado).

SERVICIOS QUE OFRECEMOS:
- Mantenimiento preventivo (limpieza interna, cambio de pasta térmica, optimización de software).
- Reparación de laptops (pantallas, bisagras, teclados, cortos en placa).
- Servicio de impresoras (almohadillas, cabezales, reparación mecánica).
- Venta de repuestos y periféricos (cargadores originales, baterías, pantallas, RAM, SSD).
- Repotenciación con SSD y RAM.
- Soporte corporativo para empresas y colegios.

CÓMO RESPONDER:
- Responde siempre en español, de forma breve, cálida y directa — como un técnico de tienda real, no como un bot corporativo.
- Si preguntan por el precio, stock o disponibilidad de un producto, usa siempre la herramienta buscarProductos antes de responder — nunca inventes un precio o una cantidad.
- Si buscarProductos no encuentra nada, dilo con naturalidad y ofrece confirmar por WhatsApp al +51 964 648 202 (puede ser un producto que no está en el catálogo web, o de servicio técnico en vez de venta).
- Si la consulta requiere hablar con una persona, cotizar algo complejo (reparaciones, servicio técnico), o coordinar una visita, invita a escribir por WhatsApp.
- Si no sabes algo con certeza y no es algo que buscarProductos pueda resolver, dilo y deriva a WhatsApp — no inventes información sobre precios, marcas o garantías.`;

export async function POST(req: Request) {
  // Lazy check (not in the global fail-fast env schema) — the rest of the
  // site works fine without this key; only the chat feature needs it.
  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response(
      JSON.stringify({ error: "El asistente no está configurado (falta DEEPSEEK_API_KEY)." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // Chat completions cost real money per request — rate limit before
  // touching the model. OWASP API4:2023 (Unrestricted Resource Consumption).
  const ip = getClientIP(req);
  const rateCheck = checkRateLimit(rateLimitKey("chat", ip), 20, 5 * 60 * 1000);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ error: "Demasiados mensajes. Intenta de nuevo en unos minutos." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateCheck.retryAfterSeconds ?? 300),
        },
      }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify({ error: "Petición inválida" }), { status: 400 });
  }
  // Cap conversation length sent to the model — an unbounded history is
  // both a cost and a prompt-injection-amplification risk.
  const messages: UIMessage[] = body.messages.slice(-20);

  const result = streamText({
    model: deepseek("deepseek-v4-flash"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: { buscarProductos },
    // Default is stepCountIs(1) — without this, the model would call the
    // tool but never get a turn to relay the result back in text.
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
