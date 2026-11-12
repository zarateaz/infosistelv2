import nodemailer from "nodemailer";

export type EmailProvider = "resend" | "smtp" | "none";

export function getConfiguredEmailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  if (process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()) return "smtp";
  return "none";
}

export function isEmailProviderConfigured(): boolean {
  return getConfiguredEmailProvider() !== "none";
}

function getFromAddress(): string {
  const custom = process.env.EMAIL_FROM?.trim();
  if (custom) return custom;
  const smtpUser = process.env.SMTP_USER?.trim();
  if (smtpUser) return `INFOSISTEL <${smtpUser}>`;
  return "INFOSISTEL <onboarding@resend.dev>";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendPasswordResetOtpEmail(params: {
  to: string;
  username: string;
  otpCode: string;
  expiresMinutes?: number;
}): Promise<void> {
  const provider = getConfiguredEmailProvider();
  if (provider === "none") {
    throw new Error(
      "El servidor aún no tiene configurado RESEND_API_KEY ni SMTP_USER/SMTP_PASS en el archivo .env."
    );
  }

  const expiresMinutes = params.expiresMinutes ?? 10;
  const subject = `INFOSISTEL — Código de recuperación: ${params.otpCode}`;
  const safeUser = escapeHtml(params.username);
  const safeCode = escapeHtml(params.otpCode);

  const text = [
    `Hola ${params.username},`,
    "",
    `Tu código OTP de 6 dígitos para restablecer tu contraseña en INFOSISTEL es:`,
    "",
    `    ${params.otpCode}`,
    "",
    `Este código vence en ${expiresMinutes} minutos y es de un solo uso.`,
    `Si tú no solicitaste este cambio, ignora este mensaje.`,
    "",
    `— Equipo INFOSISTEL`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:18px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,0.08);">
    <div style="background:linear-gradient(135deg,#0a5fdb,#1d4ed8);padding:22px 28px;color:#ffffff;">
      <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;opacity:0.85;">INFOSISTEL · SEGURIDAD</p>
      <h1 style="margin:6px 0 0;font-size:20px;font-weight:800;">Código de recuperación</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">
        Hola <strong style="color:#0f172a;">${safeUser}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta del panel administrativo.
      </p>
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;">
        Tu código OTP de 6 dígitos:
      </p>
      <div style="margin:0 0 18px;padding:18px;background:#f8fafc;border:2px dashed #93c5fd;border-radius:14px;text-align:center;">
        <span style="font-family:'Courier New',monospace;font-size:34px;font-weight:900;letter-spacing:0.22em;color:#0a5fdb;">
          ${safeCode}
        </span>
      </div>
      <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#475569;">
        Ingresa este código en el formulario de recuperación. Vence en <strong>${expiresMinutes} minutos</strong> y solo funciona una vez.
      </p>
      <div style="padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:12px;color:#9a3412;">
        Si tú no pediste restablecer tu clave, ignora este correo y avisa al administrador. Nunca compartas este código.
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  const from = getFromAddress();

  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend error (${res.status}): ${body || res.statusText}`);
    }
    return;
  }

  // SMTP / Gmail
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE !== "false" : port === 465;
  const rawPass = process.env.SMTP_PASS!.trim();
  // Gmail App Passwords are displayed by Google with spaces ("xxxx xxxx xxxx xxxx"); strip spaces for Gmail
  const pass = host.toLowerCase().includes("gmail") ? rawPass.replace(/\s+/g, "") : rawPass;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass,
    },
  });

  await transporter.sendMail({
    from,
    to: params.to,
    subject,
    text,
    html,
  });
}

