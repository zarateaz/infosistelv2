/**
 * lib/session.ts
 * Admin session JWTs, signed/verified with `jose` — pure WebCrypto, so this
 * file is safe to import from both Node routes/Server Actions AND
 * `proxy.ts` (Edge runtime). Password hashing (Node-only `scrypt`) lives in
 * `lib/auth.ts` instead; never merge the two files.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "infosistel_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h — short-lived, re-login after a workday

interface SessionPayload extends JWTPayload {
  sub: string; // Admin.id
  username: string;
}

function getSecretKey() {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string" || typeof payload.username !== "string") return null;
    return { sub: payload.sub, username: payload.username };
  } catch {
    // Expired, malformed, or wrong-signature token — all treated the same:
    // no session.
    return null;
  }
}
