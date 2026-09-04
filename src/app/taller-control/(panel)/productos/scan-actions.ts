"use server";

import { z } from "zod";
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";
import { searchProductImages } from "@/lib/imageSearch";

export interface BarcodeLookupResult {
  existingProductId?: string;
  existingProductName?: string;
  suggestion?: {
    name?: string;
    description?: string;
    category?: string;
    imageUrl?: string;
    /** Candidate photos from an image search — only populated when the
     *  listing itself had no photo, so the admin can pick one instead of
     *  always falling back to a manual upload. Raw external URLs: the
     *  caller must preview them through /api/image-proxy (CSP blocks
     *  hotlinking) and, on selection, persist via
     *  downloadProductImageFromUrl — never save the URL itself. */
    imageOptions?: string[];
  };
  source?: "local" | "external";
  notFound?: boolean;
}

/** Rough English/Spanish keyword → category map, matched against whatever
 *  a public UPC database returns (usually in English). Best-effort only —
 *  most of this store's inventory (generic cables, OEM parts) simply has
 *  no listing in free UPC databases at all; that's a real limitation of
 *  the data source, not a bug here. */
function guessCategory(text: string, categories: string[]): string | undefined {
  const normalized = text.toLowerCase();
  const rules: [RegExp, string[]][] = [
    [/laptop|notebook/, ["LAPTOPS"]],
    [/mouse|mice/, ["MOUSE"]],
    [/keyboard|teclado/, ["TECLADO"]],
    [/monitor|display/, ["MONITORES"]],
    [/printer|impresora/, ["IMPRESORAS"]],
    [/\bink\b|toner|cartridge|tinta|tóner|cartucho/, ["TINTAS", "TINTA Y TONER", "TINTAS Y TONERS", "CARTUCHOS"]],
    [/memory|ram|dimm/, ["RAM"]],
    [/ssd|solid state|nvme/, ["SSD"]],
    [/\bpc\b|desktop|computer tower/, ["PC"]],
    [/cable|adapter|adaptador/, ["CABLES Y ADAPTADORES"]],
  ];
  for (const [pattern, candidates] of rules) {
    if (pattern.test(normalized)) {
      const match = categories.find((c) => candidates.includes(c.toUpperCase()));
      if (match) return match;
    }
  }
  return undefined;
}

/** Falls back to the external listing's own category breadcrumb (e.g.
 *  "Electronics > Computers > Networking > Routers") when none of the
 *  fixed rules above match an EXISTING category — takes the last, most
 *  specific segment as a new category name instead of leaving the field
 *  blank. Whatever comes back here still goes through the same
 *  upsertCategory() as a manually-typed category when the product is
 *  saved, so a genuinely new category is created automatically. */
function extractCategoryGuess(rawCategory: string | undefined): string | undefined {
  if (!rawCategory) return undefined;
  const segments = rawCategory.split(">").map((s) => s.trim()).filter(Boolean);
  const last = segments[segments.length - 1];
  return last ? last.toUpperCase().slice(0, 60) : undefined;
}

/** Public UPC listings are almost always in English (upcitemdb is a US-
 *  centric database) — raw title/category keyword matches in guessCategory
 *  already come out in Spanish when they hit, but the listing's own
 *  description never does, and a fallback category (extractCategoryGuess)
 *  stayed in English too. This asks the same DeepSeek account already used
 *  elsewhere (text-only model, no vision needed) to translate+shorten the
 *  description to one plain Spanish sentence and, only when nothing already
 *  matched, propose a short Spanish category. Best-effort: any failure here
 *  just falls back to the raw listing text rather than blocking the lookup
 *  the admin is waiting on. */
async function translateListingToSpanish(
  title: string,
  rawDescription: string,
  guessedCategory: string | undefined,
  categories: string[]
): Promise<{ description: string; category?: string }> {
  try {
    // A schema property whose zod type varies (e.g. z.undefined() when
    // guessedCategory is already set) doesn't translate to valid JSON
    // Schema for the provider's structured-output call — it silently
    // fails the whole request rather than just omitting that field. Keep
    // `category` structurally always-optional instead, and steer whether
    // the model actually fills it purely through the prompt text below.
    const { object } = await generateObject({
      model: deepseek("deepseek-v4-flash"),
      schema: z.object({
        description: z
          .string()
          .describe("Descripción breve (una sola frase) en español, basada en el título y la descripción original."),
        category: z
          .string()
          .optional()
          .describe(
            guessedCategory
              ? "No se usa — omite este campo."
              : "Categoría del producto en español: usa una de las existentes si encaja bien; si ninguna encaja, propone una nueva categoría corta (2-3 palabras), siempre en español."
          ),
      }),
      messages: [
        {
          role: "user",
          content: `Título del producto: ${title}
Descripción original (puede estar en inglés, es de una base pública de códigos de barra): ${rawDescription.slice(0, 800)}
${
  guessedCategory
    ? ""
    : `Categorías ya existentes en el catálogo: ${categories.length > 0 ? categories.join(", ") : "(ninguna todavía)"}.`
}
Traduce y resume la descripción en una sola frase en español, sin inventar datos que no estén en el texto original.`,
        },
      ],
    });
    return { description: object.description, category: object.category };
  } catch (err) {
    // Best-effort by design (never block the lookup over this), but silent
    // failures here are exactly what let the z.undefined() schema bug ship
    // unnoticed — this makes the next one visible in `pm2 logs` instead.
    console.error("[scan-actions] translateListingToSpanish failed:", err);
    return { description: rawDescription };
  }
}

