import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";

// Preview-only proxy for external candidate product photos (DuckDuckGo
// image search results). The site's CSP is `img-src 'self' blob: data:` —
// deliberately no external hosts, since a DDG image result can come from
// any arbitrary domain and can't be allowlisted — so a raw
// `<img src="https://...">` pointing at one of those candidates is simply
// blocked by the browser. This route re-serves the bytes from our own
// origin so the *picker* can show a thumbnail; it does NOT persist
// anything. The image actually gets kept only if an admin picks it and
// `downloadProductImageFromUrl` (upload-actions.ts) re-encodes it to disk
// through sharp, same as any other product photo.
const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function GET(request: NextRequest) {
  const ip = getClientIP(await headers());
  const rateCheck = checkRateLimit(rateLimitKey("image-proxy", ip), 60, 5 * 60 * 1000);
  if (!rateCheck.allowed) {
    return new Response("Demasiadas solicitudes.", { status: 429 });
  }

  const target = request.nextUrl.searchParams.get("url");
  if (!target) return new Response("Falta el parámetro url.", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("URL inválida.", { status: 400 });
  }
  if (parsed.protocol !== "https:") {
    return new Response("Solo se acepta HTTPS.", { status: 400 });
  }

  try {
    // Many product-listing sites hotlink-protect their images (403 to any
    // request without a browser-looking User-Agent, or whose Referer isn't
    // their own domain) — a bare fetch() with no headers gets rejected by
    // a real chunk of the DuckDuckGo candidates. A same-origin Referer is
    // the standard trick to pass that check on most sites (not all —
    // some also gate on cookies/session, which this can't replicate).
    const upstream = await fetch(parsed, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        // Explicitly asks for formats ALLOWED_TYPES actually supports —
        // an avif-first Accept header (the real Chrome default) makes some
        // CDNs content-negotiate to AVIF, which isn't in ALLOWED_TYPES and
        // would get rejected below for no good reason.
        accept: "image/jpeg,image/png,image/webp,image/gif,image/*;q=0.5",
        referer: `${parsed.origin}/`,
      },
    });
    if (!upstream.ok || !upstream.body) {
      console.error(`[image-proxy] upstream fetch failed: HTTP ${upstream.status} for ${parsed.origin}`);
      return new Response("No se pudo obtener la imagen.", { status: 502 });
    }

    const contentType = upstream.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!ALLOWED_TYPES.has(contentType)) {
      return new Response("Tipo de contenido no permitido.", { status: 415 });
    }
    const contentLength = Number(upstream.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BYTES) {
      return new Response("Imagen demasiado grande.", { status: 413 });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return new Response("Imagen demasiado grande.", { status: 413 });
    }

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[image-proxy] request threw for ${parsed.origin}: ${reason}`);
    return new Response("No se pudo obtener la imagen.", { status: 502 });
  }
}
