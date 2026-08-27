import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removes the "X-Powered-By: Next.js" response header — no reason to hand
  // an attacker a free framework fingerprint for free.
  poweredByHeader: false,

  experimental: {
    serverActions: {
      // Default is 1MB. The inventory scanner sends photos as base64 data
      // URLs straight into a Server Action (uploadProductImage,
      // recognizeProductImage) — base64 alone adds ~33% overhead on top of
      // the 8MB raw-file cap those actions enforce themselves, so this
      // needs real headroom above that, not just above the file size.
      bodySizeLimit: "12mb",
    },
  },

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
            // Public site never needs camera/mic/geolocation. /admin gets a
            // narrower override below for the barcode scanner's camera —
            // never `self` here, so no public page can ever request it.
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
      {
        // Narrower than the blanket policy above — Next.js applies both,
        // and a header value repeated for the same matched path is
        // overwritten by the later entry, so this one wins under /admin
        // specifically. The inventory scanner is the one place on the
        // whole site that needs the camera (reading a barcode off a photo
        // or live feed); nothing under /admin needs mic or geolocation.
        source: "/admin/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
