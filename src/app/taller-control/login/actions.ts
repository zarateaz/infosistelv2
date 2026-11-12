"use server";

import { z } from "zod";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";
import { verifyPassword, hashPassword, burnPasswordCheckTime } from "@/lib/auth";
import { decryptPII } from "@/lib/crypto";
import { env } from "@/lib/env";
import { verifyTotpToken, normalizeRecoveryCode } from "@/lib/totp";
import { isEmailProviderConfigured, sendPasswordResetOtpEmail } from "@/lib/mailer";
import {
  createSessionToken,
  verifySessionToken,
  createMfaPendingToken,
  verifyMfaPendingToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  MFA_PENDING_COOKIE,
} from "@/lib/session";
import { logAudit } from "@/lib/audit";

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

export interface LoginState {
  error?: string;
  mfaRequired?: boolean;
}

const GENERIC_ERROR = "Usuario o contraseña incorrectos.";

async function issueSession(adminId: string, username: string, role: string, tokenVersion: number) {
  const token = await createSessionToken({ sub: adminId, username, role, v: tokenVersion });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  cookieStore.delete(MFA_PENDING_COOKIE);
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC_ERROR };

  const ip = getClientIP(await headers());
  const rl = checkRateLimit(rateLimitKey("admin-login", ip), 5, 15 * 60 * 1000, 15 * 60 * 1000);
  if (!rl.allowed) {
    const minutes = Math.max(1, Math.ceil((rl.retryAfterSeconds ?? 0) / 60));
    await logAudit({ action: "LOGIN_RATELIMIT", username: parsed.data.username, ipAddress: ip });
    return { error: `Demasiados intentos. Intenta de nuevo en ${minutes} min.` };
  }

  const { username, password } = parsed.data;
  const admin = await prisma.admin.findUnique({ where: { username } });

  if (!admin) {
    // Same cost as a real check, so a bad username isn't distinguishable
    // from a bad password by response time.
    burnPasswordCheckTime(password);
    await logAudit({ action: "LOGIN_FAILED", username, ipAddress: ip, details: "Usuario no existe" });
    return { error: GENERIC_ERROR };
  }

  const passwordOk = await verifyPassword(password, admin.passwordHash);
  if (!passwordOk) {
    await logAudit({ action: "LOGIN_FAILED", adminId: admin.id, username, ipAddress: ip, details: "Contraseña incorrecta" });
    return { error: GENERIC_ERROR };
  }

  if (!admin.totpEnabled) {
    await logAudit({ action: "LOGIN_SUCCESS", adminId: admin.id, username, ipAddress: ip });
    await issueSession(admin.id, admin.username, admin.role, admin.tokenVersion);
    redirect("/taller-control");
  }

  // Password correct, second factor pending — no real session cookie yet.
  const pendingToken = await createMfaPendingToken(admin.id);
  const cookieStore = await cookies();
  cookieStore.set(MFA_PENDING_COOKIE, pendingToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 5,
  });
  return { mfaRequired: true };
}

export async function verifyMfaAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { mfaRequired: true, error: "Ingresa el código." };

  const ip = getClientIP(await headers());
  const rl = checkRateLimit(rateLimitKey("admin-mfa", ip), 5, 15 * 60 * 1000, 15 * 60 * 1000);
  if (!rl.allowed) {
    const minutes = Math.max(1, Math.ceil((rl.retryAfterSeconds ?? 0) / 60));
    return { mfaRequired: true, error: `Demasiados intentos. Intenta de nuevo en ${minutes} min.` };
  }

  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(MFA_PENDING_COOKIE)?.value;
  const pending = pendingToken ? await verifyMfaPendingToken(pendingToken) : null;
  if (!pending) {
    cookieStore.delete(MFA_PENDING_COOKIE);
    return { error: "La verificación expiró. Inicia sesión de nuevo." };
  }

  const admin = await prisma.admin.findUnique({ where: { id: pending.sub } });
  if (!admin || !admin.totpEnabled || !admin.totpSecret) {
    cookieStore.delete(MFA_PENDING_COOKIE);
    return { error: "La verificación expiró. Inicia sesión de nuevo." };
  }

  const secret = decryptPII(admin.totpSecret);
  if (/^\d{6}$/.test(code.replace(/\s+/g, ""))) {
    if (!verifyTotpToken(secret, code)) {
      await logAudit({ action: "LOGIN_FAILED", adminId: admin.id, username: admin.username, ipAddress: ip, details: "MFA incorrecto" });
      return { mfaRequired: true, error: "Código incorrecto." };
    }
    await logAudit({ action: "LOGIN_SUCCESS", adminId: admin.id, username: admin.username, ipAddress: ip, details: "MFA" });
    await issueSession(admin.id, admin.username, admin.role, admin.tokenVersion);
    redirect("/taller-control");
  }

  // Otherwise treat it as a one-time recovery code.
  const normalized = normalizeRecoveryCode(code);
  const storedHashes = (admin.recoveryCodesHash ?? "").split(",").filter(Boolean);
  let matchedIndex = -1;
  for (let i = 0; i < storedHashes.length; i++) {
    if (await verifyPassword(normalized, storedHashes[i])) {
      matchedIndex = i;
      break;
    }
  }
  if (matchedIndex === -1) {
    await logAudit({ action: "LOGIN_FAILED", adminId: admin.id, username: admin.username, ipAddress: ip, details: "Código de recuperación incorrecto" });
    return { mfaRequired: true, error: "Código incorrecto." };
  }

  const remaining = storedHashes.filter((_, i) => i !== matchedIndex);
  await prisma.admin.update({ where: { id: admin.id }, data: { recoveryCodesHash: remaining.join(",") } });
  await logAudit({ action: "LOGIN_SUCCESS", adminId: admin.id, username: admin.username, ipAddress: ip, details: "Código de recuperación usado" });
  await issueSession(admin.id, admin.username, admin.role, admin.tokenVersion);
  redirect("/taller-control");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await verifySessionToken(token);
    if (session) {
      const ip = getClientIP(await headers());
      await logAudit({ action: "LOGOUT", adminId: session.sub, username: session.username, ipAddress: ip });
      
      await prisma.admin.update({
        where: { id: session.sub },
        data: { tokenVersion: { increment: 1 } },
      });
    }
  }

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(MFA_PENDING_COOKIE);
  redirect("/taller-control/login");
}

