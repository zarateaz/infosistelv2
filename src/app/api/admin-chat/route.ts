import { deepseek } from "@ai-sdk/deepseek";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { type UIMessage } from "ai";
import { cookies } from "next/headers";
import { buscarProductoAdmin, registrarVentaAdmin, ajustarStockAdmin } from "@/lib/adminChatTools";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export const maxDuration = 45;

export async function POST(req: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return new Response(JSON.stringify({ error: "No autorizado." }), { status: 401 });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response(
      JSON.stringify({ error: "El asistente no está configurado (falta DEEPSEEK_API_KEY)." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const ip = getClientIP(req);
  const rateCheck = checkRateLimit(rateLimitKey("admin-chat", ip), 100, 60 * 1000);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ error: "Has enviado demasiados mensajes. Por favor, espera un minuto." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify({ error: "Petición inválida" }), { status: 400 });
  }

  const messages: UIMessage[] = body.messages.slice(-20);

  const result = streamText({
    model: deepseek("deepseek-v4-flash"),
    system: `Eres el Asistente Inteligente del Panel de Control de Infosistel (Huancayo, Perú).
Tu tarea principal es ayudar a los administradores a gestionar el inventario, reponer stock y registrar ventas rápidamente.
Herramientas disponibles:
- "ajustarStockAdmin": Para añadir o reponer stock a un producto cuando llega mercadería. En el campo "producto" puedes pasar directamente el número de producto (ej: 14 o #14), el nombre del producto (ej: "Kingston NV2"), el código de barras o el ID.
- "registrarVentaAdmin": Para descontar stock por ventas (asume origen "FISICA" si no se especifica). En el campo "producto" puedes pasar el número de producto (#14 o 14), nombre o código.
- "buscarProductoAdmin": Para buscar productos por nombre, número (#) o categoría.

REGLAS DE OPERACIÓN:
1. Si el usuario te indica directamente qué producto y cuánto stock añadir (ej: "añade 5 de stock al producto 14", "sube 3 al #10", "agrega 10 unidades a Kingston Fury"): ejecuta DIRECTAMENTE "ajustarStockAdmin" sin necesidad de buscar primero.
2. Si el usuario dice que vendió o quiere descontar stock (ej: "vendí 2 del producto 14"): ejecuta DIRECTAMENTE "registrarVentaAdmin".
3. Responde de forma muy breve, confirmando el número de producto (#), nombre comercial y el nuevo stock total en tienda.`,
    messages: await convertToModelMessages(messages),
    tools: { buscarProductoAdmin, registrarVentaAdmin, ajustarStockAdmin },
    stopWhen: stepCountIs(5),
    maxOutputTokens: 500,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[admin-chat] Error llamando a DeepSeek:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (/401|invalid.*api.?key|authentication/i.test(message)) return "Clave inválida.";
      if (/insufficient|balance|quota|payment/i.test(message)) return "Sin saldo.";
      return "Error de red.";
    }
  });
}
