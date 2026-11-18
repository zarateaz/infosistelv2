#!/usr/bin/env node
/**
 * scripts/test-whatsapp-send.ts
 *
 * Envía un mensaje directo de prueba a cualquier número de WhatsApp a través del Gateway.
 *
 * Uso:
 *   node --env-file=.env ./node_modules/.bin/tsx scripts/test-whatsapp-send.ts 910161491 "Mensaje opcional"
 */

async function main() {
  const targetPhone = process.argv[2] || "910161491";
  const customMessage =
    process.argv[3] ||
    "🔔 *MENSAJE DE PRUEBA — INFOSISTEL INTERNET*\n\n" +
    "Hola, este es un mensaje de prueba del sistema automatizado de WhatsApp de INFOSISTEL.\n\n" +
    "Si recibiste este mensaje, la conexión del servidor a WhatsApp está funcionando al 100%. 🚀";

  const cleanPhone = targetPhone.replace(/\D/g, "");
  const fullPhone = cleanPhone.length === 9 ? `51${cleanPhone}` : cleanPhone;
  const gatewayUrl = process.env.WHATSAPP_GATEWAY_URL || "http://127.0.0.1:3005";

  console.log(`\n======================================================`);
  console.log(`[INFOSISTEL] Envío Directo de Prueba por WhatsApp`);
  console.log(`Destinatario: +${fullPhone}`);
  console.log(`Gateway: ${gatewayUrl}`);
  console.log(`======================================================\n`);

  try {
    const res = await fetch(`${gatewayUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: fullPhone,
        message: customMessage,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      console.error(`❌ Error al enviar mensaje:`, data.error || `HTTP ${res.status}`);
      process.exit(1);
    }

    console.log(`✅ ¡Mensaje enviado exitosamente!`);
    console.log(`ID del mensaje: ${data.messageId}`);
    console.log(`Enviado a: +${data.to}`);
    console.log(`\nRevisa el WhatsApp del número ${fullPhone} para verificar la llegada del mensaje.\n`);
  } catch (err: any) {
    console.error(`❌ No se pudo conectar con el Gateway (${gatewayUrl}):`, err?.message);
    process.exit(1);
  }
}

main().catch(console.error);
