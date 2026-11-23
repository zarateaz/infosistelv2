"use server";

import { z } from "zod";
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { loadProductThumb } from "@/lib/productThumbs";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";
import { searchProductImages } from "@/lib/imageSearch";
import {
  findBestDuplicateMatch,
  rankSimilarProducts,
  normalizeText,
  extractBrand,
  extractProductBrand,
  type ProductSummary,
  type RankedCandidate,
} from "@/lib/duplicateDetection";
import { translateCategoryToSpanish } from "@/lib/categoryUtils";
import { downloadTopProductImages } from "./upload-actions";

export interface BarcodeLookupResult {
  existingProductId?: string;
  existingProductName?: string;
  existingProduct?: ProductSummary;
  suggestion?: {
    name?: string;
    description?: string;
    category?: string;
    price?: number;
    costPrice?: number;
    stock?: number;
    image?: string;
    images?: string[];
    imageUrl?: string;
    imageOptions?: string[];
  };
  source?: "local" | "external";
  notFound?: boolean;
  /** Similar catalog products the admin must confirm or discard before creating a new one */
  possibleMatches?: ProductSummary[];
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  barcode: true,
  category: true,
  price: true,
  costPrice: true,
  stock: true,
  image: true,
  images: true,
  description: true,
} as const;

function normalizeBarcode(code: string | null | undefined): string {
  return (code ?? "").replace(/[^0-9A-Za-z]/g, "").replace(/^0+/, "").toUpperCase();
}

/** Translates & matches barcode search keywords to standardized Spanish categories. */
function guessCategory(text: string, categories: string[]): string | undefined {
  const normalized = text.toLowerCase();
  const rules: [RegExp, string[]][] = [
    [/laptop|notebook|portatil|portátil/, ["LAPTOPS"]],
    [/mouse|mice|raton|ratón/, ["TECLADOS Y MOUSE", "MOUSE"]],
    [/keyboard|teclado/, ["TECLADOS Y MOUSE", "TECLADO"]],
    [/monitor|display|pantalla/, ["MONITORES Y PANTALLAS", "MONITORES"]],
    [/printer|impresora|multifuncional/, ["IMPRESORAS"]],
    [/\bink\b|toner|cartridge|tinta|tóner|cartucho/, ["TINTAS Y TÓNERS", "TINTAS", "TINTA Y TONER", "CARTUCHOS"]],
    [/memory|ram|dimm|sodimm/, ["COMPONENTES DE PC", "RAM", "MEMORIAS RAM"]],
    [/ssd|solid state|nvme|hard drive|disco duro|enclosure|case.*2\.5|caja.*disco/, ["ALMACENAMIENTO", "SSD"]],
    [/\bpc\b|desktop|computer tower|computadora/, ["COMPUTADORAS Y PC", "PC"]],
    [/cable|adapter|adaptador|hdmi|vga|usb-c|hub|convertidor/, ["CABLES Y ADAPTADORES"]],
    [/router|switch|wifi|redes|ethernet|access point|repetidor/, ["REDES Y CONECTIVIDAD"]],
    [/charger|cargador|bateria|battery|power|ups|estabilizador|fuente/, ["CARGADORES Y ENERGÍA"]],
    [/audio|headphone|auricular|audifono|parlante|speaker|microfono/, ["AUDIO Y SONIDO"]],
    [/soporte|stand|holder|funda|mochila|maletin|pad/, ["ACCESORIOS"]],
  ];
  for (const [pattern, candidates] of rules) {
    if (pattern.test(normalized)) {
      const match = categories.find((c) => candidates.includes(c.toUpperCase()));
      if (match) return translateCategoryToSpanish(match);
      return candidates[0];
    }
  }
  return undefined;
}

/** Translates raw external category breadcrumbs to standardized Spanish. */
function extractCategoryGuess(rawCategory: string | undefined, productName?: string): string | undefined {
  if (!rawCategory && !productName) return undefined;
  if (!rawCategory) return translateCategoryToSpanish("ACCESORIOS", productName);
  const segments = rawCategory.split(">").map((s) => s.trim()).filter(Boolean);
  const last = segments[segments.length - 1];
  return translateCategoryToSpanish(last || rawCategory, productName);
}

