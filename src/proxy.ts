import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Strict, nonce-based Content-Security-Policy. `middleware.ts` is deprecated
// in Next.js 16 in favor of `proxy.ts` (same request-interception model,
// renamed file convention) — see node_modules/next/dist/docs/.../proxy.md.
//
// A fresh nonce is minted on every request and threaded through so inline
// scripts/styles Next.js itself injects are allowed, while anything an
// attacker manages to inject (reflected/stored XSS) is not, because it
// won't carry a valid nonce. This forces dynamic rendering site-wide — a
// deliberate trade-off, logged in docs/security/hardening-log.md.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Fase 3 — panel admin: everything under /admin except the login page
  // itself requires a valid session JWT. Uses `jose` (WebCrypto), not
  // Node's `crypto` — this function runs in the Edge runtime.
  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (pathname === "/admin/login") {
      if (session) return NextResponse.redirect(new URL("/admin", request.url));
    } else if (!session) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`};
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    frame-src https://www.google.com;
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", cspHeader);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
