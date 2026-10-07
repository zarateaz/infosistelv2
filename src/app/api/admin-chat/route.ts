import { deepseek } from "@ai-sdk/deepseek";
import { streamText } from "ai";
import { buscarProductoAdmin, registrarVentaAdmin } from "@/lib/adminChatTools";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";

export const maxDuration = 45;

export async function POST(req: Request) {
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

  const { messages } = await req.json();

  const result = streamText({
    model: deepseek("deepseek-chat"),
    system: `Eres el Asistente Inteligente del Panel de Control de Infosistel.
Tu tarea principal es ayudar a los administradores a gestionar el inventario y registrar ventas rápidamente.
Puedes buscar productos por nombre o código de barras usando "buscarProductoAdmin".
Puedes descontar stock usando "registrarVentaAdmin".
Si el usuario indica que vendió un producto o te da un código de barras para descontar, usa las herramientas. Si no te especifica el origen de la venta, asume "FISICA".
Responde de forma muy breve y directa. No des explicaciones largas. Solo confirma lo que hiciste.`,
    messages,
    tools: { buscarProductoAdmin, registrarVentaAdmin },
    maxSteps: 5,
    maxOutputTokens: 500,
  });

  return result.toDataStreamResponse({
    getErrorMessage: (error) => {
      console.error("[admin-chat] Error llamando a DeepSeek:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (/401|invalid.*api.?key|authentication/i.test(message)) return "Clave inválida.";
      if (/insufficient|balance|quota|payment/i.test(message)) return "Sin saldo.";
      return "Error de red.";
    }
  });
}