async function translateListingToSpanish(
  title: string,
  rawDescription: string,
  guessedCategory: string | undefined,
  categories: string[]
): Promise<{
  name: string;
  description: string;
  category?: string;
}> {
  try {
    const { object } = await generateObject({
      model: deepseek("deepseek-v4-flash"),
      schema: z.object({
        name: z
          .string()
          .describe(
            "Nombre comercial técnico en español y en MAYÚSCULAS (Tipo de producto + Marca + Modelo + Especificaciones clave como longitud, capacidad, versión o color)."
          ),
        description: z
          .string()
          .describe(
            "Descripción comercial y técnica completa en español (2 frases claras y directas para catálogo de tienda tecnológica), basada en el título y descripción original."
          ),
        category: z
          .string()
          .optional()
          .describe(
            guessedCategory
              ? "No se usa — omite este campo."
              : "Categoría del producto en español y en mayúsculas."
          ),
      }),
      messages: [
        {
          role: "user",
          content: `Título original del producto: ${title}
Descripción original: ${rawDescription.slice(0, 800)}
${
  guessedCategory
    ? ""
    : `Categorías existentes en el catálogo: ${categories.length > 0 ? categories.join(", ") : "(ninguna)"}.`
}
Traduce y estandariza el nombre y la descripción al español para la tienda tecnológica INFOSISTEL en Perú.`,
        },
      ],
    });
    return {
      name: object.name || title,
      description: object.description,
      category: object.category,
    };
  } catch (err) {
    console.error("[scan-actions] translateListingToSpanish failed:", err);
    return { name: title, description: rawDescription };
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
    const finalName = translated.name.slice(0, 150).toUpperCase();
    const rawCategory = guessedCategory ?? translated.category ?? extractCategoryGuess(item.category, finalName);
    const category = translateCategoryToSpanish(rawCategory, finalName);

    const listingImages: string[] = Array.isArray(item.images)
      ? item.images.filter((img: unknown): img is string => typeof img === "string" && img.startsWith("https://"))
      : [];

    const searchedImages = await searchProductImages({
      queries: [title, `${title} product`, finalName],
      productName: finalName,
      category,
      max: 8,
    });

    const combinedCandidates = Array.from(new Set([...listingImages, ...searchedImages]));
    const downloaded = await downloadTopProductImages(combinedCandidates, 4);

    return {
      source: "external",
      suggestion: {
        name: finalName,
        description: translated.description.slice(0, 500).toUpperCase(),
        category,
        // Precio inicial SIEMPRE en 0: el admin pone el precio real (nada estimado por IA)
        price: 0,
        costPrice: 0,
        stock: 1,
        image: downloaded.cover,
        images: downloaded.gallery,
        imageUrl: listingImages[0],
        imageOptions: combinedCandidates.length > 0 ? combinedCandidates : undefined,
      },
    };
  } catch {
    return { notFound: true, source: "external" };
  }
}

export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
  const clean = barcode.trim();
  if (!clean) return { notFound: true };

  // 1. Local DB lookup (exact, leading zeros, spaces/guiones normalizados)
  const allProducts: ProductSummary[] = await prisma.product.findMany({ select: PRODUCT_SELECT });
  const target = normalizeBarcode(clean);
  const existing = target
    ? allProducts.find((p) => p.barcode && normalizeBarcode(p.barcode) === target)
    : undefined;
  if (existing) {
    return {
      existingProductId: existing.id,
      existingProductName: existing.name,
      existingProduct: existing,
      source: "local",
    };
  }

  // 2. Query external UPC database
  const categories = (await prisma.category.findMany({ select: { name: true } })).map((c) => c.name);
  const externalResult = await lookupExternalUPC(clean, categories);

  // If external suggestion found, check if that item already exists locally (registered sin código)
  if (externalResult.suggestion?.name) {
    const match = findBestDuplicateMatch(
      { name: externalResult.suggestion.name, description: externalResult.suggestion.description },
      allProducts
    );
    if (match.isDuplicate && match.existingProduct) {
      return {
        existingProductId: match.existingProduct.id,
        existingProductName: match.existingProduct.name,
        existingProduct: match.existingProduct,
        source: "local",
      };
    }
    const similar = rankSimilarProducts(
      { name: externalResult.suggestion.name, description: externalResult.suggestion.description },
      // A product that already has a DIFFERENT barcode is, by definition, another product
      allProducts.filter((p) => !p.barcode),
      3,
      0.45
    );
    if (similar.length > 0) externalResult.possibleMatches = similar.map((r) => r.product);
  }

  return externalResult;
}

