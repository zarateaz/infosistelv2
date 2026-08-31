import { NextRequest } from "next/server";

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/scanner
//
// Body: { barcode?: string; manualQuery?: string }
//
// Cascade lookup:
//   Motor 1 → upcitemdb.com (free trial, no key)
//   Motor 2 → barcodespider.com (needs BARCODE_SPIDER_KEY)
//   Motor 3 → DuckDuckGo Images (for photos when product is found but has no
//             image, or when a manualQuery is provided for manual entry)
// ──────────────────────────────────────────────────────────────────────────────

interface ProductResult {
  found: boolean;
  title?: string;
  brand?: string;
  model?: string;
  description?: string;
  category?: string;
  image?: string;
  images?: string[];
  source?: string;
}

/** Motor 1 — upcitemdb.com trial endpoint (no key required, rate-limited). */
async function lookupUPCItemDB(barcode: string): Promise<ProductResult | null> {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const item = data?.items?.[0];
    if (!item?.title) return null;

    const imageUrl: string | undefined = Array.isArray(item.images)
      ? item.images.find(
          (img: unknown) =>
            typeof img === "string" && img.startsWith("https://")
        )
      : undefined;

    return {
      found: true,
      title: item.title || "",
      brand: item.brand || "",
      model: item.model || "",
      description: item.description || item.title || "",
      category: item.category || "",
      image: imageUrl,
      source: "upcitemdb",
    };
  } catch {
    return null;
  }
}

/** Motor 2 — barcodespider.com (requires BARCODE_SPIDER_KEY). */
async function lookupBarcodeSpider(
  barcode: string
): Promise<ProductResult | null> {
  const key = process.env.BARCODE_SPIDER_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://api.barcodespider.com/v2/products/${encodeURIComponent(barcode)}?key=${key}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const info = data?.item_attributes;
    if (!info?.title) return null;

    return {
      found: true,
      title: info.title || "",
      brand: info.brand || "",
      model: info.model || info.mpn || "",
      description: info.description || info.title || "",
      category: info.category || "",
      image: info.image || undefined,
      source: "barcodespider",
    };
  } catch {
    return null;
  }
}

/**
 * Motor 3 — DuckDuckGo Images. Used when the product was found but has no
 * image, or when the client sends a `manualQuery` for a product not in any
 * barcode database. Returns up to 4 image URLs.
 *
 * Talks to DuckDuckGo's own (undocumented, public) image-search endpoint
 * directly via `fetch` — this used to go through the `duckduckgo-images-api`
 * npm package, which pulled in an unmaintained `axios`/`follow-redirects`
 * chain with several high-severity CVEs (SSRF, prototype pollution) for
 * what is, underneath, two plain HTTP GETs. Same two requests, same
 * response shape, zero added dependencies — see hardening-log.md.
 */
const DDG_HEADERS: HeadersInit = {
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36",
  accept: "application/json, text/javascript, */*; q=0.01",
  "x-requested-with": "XMLHttpRequest",
  referer: "https://duckduckgo.com/",
};

async function searchDuckDuckGoImages(query: string): Promise<string[]> {
  const fullQuery = `${query} isolated white background product`;
  try {
    // Step 1: DuckDuckGo's HTML search page embeds a short-lived "vqd"
    // token in an inline script — the image endpoint rejects requests
    // without a valid one.
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(fullQuery)}`, {
      headers: DDG_HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!tokenRes.ok) return [];
    const html = await tokenRes.text();
    const token = html.match(/vqd=([\d-]+)&/)?.[1];
    if (!token) return [];

    // Step 2: the actual image search, moderate filter on (p=1).
    const imagesUrl =
      `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(fullQuery)}` +
      `&vqd=${token}&f=,,,&p=1`;
    const imagesRes = await fetch(imagesUrl, {
      headers: DDG_HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!imagesRes.ok) return [];

    const data = await imagesRes.json();
    if (!Array.isArray(data?.results)) return [];

    return data.results
      .slice(0, 4)
      .map((r: { image?: string }) => r.image)
      .filter(
        (url: unknown): url is string =>
          typeof url === "string" && url.startsWith("https://")
      );
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const barcode: string = typeof body.barcode === "string" ? body.barcode.trim() : "";
    const manualQuery: string =
      typeof body.manualQuery === "string" ? body.manualQuery.trim() : "";

    // ── Manual query path (no barcode, just a text search for photos) ────
    if (!barcode && manualQuery) {
      const images = await searchDuckDuckGoImages(manualQuery);
      return Response.json({
        found: false,
        images,
        source: "duckduckgo",
      });
    }

    if (!barcode) {
      return Response.json(
        { error: "Se requiere un código de barras o una consulta manual." },
        { status: 400 }
      );
    }

    // ── Cascade: Motor 1 → Motor 2 ──────────────────────────────────────
    let result = await lookupUPCItemDB(barcode);
    if (!result) {
      result = await lookupBarcodeSpider(barcode);
    }

    // Nothing found in either database
    if (!result) {
      return Response.json({
        found: false,
        barcode,
        images: [],
        source: "none",
      });
    }

    // ── Motor 3: fetch images if the product has no photo ────────────────
    let images: string[] = [];
    if (!result.image) {
      const searchQuery = [result.brand, result.model, result.title]
        .filter(Boolean)
        .join(" ");
      if (searchQuery) {
        images = await searchDuckDuckGoImages(searchQuery);
      }
    }

    return Response.json({
      ...result,
      images: result.image ? [result.image, ...images] : images,
    });
  } catch {
    return Response.json(
      { error: "Error interno en el escáner." },
      { status: 500 }
    );
  }
}