async function lookupExternalUPC(
  barcode: string,
  categories: string[]
): Promise<BarcodeLookupResult> {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { notFound: true, source: "external" };

    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) return { notFound: true, source: "external" };

    const title: string = item.title || [item.brand, item.model].filter(Boolean).join(" ") || "";
    if (!title) return { notFound: true, source: "external" };

    const guessedCategory = guessCategory(`${title} ${item.category ?? ""}`, categories);
    const translated = await translateListingToSpanish(
      title,
      item.description || title,
      guessedCategory,
      categories
    );
    const category = guessedCategory ?? translated.category ?? extractCategoryGuess(item.category);
    // upcitemdb mixes http:// and https:// sources in the same array —
    // downloadProductImageFromUrl only accepts https, so pick the first
    // one that qualifies instead of always trying images[0].
    const imageUrl: string | undefined = Array.isArray(item.images)
      ? item.images.find((img: unknown) => typeof img === "string" && img.startsWith("https://"))
      : undefined;

    // The listing itself has no photo (the common case — see the comment
    // on guessCategory: most of this store's inventory has no public UPC
    // listing at all, and even a matched listing often lacks images). Fall
    // back to an image search instead of leaving the admin to always find
    // a photo by hand. Appending the category (when known) disambiguates a
    // bare model number that's reused across unrelated product lines — see
    // the same fix in recognizeProductImage below.
    const searchQuery = category ? `${title} ${category}` : title;
    const imageOptions = imageUrl
      ? undefined
      : await searchProductImages(searchQuery, 4, category ? title : undefined);

    return {
      source: "external",
      suggestion: {
        name: title.slice(0, 150).toUpperCase(),
        description: translated.description.slice(0, 500).toUpperCase(),
        category,
        imageUrl,
        imageOptions: imageOptions && imageOptions.length > 0 ? imageOptions : undefined,
      },
    };
  } catch {
    // Network hiccup, timeout, or the trial endpoint's rate limit — this
    // path is best-effort by design, never block on it.
    return { notFound: true, source: "external" };
  }
}

export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
  const clean = barcode.trim();
  if (!clean) return { notFound: true };

  // Local DB first — this is what actually matters day to day: does this
  // exact item already exist in the catalog (restock), so we don't create
  // a duplicate entry for the same product.
  const existing = await prisma.product.findUnique({
    where: { barcode: clean },
    select: { id: true, name: true },
  });
  if (existing) {
    return { existingProductId: existing.id, existingProductName: existing.name, source: "local" };
  }

  const categories = (await prisma.category.findMany({ select: { name: true } })).map((c) => c.name);
  return lookupExternalUPC(clean, categories);
}

export interface RecognizeImageResult {
  name?: string;
  description?: string;
  category?: string;
  /** Candidate photos found from the recognized product name — same
   *  picker/flow as the barcode lookup's imageOptions. Populated whenever
   *  recognition succeeds, so a product with no barcode listing at all can
   *  still get real photos straight from a single box photo instead of a
   *  manual search. */
  imageOptions?: string[];
  /** Set when a product with (essentially) this same name already exists
   *  in the catalog — same "no dupliques lo que ya subiste" warning the
   *  barcode flow already gives when the exact barcode matches, just
   *  matched by name instead since a re-scanned box has no barcode to
   *  compare here. */
  existingProductId?: string;
  existingProductName?: string;
  error?: string;
}

/** Exact match first (both sides are already uppercased on save — see
 *  createProduct/updateProduct), then a loose `contains` in either
 *  direction so "MICRONICS MP-350" still catches an existing
 *  "MICRONICS MP-350 FUENTE POWER 250W" typed with extra words, and vice
 *  versa. Good enough to stop the obvious re-scan-the-same-box case
 *  without a full fuzzy-matching library for what's meant to be a quick
 *  heads-up, not a hard block — the admin still decides. */
async function findExistingProductByName(
  name: string
): Promise<{ id: string; name: string } | null> {
  const normalized = name.trim().toUpperCase();
  if (!normalized) return null;

  const exact = await prisma.product.findFirst({
    where: { name: normalized },
    select: { id: true, name: true },
  });
  if (exact) return exact;

  return prisma.product.findFirst({
    where: { name: { contains: normalized } },
    select: { id: true, name: true },
  });
}

