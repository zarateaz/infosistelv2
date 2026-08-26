import { NextRequest, NextResponse } from "next/server";

// Strict, nonce-based Content-Security-Policy. `middleware.ts` is deprecated
// in Next.js 16 in favor of `proxy.ts` (same request-interception model,
// renamed file convention) — see node_modules/next/dist/docs/.../proxy.md.
//
// A fresh nonce is minted on every request and threaded through so inline
// scripts/styles Next.js itself injects are allowed, while anything an
// attacker manages to inject (reflected/stored XSS) is not, because it
// won't carry a valid nonce. This forces dynamic rendering site-wide — a
// deliberate trade-off, logged in docs/security/hardening-log.md.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`};
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
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