export interface ForgotPasswordState {
  error?: string;
  sent?: boolean;
  whatsappUrl?: string;
  requestedUsername?: string;
}

const forgotSchema = z.object({
  username: z.string().trim().min(2, "Ingresa tu nombre de usuario.").max(64),
  note: z.string().trim().max(150).optional().default(""),
});

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = forgotSchema.safeParse({
    username: formData.get("username"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ingresa un usuario válido." };
  }

  const ip = getClientIP(await headers());
  const rl = checkRateLimit(rateLimitKey("admin-forgot-pw", ip), 5, 15 * 60 * 1000, 15 * 60 * 1000);
  if (!rl.allowed) {
    const minutes = Math.max(1, Math.ceil((rl.retryAfterSeconds ?? 0) / 60));
    return { error: `Demasiadas solicitudes. Intenta de nuevo en ${minutes} min.` };
  }

  const { username, note } = parsed.data;
  const admin = await prisma.admin.findUnique({
    where: { username },
    select: { id: true, username: true },
  });

  // Always log & return the same response shape regardless of whether `admin` exists (prevents username enumeration).
  await logAudit({
    action: "PASSWORD_RESET_REQUEST",
    adminId: admin?.id,
    username,
    ipAddress: ip,
    details: note
      ? `Solicitud de recuperación de contraseña — Nota: ${note}`
      : "Solicitud de recuperación de contraseña desde Login",
  });

  const nowStr = new Date().toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "short",
    timeStyle: "short",
  });
  const waMessage = [
    `Hola Supervisor de *INFOSISTEL*, olvidé mi contraseña del panel administrativo.`,
    `• Usuario: *${username}*`,
    `• Fecha/Hora: ${nowStr}`,
    note ? `• Detalle: ${note}` : null,
    `¿Me puedes generar una nueva clave temporal desde el módulo *Usuarios*?`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    sent: true,
    requestedUsername: username,
    whatsappUrl: `https://wa.me/51964648202?text=${encodeURIComponent(waMessage)}`,
  };
}

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function hashResetOtp(adminId: string, otpCode: string): string {
  return createHmac("sha256", env.JWT_SECRET)
    .update(`${adminId}:${otpCode}`)
    .digest("hex");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

async function findAdminByIdentifier(identifier: string) {
  const clean = identifier.trim();
  const normalizedEmail = clean.toLowerCase();
  return prisma.admin.findFirst({
    where: {
      OR: [{ username: clean }, { email: normalizedEmail }],
    },
    select: { id: true, username: true, email: true },
  });
}

export interface EmailOtpRequestState {
  error?: string;
  otpSent?: boolean;
  identifier?: string;
  maskedEmail?: string;
  needsConfig?: boolean;
}

const otpRequestSchema = z.object({
  identifier: z.string().trim().min(2, "Ingresa tu usuario o correo electrónico.").max(150),
});

export async function requestEmailOtpAction(
  _prevState: EmailOtpRequestState,
  formData: FormData
): Promise<EmailOtpRequestState> {
  const parsed = otpRequestSchema.safeParse({
    identifier: formData.get("identifier"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ingresa un usuario o correo válido." };
  }

  const ip = getClientIP(await headers());
  const { identifier } = parsed.data;
  const rlIp = checkRateLimit(rateLimitKey("otp-req-ip", ip), 5, 15 * 60 * 1000, 15 * 60 * 1000);
  const rlId = checkRateLimit(
    rateLimitKey("otp-req-id", identifier.toLowerCase()),
    5,
    15 * 60 * 1000,
    15 * 60 * 1000
  );
  if (!rlIp.allowed || !rlId.allowed) {
    const retry = Math.max(rlIp.retryAfterSeconds ?? 0, rlId.retryAfterSeconds ?? 0);
    const minutes = Math.max(1, Math.ceil(retry / 60));
    return { error: `Demasiadas solicitudes de código. Intenta de nuevo en ${minutes} min.` };
  }

  if (!isEmailProviderConfigured()) {
    return {
      needsConfig: true,
      identifier,
      error:
        "El envío de correo aún no está activado en el .env del servidor (falta RESEND_API_KEY o Gmail SMTP_USER/SMTP_PASS). Mientras tanto, puedes usar la opción de WhatsApp al Supervisor.",
    };
  }

  const admin = await findAdminByIdentifier(identifier);
  if (admin?.email) {
    const otpCode = String(randomInt(100000, 1000000));
    const codeHash = hashResetOtp(admin.id, otpCode);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    try {
      await sendPasswordResetOtpEmail({
        to: admin.email,
        username: admin.username,
        otpCode,
        expiresMinutes: 10,
      });

      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: { adminId: admin.id, usedAt: null },
          data: { usedAt: now },
        }),
        prisma.passwordResetToken.create({
          data: {
            adminId: admin.id,
            codeHash,
            expiresAt,
          },
        }),
      ]);

      await logAudit({
        action: "PASSWORD_RESET_OTP_SENT",
        adminId: admin.id,
        username: admin.username,
        ipAddress: ip,
        details: `OTP de 6 dígitos enviado a ${maskEmail(admin.email)}`,
      });
    } catch (err) {
      console.error("[mailer] Error enviando OTP:", err);
      return {
        identifier,
        error:
          "No se pudo enviar el correo de recuperación. Verifica la configuración SMTP/Resend en .env o avisa al Supervisor.",
      };
    }

    return {
      otpSent: true,
      identifier,
      maskedEmail: maskEmail(admin.email),
    };
  }

  await logAudit({
    action: "PASSWORD_RESET_REQUEST",
    adminId: admin?.id,
    username: identifier,
    ipAddress: ip,
    details: "Solicitud OTP por correo (usuario sin correo o inexistente)",
  });

  // Generic success shape so missing/unlinked accounts are not enumerable
  return {
    otpSent: true,
    identifier,
  };
}

