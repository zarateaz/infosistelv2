import { z } from "zod";

// Validated once at import time so a missing/malformed env var fails fast at
// boot — instead of surfacing as a confusing runtime error deep in a request
// handler. Extend this schema in the same commit that starts reading a new
// env var (see docs/security/hardening-log.md for what each var protects).
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see .env.example)"),
  // Fase 3 — panel admin. Signs/verifies the admin session JWT (lib/session.ts).
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters (see .env.example: openssl rand -base64 64)"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "FATAL: Invalid environment configuration.\n" +
      z.prettifyError(parsed.error)
  );
  throw new Error("Invalid environment configuration — see stderr for details.");
}

export const env = parsed.data;
