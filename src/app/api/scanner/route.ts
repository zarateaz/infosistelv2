import { NextRequest } from "next/server";
import { searchProductImages } from "@/lib/imageSearch";

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

// Motor 3 — DuckDuckGo Images, via the shared src/lib/imageSearch.ts (used
// when the product was found but has no image, or when the client sends a
// `manualQuery` for a product not in any barcode database).
const searchDuckDuckGoImages = searchProductImages;

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
