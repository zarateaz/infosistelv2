"use server";

import { z } from "zod";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";
import { verifyPassword, burnPasswordCheckTime } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session";

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

export interface LoginState {
  error?: string;
}

const GENERIC_ERROR = "Usuario o contraseña incorrectos.";

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
    return { error: `Demasiados intentos. Intenta de nuevo en ${minutes} min.` };
  }

  const { username, password } = parsed.data;
  const admin = await prisma.admin.findUnique({ where: { username } });

  if (!admin) {
    // Same cost as a real check, so a bad username isn't distinguishable
    // from a bad password by response time.
    burnPasswordCheckTime(password);
    return { error: GENERIC_ERROR };
  }

  const passwordOk = await verifyPassword(password, admin.passwordHash);
  if (!passwordOk) return { error: GENERIC_ERROR };

  const token = await createSessionToken({ sub: admin.id, username: admin.username, role: admin.role });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect("/taller-control");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/taller-control/login");
}
