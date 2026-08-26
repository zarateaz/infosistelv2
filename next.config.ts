import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removes the "X-Powered-By: Next.js" response header — no reason to hand
  // an attacker a free framework fingerprint for free.
  poweredByHeader: false,

  // Static security headers that don't depend on a per-request nonce (that
  // one lives in src/proxy.ts, alongside the Content-Security-Policy).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // No feature this site uses today needs camera/mic/geolocation —
            // revisit when the barcode-scanner admin feature (later phase)
            // actually needs `camera=(self)`.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            // Only takes effect once served over HTTPS on the real VPS —
            // harmless on plain http:// localhost in the meantime.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