export interface EmailOtpVerifyState {
  error?: string;
  resetSuccess?: boolean;
}

const otpVerifySchema = z
  .object({
    identifier: z.string().trim().min(2, "Ingresa tu usuario o correo.").max(150),
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "El código OTP debe tener exactamente 6 dígitos."),
    newPassword: z
      .string()
      .min(12, "La nueva contraseña debe tener al menos 12 caracteres.")
      .max(256),
    confirmPassword: z.string().min(1, "Confirma tu nueva contraseña.").max(256),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export async function verifyEmailOtpAndResetAction(
  _prevState: EmailOtpVerifyState,
  formData: FormData
): Promise<EmailOtpVerifyState> {
  const ip = getClientIP(await headers());
  const rl = checkRateLimit(rateLimitKey("otp-verify", ip), 8, 15 * 60 * 1000, 15 * 60 * 1000);
  if (!rl.allowed) {
    const minutes = Math.max(1, Math.ceil((rl.retryAfterSeconds ?? 0) / 60));
    return { error: `Demasiados intentos fallidos. Espera ${minutes} min.` };
  }

  const parsed = otpVerifySchema.safeParse({
    identifier: formData.get("identifier"),
    otp: formData.get("otp"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los campos ingresados." };
  }

  const { identifier, otp, newPassword } = parsed.data;
  const admin = await findAdminByIdentifier(identifier);
  if (!admin) {
    burnPasswordCheckTime(newPassword);
    return { error: "Código OTP inválido o expirado." };
  }

  const now = new Date();
  const token = await prisma.passwordResetToken.findFirst({
    where: {
      adminId: admin.id,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!token || token.attempts >= MAX_OTP_ATTEMPTS) {
    return { error: "Código OTP inválido o expirado. Solicita uno nuevo." };
  }

  const expectedHex = hashResetOtp(admin.id, otp);
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(token.codeHash, "hex");
  const matches = a.length === b.length && timingSafeEqual(a, b);

  if (!matches) {
    const nextAttempts = token.attempts + 1;
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: {
        attempts: nextAttempts,
        ...(nextAttempts >= MAX_OTP_ATTEMPTS ? { usedAt: now } : {}),
      },
    });
    await logAudit({
      action: "PASSWORD_RESET_OTP_FAILED",
      adminId: admin.id,
      username: admin.username,
      ipAddress: ip,
      details: `Código OTP incorrecto (intento ${nextAttempts}/${MAX_OTP_ATTEMPTS})`,
    });
    return {
      error:
        nextAttempts >= MAX_OTP_ATTEMPTS
          ? "Código bloqueado por demasiados intentos. Solicita un nuevo código."
          : "Código OTP incorrecto. Revisa tu correo e intenta de nuevo.",
    };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: now },
    }),
    prisma.admin.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    }),
  ]);

  await logAudit({
    action: "PASSWORD_RESET_BY_EMAIL_OTP",
    adminId: admin.id,
    username: admin.username,
    ipAddress: ip,
    details: "Contraseña restablecida exitosamente usando código OTP de correo",
  });

  return { resetSuccess: true };
}