export interface RecognizeImageResult {
  name?: string;
  description?: string;
  category?: string;
  barcode?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  /** Pre-downloaded cover photo (/img/products/<uuid>.webp) */
  image?: string;
  /** Pre-downloaded 3 extra gallery photos (/img/products/<uuid>.webp) */
  images?: string[];
  /** All 4 local paths [cover, ...gallery] */
  appliedLocalImages?: string[];
  imageOptions?: string[];
  existingProductId?: string;
  existingProductName?: string;
  existingProduct?: ProductSummary;
  /** Why the existing product was chosen (shown to the admin) */
  matchReason?: string;
  /** Similar catalog products the admin must confirm or discard before creating a new one */
  possibleMatches?: ProductSummary[];
  error?: string;
}

const VISION_MODEL = "deepseek-v4-flash-vision-exp";
interface VisualVerdict {
  /** index into the shortlist, or -1 */
  index: number;
  confidence: "exacto" | "probable" | "ninguno";
  reason: string;
}

/**
 * Second AI pass: the model looks at the admin's photo AND the shortlisted catalog
 * products (name, code, and their own photo when available) and says which one it is.
 */
async function verifyAgainstCatalog(
  photoBase64: string,
  photoMime: string,
  recognized: { name: string; brand?: string; model?: string; visibleText?: string[] },
  shortlist: ProductSummary[]
): Promise<VisualVerdict | null> {
  if (shortlist.length === 0) return null;

  const listText = shortlist
    .map((p, i) => {
      const parts = [`#${i + 1}: ${p.name}`];
      if (p.barcode) parts.push(`código: ${p.barcode}`);
      if (p.category) parts.push(`categoría: ${p.category}`);
      if (p.description) parts.push(`desc: ${p.description.slice(0, 140)}`);
      return parts.join(" | ");
    })
    .join("\n");

  const schema = z.object({
    matchNumber: z
      .number()
      .int()
      .min(0)
      .max(shortlist.length)
      .describe("Número del producto del catálogo que es EXACTAMENTE el de la foto, o 0 si ninguno lo es."),
    confidence: z
      .enum(["exacto", "probable", "ninguno"])
      .describe(
        "'exacto' = misma marca, mismo modelo y misma variante (capacidad, color, medida, potencia) sin duda. 'probable' = parece el mismo pero la foto no permite confirmar la variante o el modelo. 'ninguno' = no está en la lista."
      ),
    reason: z.string().describe("Explicación breve en español (máx. 1 frase)."),
  });

  const intro = `Eres el verificador de inventario de INFOSISTEL. La PRIMERA imagen es la foto que acaba de tomar el administrador.
Lectura previa de la foto: nombre="${recognized.name}"${recognized.brand ? `, marca="${recognized.brand}"` : ""}${recognized.model ? `, modelo="${recognized.model}"` : ""}${recognized.visibleText?.length ? `, texto visible="${recognized.visibleText.slice(0, 15).join(" / ")}"` : ""}.

Estos productos YA EXISTEN en la tienda (los nombres fueron escritos a mano o por otra IA, así que pueden estar redactados distinto):
${listText}

Decide si la foto corresponde a UNO de esos productos. Reglas estrictas:
- Mismo producto = misma marca + mismo modelo + misma variante (capacidad GB/TB, color, longitud, potencia W, voltaje/amperaje, versión). Si cualquiera difiere, NO es el mismo.
- El nombre puede estar escrito distinto (orden, sinónimos, español/inglés): fíjate en lo que es, no en cómo está escrito.
- Si aparece un código de modelo/SKU en la foto y en el catálogo, deben coincidir.
- Si dudas entre dos variantes o la foto no deja ver el detalle, responde 'probable', nunca 'exacto'.`;

  const thumbs = await Promise.all(shortlist.slice(0, 6).map((p) => loadProductThumb(p.image)));

  type Part =
    | { type: "text"; text: string }
    | { type: "file"; data: string; mediaType: string };
  const textOnly: Part[] = [
    { type: "text", text: intro },
    { type: "file", data: photoBase64, mediaType: photoMime },
  ];
  const withThumbs: Part[] = [...textOnly];
  thumbs.forEach((t, i) => {
    if (!t) return;
    withThumbs.push({ type: "text", text: `Foto de catálogo del producto #${i + 1}:` });
    withThumbs.push({ type: "file", data: t, mediaType: "image/jpeg" });
  });

  const attempts = withThumbs.length > textOnly.length ? [withThumbs, textOnly] : [textOnly];
  for (const content of attempts) {
    try {
      const { object } = await generateObject({
        model: deepseek(VISION_MODEL),
        schema,
        messages: [{ role: "user", content }],
      });
      const index = object.matchNumber >= 1 ? object.matchNumber - 1 : -1;
      return {
        index,
        confidence: index === -1 ? "ninguno" : object.confidence,
        reason: object.reason,
      };
    } catch (err) {
      console.error("[scan-actions] verifyAgainstCatalog attempt failed:", err);
    }
  }
  return null;
}