export async function recognizeProductImage(
  dataUrl: string
): Promise<RecognizeImageResult> {
  if (!process.env.DEEPSEEK_API_KEY) {
    return { error: "El reconocimiento por IA no está configurado (falta DEEPSEEK_API_KEY)." };
  }

  // This is behind admin auth (proxy.ts), but each call still costs real
  // money — a stuck client-side retry loop shouldn't be able to run it
  // unbounded. Same defense as the public chat endpoint, generous limit
  // since it's a trusted, low-volume user.
  const ip = getClientIP(await headers());
  const rateCheck = checkRateLimit(rateLimitKey("recognize-product", ip), 20, 5 * 60 * 1000);
  if (!rateCheck.allowed) {
    return { error: "Demasiadas fotos procesadas seguidas. Intenta de nuevo en unos minutos." };
  }

  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return { error: "Formato de imagen no válido." };
  }
  const [, mimeType, base64] = match;

  try {
    const categories = (await prisma.category.findMany({ select: { name: true } })).map((c) => c.name);

    const { object } = await generateObject({
      // deepseek-v4-flash-vision-exp reuses the same DEEPSEEK_API_KEY
      // already configured for the public chatbot (src/app/api/chat) —
      // no separate account/key needed for this admin-only feature.
      // "-exp" (experimental) in the model id is DeepSeek's own naming,
      // not a signal to avoid it for real use.
      model: deepseek("deepseek-v4-flash-vision-exp"),
      schema: z.object({
        name: z
          .string()
          .describe(
            "Nombre comercial corto del producto, en español. Si es tinta, tóner o cartucho: el color (Negro/Cian/Magenta/Amarillo/Tricolor) es OBLIGATORIO al final del nombre — sin eso, tintas del mismo modelo y distinto color quedan indistinguibles en el catálogo."
          ),
        description: z.string().describe("Descripción breve (1-2 frases) basada en lo que dice la caja."),
        category: z
          .string()
          .describe(
            "Categoría del producto: usa una de las existentes si encaja bien; si ninguna encaja, propone una nueva categoría corta (2-3 palabras)."
          ),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Esta es una foto de la caja o etiqueta de un producto de una tienda de tecnología. Lee la marca, modelo y especificaciones impresas para completar los datos. Si no puedes leer algo con certeza, no lo inventes.

Si el producto es una tinta, tóner o cartucho: el modelo impreso suele ser IGUAL para las 4 variantes de color (ej. "GT53" para negro, cian, magenta y amarillo de la misma línea), así que el modelo SOLO no alcanza para identificar cuál es. Identifica el color exacto de dos formas y usa la que te dé más certeza:
1) texto impreso (Negro/Black, Cian/Cyan, Magenta, Amarillo/Yellow, Tricolor/Tri-color), y
2) el color visible de la tapa, etiqueta o la tinta/tóner en sí si se ve a través de un empaque transparente.
Incluye ese color al final de "name" (ej. "TINTA HP GT53 NEGRO", "TINTA HP GT53 CIAN") y menciona la capacidad (ml/gr) en "description" si se lee — hay presentaciones del mismo color en distintos tamaños.

Categorías ya existentes en el catálogo: ${categories.length > 0 ? categories.join(", ") : "(ninguna todavía)"}.
Para "category": usa una de esas si el producto encaja claramente; si no encaja en ninguna, propón una categoría nueva y corta (nunca dejes el campo vacío).`,
            },
            // "image" content parts are deprecated in ai@7 — "file" with a
            // bare base64 `data` is the replacement (see @ai-sdk/provider-utils).
            { type: "file", data: base64, mediaType: mimeType },
          ],
        },
      ],
    });

    // Catch a re-scan of a box already in the catalog before spending time
    // (and, for the image search below, a DuckDuckGo request) on a product
    // that's just going to get flagged as a duplicate anyway.
    const existing = await findExistingProductByName(object.name);
    if (existing) {
      return {
        name: object.name.toUpperCase(),
        description: object.description.toUpperCase(),
        category: object.category.toUpperCase(),
        existingProductId: existing.id,
        existingProductName: existing.name,
      };
    }

    // Best-effort, same as the barcode flow's imageOptions — a failed
    // search just means no photo suggestions, never blocks the recognition
    // result the admin is waiting on. searchProductImages already logs its
    // own failures internally; this .catch is only a safety net in case it
    // ever throws unexpectedly.
    //
    // Search by name ALONE, without the category, routinely returns
    // completely unrelated products: a model number like "MP550" is reused
    // across unrelated product lines (a Micronics power supply vs. a
    // Compumatic time clock, observed in production), and DuckDuckGo has no
    // way to disambiguate without more context. Appending the category the
    // vision model just read off the box narrows it back down.
    const imageOptions = await searchProductImages(`${object.name} ${object.category}`, 4, object.name).catch(
      (err) => {
        console.error("[scan-actions] searchProductImages threw unexpectedly:", err);
        return [];
      }
    );

    return {
      name: object.name.toUpperCase(),
      description: object.description.toUpperCase(),
      category: object.category.toUpperCase(),
      imageOptions: imageOptions.length > 0 ? imageOptions : undefined,
    };
  } catch (err) {
    // Logged (never silent) so a DeepSeek outage/auth/quota failure shows
    // up in `pm2 logs` instead of just being a generic error on screen.
    console.error("[scan-actions] recognizeProductImage failed:", err);
    return { error: "No se pudo procesar la imagen. Intenta con otra foto más clara." };
  }
}
