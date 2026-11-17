/**
 * scripts/whatsapp-gateway/server.ts
 *
 * Microservicio de conexión WhatsApp Web para INFOSISTEL usando Baileys.
 * Corre en PM2 bajo el nombre "infosistel-whatsapp" en el puerto 3005.
 *
 * Persistencia:
 * Las credenciales de sesión se guardan en /home/zarate/infosistel-v2-data/whatsapp-auth
 * para sobrevivir a todos los deploys.
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import pino from "pino";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";
import { answerCustomerQuery } from "../../src/lib/deepseek";

const PORT = Number(process.env.WHATSAPP_PORT || 3005);
const AUTH_DIR =
  process.env.WHATSAPP_AUTH_DIR ||
  (process.env.NODE_ENV === "production"
    ? "/home/zarate/infosistel-v2-data/whatsapp-auth"
    : path.resolve(process.cwd(), ".whatsapp-auth"));

// Asegurar que el directorio de sesión exista
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock: WASocket | null = null;
let currentQR: string | null = null;
let isConnected = false;
let userPhone: string | null = null;

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }) as any,
    auth: state,
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
    browser: ["Infosistel Web", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      isConnected = false;
      console.log("\n[WhatsApp Gateway] ==================================");
      console.log("[WhatsApp Gateway] ¡NUEVO CÓDIGO QR PARA VINCULAR!");
      console.log("[WhatsApp Gateway] Escanéalo desde tu WhatsApp en Dispositivos Vinculados:");
      console.log("[WhatsApp Gateway] ==================================\n");
      try {
        qrcodeTerminal.generate(qr, { small: true });
      } catch {
        // Fallback si la terminal no soporta
      }
    }

    if (connection === "close") {
      isConnected = false;
      userPhone = null;
      const shouldReconnect =
        (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log(
        `[WhatsApp Gateway] Conexión cerrada. ¿Reconectar?: ${shouldReconnect}`
      );

      if (shouldReconnect) {
        setTimeout(startWhatsApp, 3000);
      } else {
        console.log("[WhatsApp Gateway] Sesión cerrada permanentemente. Limpiando credenciales...");
        try {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        } catch {}
        setTimeout(startWhatsApp, 3000);
      }
    } else if (connection === "open") {
      isConnected = true;
      currentQR = null;
      userPhone = sock?.user?.id?.split(":")[0] || sock?.user?.id || null;
      console.log("\n==================================================");
      console.log(`[WhatsApp Gateway] ✅ CONEXIÓN EXITOSA CON WHATSAPP`);
      console.log(`[WhatsApp Gateway] Número conectado: +${userPhone}`);
      console.log(`[WhatsApp Gateway] Listo para enviar avisos automáticos.`);
      console.log("==================================================\n");
    }
  });

  // Escuchar respuestas de clientes para atención automática con DeepSeek
  sock.ev.on("messages.upsert", async (m) => {
    try {
      if (m.type !== "notify") return;
      for (const msg of m.messages) {
        if (!msg.message || msg.key.fromMe) continue;
        const sender = msg.key.remoteJid;
        if (!sender || sender.includes("@broadcast") || sender.includes("@g.us")) continue;

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          "";

        if (!text.trim()) continue;

        console.log(`[WhatsApp Gateway] Mensaje recibido de ${sender}: "${text}"`);

        // Si el cliente pregunta algo, DeepSeek responde amablemente
        if (process.env.DEEPSEEK_API_KEY) {
          const aiReply = await answerCustomerQuery(text, msg.pushName || undefined);
          if (aiReply && sock) {
            await sock.sendMessage(sender, { text: aiReply });
            console.log(`[WhatsApp Gateway] Respuesta enviada vía DeepSeek a ${sender}`);
          }
        }
      }
    } catch (err: any) {
      console.error("[WhatsApp Gateway] Error al procesar mensaje entrante:", err?.message);
    }
  });
}

// ─── SERVIDOR HTTP DE CONTROL Y ENVÍO ──────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // CORS y cabeceras JSON
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. GET /status — Estado de la conexión
  if (req.method === "GET" && url.pathname === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        connected: isConnected,
        phone: userPhone,
        hasPendingQR: Boolean(currentQR),
      })
    );
    return;
  }

  // 2. GET /qr — Vista visual del QR para escanear en navegador o texto
  if (req.method === "GET" && url.pathname === "/qr") {
    if (isConnected) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>WhatsApp Conectado</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:white;">
          <div style="text-align:center;padding:2rem;background:#1e293b;border-radius:1.5rem;box-shadow:0 20px 25px -5px rgb(0 0 0 / 0.5);">
            <div style="font-size:3rem;margin-bottom:1rem;">✅</div>
            <h2 style="margin:0 0 0.5rem 0;color:#38bdf8;">WhatsApp Conectado</h2>
            <p style="color:#94a3b8;margin:0;">Número enlazado: <strong>+${userPhone}</strong></p>
            <p style="color:#64748b;font-size:0.875rem;margin-top:1rem;">El sistema está listo para enviar recordatorios automáticos.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (!currentQR) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Generando QR...</title><meta http-equiv="refresh" content="3"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:white;">
          <div style="text-align:center;">
            <h2>Iniciando pasarela WhatsApp...</h2>
            <p style="color:#94a3b8;">Por favor espera 3 segundos mientras se genera el código QR.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    try {
      const qrDataUrl = await QRCode.toDataURL(currentQR, { width: 320, margin: 2 });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vincular WhatsApp — INFOSISTEL</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="refresh" content="20">
        </head>
        <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:white;">
          <div style="text-align:center;padding:2rem;background:#1e293b;border-radius:1.5rem;max-width:380px;box-shadow:0 25px 50px -12px rgb(0 0 0 / 0.7);">
            <h2 style="margin:0 0 0.5rem 0;color:#38bdf8;">Vincular WhatsApp</h2>
            <p style="color:#94a3b8;font-size:0.875rem;margin:0 0 1.5rem 0;">Abre WhatsApp en tu celular > Menú (3 puntos) > <strong>Dispositivos vinculados</strong> y escanea este código:</p>
            <img src="${qrDataUrl}" style="border-radius:1rem;background:white;padding:0.75rem;" alt="QR Code">
            <p style="color:#64748b;font-size:0.75rem;margin-top:1rem;">Esta página se actualiza automáticamente cada 20 segundos.</p>
          </div>
        </body>
        </html>
      `);
      return;
    } catch {
      res.writeHead(500);
      res.end("Error al generar imagen de código QR");
      return;
    }
  }

  // 3. POST /send — Envío de mensaje
  if (req.method === "POST" && url.pathname === "/send") {
    if (!isConnected || !sock) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: "WhatsApp Gateway no está conectado. Escanea el código QR primero.",
        })
      );
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        const { phone, message } = parsed;

        if (!phone || !message) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Campos 'phone' y 'message' requeridos." }));
          return;
        }

        const cleanPhone = String(phone).replace(/\D/g, "");
        const formattedJid = `${cleanPhone}@s.whatsapp.net`;

        const sent = await sock!.sendMessage(formattedJid, { text: String(message) });

        console.log(`[WhatsApp Gateway] Mensaje enviado a ${cleanPhone} (ID: ${sent?.key?.id})`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            messageId: sent?.key?.id,
            to: cleanPhone,
          })
        );
      } catch (err: any) {
        console.error("[WhatsApp Gateway] Error al enviar mensaje:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err?.message || "Error al enviar mensaje." }));
      }
    });
    return;
  }

  // 4. GET /trigger-reminders — Disparo manual o para pruebas
  if (req.method === "GET" && url.pathname === "/trigger-reminders") {
    const isDryRun = url.searchParams.get("dryRun") === "true";
    try {
      const { runAutomatedInternetReminders } = await import("../../src/lib/whatsappAutoNotifier");
      const report = await runAutomatedInternetReminders({ dryRun: isDryRun, includeDueToday: true });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, report }));
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err?.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

// Programador automático interno (todos los días a las 9:00 AM hora Perú)
let lastTriggerDate = "";

function startDailyCron() {
  setInterval(async () => {
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const parts = formatter.formatToParts(new Date());
      const year = parts.find((p) => p.type === "year")?.value;
      const month = parts.find((p) => p.type === "month")?.value;
      const day = parts.find((p) => p.type === "day")?.value;
      const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
      const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

      const todayDate = `${year}-${month}-${day}`;

      // Si son las 9:00 AM en Huancayo y aún no se ejecutó hoy
      if (hour === 9 && minute === 0 && lastTriggerDate !== todayDate) {
        lastTriggerDate = todayDate;
        console.log(`\n[Auto-Reminder] ⏰ Son las 9:00 AM en Huancayo (${todayDate}). Iniciando envío automático de recordatorios...`);
        const { runAutomatedInternetReminders } = await import("../../src/lib/whatsappAutoNotifier");
        const res = await runAutomatedInternetReminders({ includeDueToday: true });
        console.log(`[Auto-Reminder] Finalizado: ${res.sentCount} enviados, ${res.skippedPaid} ya pagados, ${res.failedCount} fallidos.\n`);
      }
    } catch (err: any) {
      console.error("[Auto-Reminder] Error en chequeo programado:", err?.message);
    }
  }, 45_000);
  console.log("[Auto-Reminder] ✅ Programador interno activo: se ejecutará todos los días a las 9:00 AM (Hora Perú) sin necesidad de cron.");
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[WhatsApp Gateway] Servicio HTTP corriendo en http://0.0.0.0:${PORT}`);
  startWhatsApp().catch((err) => {
    console.error("[WhatsApp Gateway] Error fatal al iniciar WhatsApp:", err);
  });
  startDailyCron();
});