function existingResult(
  product: ProductSummary,
  reason: string,
  fallback: { description: string; category: string; barcode?: string }
): RecognizeImageResult {
  return {
    name: product.name,
    description: product.description ?? fallback.description,
    category: product.category ?? fallback.category,
    // If the catalog product had no barcode, keep the one read from the photo so the
    // next scan is an exact barcode hit.
    barcode: product.barcode ?? fallback.barcode,
    price: product.price,
    costPrice: product.costPrice ?? 0,
    stock: product.stock ?? 0,
    existingProductId: product.id,
    existingProductName: product.name,
    existingProduct: product,
    matchReason: reason,
  };
}

export async function recognizeProductImage(
  dataUrl: string
): Promise<RecognizeImageResult> {
  if (!process.env.DEEPSEEK_API_KEY) {
    return { error: "El reconocimiento por IA no está configurado (falta DEEPSEEK_API_KEY)." };
  }

  let ip = "127.0.0.1";
  try {
    ip = getClientIP(await headers());
  } catch {}
  const rateCheck = checkRateLimit(rateLimitKey("recognize-product", ip), 30, 5 * 60 * 1000);
  if (!rateCheck.allowed) {
    return { error: "Demasiadas fotos procesadas seguidas. Intenta de nuevo en unos minutos." };
  }

  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return { error: "Formato de imagen no válido." };
  }
  const [, mimeType, base64] = match;

  try {
    const [categoriesRows, existingProducts] = await Promise.all([
      prisma.category.findMany({ select: { name: true } }),
      prisma.product.findMany({ select: PRODUCT_SELECT, orderBy: { itemNumber: "asc" } }),
    ]);

    const categories = categoriesRows.map((c) => c.name);

    const { object } = await generateObject({
      model: deepseek(VISION_MODEL),
      schema: z.object({
        brand: z
          .string()
          .optional()
          .describe("Marca EXACTA impresa en el producto o la caja (ej. 'LOGITECH', 'AMERICAN NET', 'UGREEN'). Vacío si no se ve."),
        model: z
          .string()
          .optional()
          .describe("Código de modelo / SKU / número de parte EXACTO impreso (ej. 'G203', 'TL-WN725N', 'SDCS2/64GB'). Copia los caracteres tal cual. Vacío si no se ve; NO lo inventes."),
        visibleText: z
          .array(z.string())
          .optional()
          .describe("Textos impresos legibles en el producto/caja/etiqueta, copiados literalmente (máx. 20)."),
        name: z
          .string()
          .describe(
            "Nombre comercial exacto en español y en MAYÚSCULAS para catálogo (máx. 140 caracteres). Estructura obligatoria: TIPO DE PRODUCTO + MARCA + MODELO EXACTO + ESPECIFICACIONES CLAVE (medida/longitud si es cable, versión HDMI/USB/Cat, resolución/velocidad, capacidad GB/TB o color)."
          ),
        description: z
          .string()
          .describe(
            "Descripción comercial y técnica profesional en español y en MAYÚSCULAS (2 a 3 frases listas para publicar en la tienda). Incluye marca, modelo, características técnicas completas, puertos/conectores, medidas y compatibilidad. PROHIBIDO escribir frases como 'la imagen muestra', 'en la foto se observa' o 'no se aprecian etiquetas'."
          ),
        category: z
          .string()
          .describe(
            "Categoría exacta en ESPAÑOL y en MAYÚSCULAS: 'LAPTOPS', 'COMPUTADORAS Y PC', 'MONITORES Y PANTALLAS', 'IMPRESORAS', 'TINTAS Y TÓNERS', 'ALMACENAMIENTO', 'COMPONENTES DE PC', 'TECLADOS Y MOUSE', 'AUDIO Y SONIDO', 'REDES Y CONECTIVIDAD', 'CABLES Y ADAPTADORES', 'CARGADORES Y ENERGÍA', 'SEGURIDAD Y CÁMARAS', 'ACCESORIOS' o 'PERIFÉRICOS'."
          ),
        barcode: z
          .string()
          .optional()
          .describe(
            "Si en la foto aparece impreso un código de barras (EAN-13, UPC o SKU numérico legible), extrae solo los dígitos exactos. Si no hay código de barras legible, déjalo vacío."
          ),
        detectedStock: z
          .number()
          .int()
          .positive()
          .default(1)
          .describe("Cantidad de unidades para ingresar a stock (por defecto 1)."),
        searchQueries: z
          .array(z.string())
          .describe(
            "3 consultas de búsqueda ultra específicas (combinando Marca + Código de modelo/SKU exacto + nombre de producto en inglés y español) para encontrar las 4 mejores fotos oficiales de catálogo con fondo limpio."
          ),
        negativeKeywords: z
          .array(z.string())
          .optional()
          .describe(
            "Palabras clave de productos parecidos pero incorrectos que deben filtrarse."
          ),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Eres el sistema experto de catalogación e inventario con IA de INFOSISTEL (Huancayo, Perú).
Analiza esta foto de producto/caja/etiqueta con CERO MARGEN DE ERROR y completa todos los datos:

0. LECTURA LITERAL (lo más importante, se usa para no duplicar productos):
- 'brand', 'model', 'visibleText' y 'barcode': copia EXACTAMENTE lo que está impreso. Si no se lee, déjalo vacío. NUNCA inventes un modelo ni un código.

1. PRECISIÓN DE RECONOCIMIENTO (0 MARGEN DE ERROR):
- 'name': Nombre comercial claro en español y en MAYÚSCULAS (Tipo de producto + Marca + Modelo exacto + Medida/Capacidad/Color/Versión). Ejemplos: "MOUSE LOGITECH G203 LIGHTSYNC RGB NEGRO", "CABLE UGREEN USB-C A USB-C 100W 1M", "ADAPTADOR DE CORRIENTE AMERICAN NET 5V 2.5A".
  REGLA DE MARCA CRÍTICA: Si la marca en el producto o caja es 'American NET', escribe siempre 'AMERICAN NET' completo (NUNCA solo 'American', para no confundir con aerolíneas u otros rubros).
- 'category': Categoría exacta en español ${categories.length > 0 ? `(elige entre: ${categories.join(", ")})` : "('LAPTOPS', 'ACCESORIOS', 'ALMACENAMIENTO', 'CABLES Y ADAPTADORES', 'REDES Y CONECTIVIDAD', 'TECLADOS Y MOUSE', 'AUDIO Y SONIDO', 'IMPRESORAS', 'TINTAS Y TÓNERS', 'MONITORES Y PANTALLAS', 'COMPONENTES DE PC', 'CARGADORES Y ENERGÍA', 'SEGURIDAD Y CÁMARAS', 'COMPUTADORAS Y PC')"}.
- 'description': Redacción comercial y técnica impecable en español para la ficha del producto. NUNCA menciones "la foto muestra" ni "no se ve en la imagen".
- 'searchQueries': 3 búsquedas precisas combinando tipo de producto de hardware y marca completa (ej: "American NET adaptador corriente 5V 2.5A", "American NET 5V 2.5A power adapter", etc.). PROHIBIDO escribir solo 'American' o términos genéricos sin producto tecnológico.
- 'negativeKeywords': Incluye términos que deben filtrarse (ej: 'avion', 'aviones', 'airplane', 'airline', 'airlines', 'boeing', 'flight', 'vuelo', 'aerolinea', 'aeropuerto', 'ropa', 'deporte').`,
            },
            { type: "file", data: base64, mediaType: mimeType },
          ],
        },
      ],
    });

    const cleanName = object.name.trim().toUpperCase();
    const cleanDescription = object.description.trim().toUpperCase();
    const cleanBarcode = object.barcode?.replace(/[^0-9A-Za-z-]/g, "").trim() || undefined;
    const cleanBrand = object.brand?.trim() || undefined;
    const cleanModel = object.model?.trim() || undefined;
    const visibleText = (object.visibleText ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const categoryInSpanish = translateCategoryToSpanish(object.category, cleanName);
    const fallback = { description: cleanDescription, category: categoryInSpanish, barcode: cleanBarcode };

    // ── PASO 1: código de barras leído en la foto (100% certero) ──────────
    const targetBc = normalizeBarcode(cleanBarcode);
    if (targetBc.length >= 6) {
      const byBarcode = existingProducts.find((p) => p.barcode && normalizeBarcode(p.barcode) === targetBc);
      if (byBarcode) return existingResult(byBarcode, "Mismo código de barras", fallback);
    }

    // A product that already has a DIFFERENT barcode than the one printed on the box is another product.
    const pool =
      targetBc.length >= 6 ? existingProducts.filter((p) => !p.barcode) : existingProducts;

    // ── PASO 2: código de modelo impreso que aparece en UN solo producto del catálogo ─
    const brandFromPhoto = cleanBrand ? extractBrand(cleanBrand) ?? normalizeText(cleanBrand) : null;
    const modelKey = cleanModel ? normalizeText(cleanModel).replace(/ /g, "") : "";
    let modelHits: ProductSummary[] = [];
    if (modelKey.length >= 4 && /[0-9]/.test(modelKey)) {
      modelHits = pool.filter((p) => {
        const hay = normalizeText(`${p.name} ${p.description ?? ""}`).replace(/ /g, "");
        if (!hay.includes(modelKey)) return false;
        const pb = extractProductBrand(p.name, p.description);
        return !brandFromPhoto || !pb || pb === brandFromPhoto;
      });
    }

    // ── PASO 3: coincidencia determinística por nombre ────────────────────
    const deterministic = findBestDuplicateMatch(
      { name: cleanName, description: cleanDescription },
      pool
    );
    if (
      deterministic.isDuplicate &&
      deterministic.existingProduct &&
      (deterministic.reason === "exact_name" || deterministic.reason === "normalized_name")
    ) {
      return existingResult(deterministic.existingProduct, "Mismo nombre en el catálogo", fallback);
    }

    // ── PASO 4: lista corta de parecidos + verificación VISUAL con IA ────
    const ranked: RankedCandidate[] = rankSimilarProducts(
      {
        name: cleanName,
        description: cleanDescription,
        brand: cleanBrand,
        model: cleanModel,
        extraText: visibleText.join(" "),
      },
      pool,
      10
    );
    const shortlistMap = new Map<string, ProductSummary>();
    for (const p of modelHits.slice(0, 4)) shortlistMap.set(p.id, p);
    if (deterministic.existingProduct) shortlistMap.set(deterministic.existingProduct.id, deterministic.existingProduct);
    for (const r of ranked) {
      if (shortlistMap.size >= 10) break;
      shortlistMap.set(r.product.id, r.product);
    }
    const shortlist = Array.from(shortlistMap.values());

    let possibleMatches: ProductSummary[] = [];
    if (shortlist.length > 0) {
      const verdict = await verifyAgainstCatalog(
        base64,
        mimeType,
        { name: cleanName, brand: cleanBrand, model: cleanModel, visibleText },
        shortlist
      );
      const chosen = verdict && verdict.index >= 0 ? shortlist[verdict.index] : undefined;

      if (chosen && verdict?.confidence === "exacto") {
        return existingResult(chosen, verdict.reason || "Verificado visualmente por IA", fallback);
      }

      if (!verdict) {
        // Verificación no disponible: solo se acepta una señal fuerte e inequívoca.
        if (modelHits.length === 1) {
          return existingResult(modelHits[0], `Mismo modelo (${cleanModel})`, fallback);
        }
        if (deterministic.isDuplicate && deterministic.existingProduct) {
          return existingResult(deterministic.existingProduct, deterministic.message ?? "Coincidencia en catálogo", fallback);
        }
      }

      // Dudoso → el administrador decide. El sugerido por la IA va primero.
      const ordered = [
        ...(chosen ? [chosen] : []),
        ...modelHits,
        ...(deterministic.existingProduct ? [deterministic.existingProduct] : []),
        ...ranked.filter((r) => r.score >= 0.45).map((r) => r.product),
      ];
      const seen = new Set<string>();
      possibleMatches = ordered.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, 4);
    }

    // ── PASO 5: producto nuevo → buscar y descargar 4 fotos ──────────────
    const queries = [
      ...(object.searchQueries ?? []),
      `${cleanName} product`,
      cleanName,
    ].filter(Boolean);

    const candidateUrls = await searchProductImages({
      queries,
      negativeKeywords: object.negativeKeywords,
      productName: cleanName,
      category: categoryInSpanish,
      max: 10,
    }).catch((err) => {
      console.error("[scan-actions] searchProductImages threw unexpectedly:", err);
      return [];
    });

    // Pre-download top 4 valid images through sharp right away (with uploaded photo as fallback)
    const downloaded = await downloadTopProductImages(candidateUrls, 4, dataUrl);

    return {
      name: cleanName,
      description: cleanDescription,
      category: categoryInSpanish,
      barcode: cleanBarcode,
      // Precio inicial SIEMPRE en 0: el admin pone el precio real (nada estimado por IA)
      price: 0,
      costPrice: 0,
      stock: object.detectedStock ?? 1,
      image: downloaded.cover,
      images: downloaded.gallery,
      appliedLocalImages: downloaded.allPaths,
      imageOptions: candidateUrls.length > 0 ? candidateUrls : undefined,
      possibleMatches: possibleMatches.length > 0 ? possibleMatches : undefined,
    };
  } catch (err) {
    console.error("[scan-actions] recognizeProductImage failed:", err);
    return { error: "No se pudo procesar la imagen. Intenta con otra foto más clara." };
  }
}

/** Manual image search action called from ScannerPanel when the user wants
 *  to find different photos by typing their own search term. */
export async function searchImagesManually(query: string): Promise<string[]> {
  const clean = query.trim();
  if (!clean) return [];

  let ip = "127.0.0.1";
  try {
    ip = getClientIP(await headers());
  } catch {}
  const rateCheck = checkRateLimit(rateLimitKey("manual-image-search", ip), 30, 5 * 60 * 1000);
  if (!rateCheck.allowed) return [];

  return searchProductImages({
    queries: [`${clean} product`, clean],
    productName: clean,
    max: 8,
  }).catch(() => []);
}
