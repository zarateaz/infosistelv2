"use server";

import { z } from "zod";
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { loadProductThumb } from "@/lib/productThumbs";
import { loadRefThumbs, readPendingRefPhoto, savePendingRefPhoto } from "@/lib/productRefPhotos";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";
import { searchProductImages } from "@/lib/imageSearch";
import {
  findBestDuplicateMatch,
  rankSimilarProducts,
  normalizeText,
  extractBrand,
  extractProductBrand,
  haveConflictingTechnicalSpecs,
  type ProductSummary,
  type RankedCandidate,
} from "@/lib/duplicateDetection";
import { translateCategoryToSpanish } from "@/lib/categoryUtils";
import { deleteProductImageIfManaged, downloadTopProductImages, uploadProductImage } from "./upload-actions";
import sharp from "sharp";

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
  /** Tokens of the admin's photos, saved as pending reference photos until confirmed */
  refTokens?: string[];
  /** New product: queries for the follow-up findProductPhotos() call */
  photoSearch?: { queries: string[]; negativeKeywords?: string[] };
  error?: string;
}

const VISION_MODEL = "deepseek-v4-flash-vision-exp";
const MAX_PHOTOS = 3;

interface Photo {
  base64: string;
  mime: string;
}

interface VisualVerdict {
  /** index into the shortlist, or -1 */
  index: number;
  confidence: "exacto" | "probable" | "ninguno";
  reason: string;
}

type Part = { type: "text"; text: string } | { type: "file"; data: string; mediaType: string };

/**
 * Second AI pass: the model looks at the admin's photo(s) AND the shortlisted catalog
 * products. For each candidate it receives the admin's OWN earlier photos of that product
 * (same conditions: in hand, store light, price sticker) when they exist, otherwise the
 * catalog cover. Returns which candidate it is.
 */
async function verifyAgainstCatalog(
  photos: Photo[],
  recognized: { name: string; brand?: string; model?: string; keySpecs: string[]; visibleText: string[] },
  shortlist: ProductSummary[]
): Promise<VisualVerdict | null> {
  if (shortlist.length === 0) return null;

  const visual = await Promise.all(
    shortlist.slice(0, 6).map(async (p) => {
      const refs = await loadRefThumbs(p.id, 2);
      if (refs.length > 0) return { kind: "real" as const, images: refs };
      const cover = await loadProductThumb(p.image);
      return cover ? { kind: "catalogo" as const, images: [cover] } : { kind: "none" as const, images: [] as string[] };
    })
  );

  const listText = shortlist
    .map((p, i) => {
      const parts = [`#${i + 1}: ${p.name}`];
      if (p.barcode) parts.push(`código: ${p.barcode}`);
      if (p.category) parts.push(`categoría: ${p.category}`);
      if (p.description) parts.push(`desc: ${p.description.slice(0, 140)}`);
      const v = visual[i];
      if (v?.kind === "real") parts.push("(tiene fotos REALES tomadas en la tienda)");
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
        "'exacto' = misma marca, mismo modelo y misma variante sin ninguna duda. 'probable' = parece el mismo pero no se puede confirmar la variante. 'ninguno' = no está en la lista."
      ),
    reason: z.string().describe("Explicación breve en español (máx. 1 frase) citando el texto impreso que decidió."),
  });

  const intro = `Eres el verificador de inventario de INFOSISTEL (tienda de accesorios de cómputo y celulares en Huancayo).
Las primeras ${photos.length} imagen(es) son las fotos que el administrador acaba de tomar con el celular: el producto en la mano, dentro de su empaque/blíster, a veces movidas, con reflejos y con una etiqueta de precio pegada.
Lectura previa: nombre="${recognized.name}"${recognized.brand ? `, marca="${recognized.brand}"` : ""}${recognized.model ? `, modelo="${recognized.model}"` : ""}${recognized.keySpecs.length ? `, especificaciones impresas="${recognized.keySpecs.join(", ")}"` : ""}${recognized.visibleText.length ? `, texto visible="${recognized.visibleText.slice(0, 15).join(" / ")}"` : ""}.

Estos productos YA EXISTEN en la tienda:
${listText}

¿La foto es UNO de esos productos? Reglas estrictas:
1. Una misma marca usa el MISMO diseño de empaque para muchos productos (ej. REDD, BOSSNEY, UGREEN, TEROS, CABLETIME). El parecido del empaque NO prueba nada.
2. Decide por el TEXTO IMPRESO GRANDE: potencia (65W, 70W, 100W, 120W), amperaje (6.2A), tipo de conector (Type-C, Lightning, Micro USB, HDMI, VGA), puertos (1x4, 1x8), medida (1M, 2M, 12mm, 18mm), capacidad, modelo. Si cualquiera difiere → NO es el mismo.
3. Las fotos marcadas "REAL" son fotos anteriores del MISMO producto tomadas en la tienda: si coinciden empaque + texto impreso + forma, es fuerte evidencia. Las marcadas "CATÁLOGO" son de internet y pueden verse distintas (fondo blanco, sin empaque).
4. Si un texto clave no se puede leer en la foto nueva o hay dos candidatos posibles → 'probable', NUNCA 'exacto'.`;

  const userPhotos: Part[] = photos.map((ph) => ({ type: "file", data: ph.base64, mediaType: ph.mime }));
  const textOnly: Part[] = [{ type: "text", text: intro }, ...userPhotos];
  const withRefs: Part[] = [...textOnly];
  visual.forEach((v, i) => {
    if (v.kind === "none") return;
    withRefs.push({
      type: "text",
      text: v.kind === "real" ? `Fotos REALES (tomadas en la tienda) del producto #${i + 1}:` : `Foto de CATÁLOGO (internet) del producto #${i + 1}:`,
    });
    for (const img of v.images) withRefs.push({ type: "file", data: img, mediaType: "image/jpeg" });
  });

  const attempts = withRefs.length > textOnly.length ? [withRefs, textOnly] : [textOnly];
  // Un solo presupuesto de tiempo para ambos intentos (nunca exceder el límite del proxy)
  const verifySignal = AbortSignal.timeout(20_000);
  for (const content of attempts) {
    if (verifySignal.aborted) break;
    try {
      const { object } = await generateObject({
        model: deepseek(VISION_MODEL),
        schema,
        messages: [{ role: "user", content }],
        abortSignal: verifySignal,
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
  fallback: { description: string; category: string; barcode?: string },
  refTokens: string[]
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
    refTokens,
  };
}

function parsePhotos(input: string | string[]): Photo[] | null {
  const list = (Array.isArray(input) ? input : [input]).slice(0, MAX_PHOTOS);
  const out: Photo[] = [];
  for (const dataUrl of list) {
    if (typeof dataUrl !== "string" || dataUrl.length > 12 * 1024 * 1024) return null;
    const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
    if (!m) return null;
    out.push({ mime: m[1], base64: m[2] });
  }
  return out.length > 0 ? out : null;
}

/**
 * Reconoce un producto a partir de 1 a 3 fotos tomadas por el admin.
 * @param photosInput  data URLs (frente, reverso con código/modelo, lateral...)
 * @param decodedBarcode código de barras leído EXACTO en el navegador (ZXing) — prueba definitiva
 */
export async function recognizeProductImage(
  photosInput: string | string[],
  decodedBarcode?: string
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

  const photos = parsePhotos(photosInput);
  if (!photos) {
    return { error: "Formato de imagen no válido." };
  }

  try {
    // The admin's own photos become pending reference photos (attached only when confirmed)
    const refTokens = (
      await Promise.all(photos.map((ph) => savePendingRefPhoto(Buffer.from(ph.base64, "base64"))))
    ).filter((t): t is string => !!t);

    const [categoriesRows, existingProducts] = await Promise.all([
      prisma.category.findMany({ select: { name: true } }),
      prisma.product.findMany({ select: PRODUCT_SELECT, orderBy: { itemNumber: "asc" } }),
    ]);

    // ── PASO 0: código de barras leído por ZXing en el navegador (exacto, sin IA) ─
    const exactBc = normalizeBarcode(decodedBarcode);
    if (exactBc.length >= 6) {
      const byBarcode = existingProducts.find((p) => p.barcode && normalizeBarcode(p.barcode) === exactBc);
      if (byBarcode) {
        return existingResult(
          byBarcode,
          `Código de barras ${decodedBarcode} leído en la foto`,
          { description: "", category: "", barcode: decodedBarcode },
          refTokens
        );
      }
    }

    const categories = categoriesRows.map((c) => c.name);

    const { object } = await generateObject({
      model: deepseek(VISION_MODEL),
      abortSignal: AbortSignal.timeout(28_000),
      schema: z.object({
        brand: z
          .string()
          .optional()
          .describe("Marca EXACTA impresa en el producto o la caja (ej. 'REDD', 'BOSSNEY', 'UGREEN', 'TEROS', 'CABLETIME'). Vacío si no se ve."),
        model: z
          .string()
          .optional()
          .describe("Código de modelo / SKU / número de parte EXACTO impreso (ej. 'TE-4064', 'CM0123'). Copia los caracteres tal cual. Vacío si no se ve; NO lo inventes."),
        keySpecs: z
          .array(z.string())
          .optional()
          .describe("Especificaciones clave IMPRESAS que diferencian este producto de sus variantes, copiadas tal cual: potencia (100W), amperaje (6.2A), conector (TYPE-C, LIGHTNING, MICRO USB), puertos (1X8), medida (1M, 18MM), capacidad (64GB), resolución (4K60HZ), color."),
        visibleText: z
          .array(z.string())
          .optional()
          .describe("Otros textos impresos legibles en el producto/empaque/etiqueta, copiados literalmente (máx. 20)."),
        name: z
          .string()
          .describe(
            "Nombre comercial exacto en español y en MAYÚSCULAS para catálogo (máx. 140 caracteres). Estructura obligatoria: TIPO DE PRODUCTO + MARCA + MODELO EXACTO + ESPECIFICACIONES CLAVE (potencia W, amperaje, conector, medida/longitud, versión HDMI/USB, puertos, capacidad, color)."
          ),
        description: z
          .string()
          .describe(
            "Descripción comercial y técnica profesional en español y en MAYÚSCULAS (2 a 3 frases listas para publicar en la tienda). Incluye marca, modelo, características técnicas completas, puertos/conectores, medidas y compatibilidad. PROHIBIDO escribir frases como 'la imagen muestra', 'en la foto se observa' o 'no se aprecian etiquetas'. No menciones la etiqueta de precio."
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
            "Si se leen con claridad los números impresos BAJO un código de barras (EAN-13, UPC), extrae solo esos dígitos exactos. Si no se leen todos con claridad, déjalo vacío."
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
${photos.length > 1 ? `Recibes ${photos.length} fotos del MISMO producto (frente, reverso, detalle): combina lo que se lee en todas.` : "Recibes una foto del producto."}
Las fotos las toma el administrador con el celular: producto en la mano, dentro de blíster/empaque, a veces movidas o con reflejos, con una etiqueta de precio pegada (IGNORA la etiqueta de precio).

0. LECTURA LITERAL (lo más importante, se usa para no duplicar productos):
- 'brand', 'model', 'keySpecs', 'visibleText' y 'barcode': copia EXACTAMENTE lo que está impreso. Si no se lee, déjalo vacío. NUNCA inventes un modelo, especificación ni código.
- En productos de la misma marca con empaque parecido (cargadores REDD 70W/100W, BOSSNEY 65W/120W, cables 6.2A, adaptadores UGREEN) lo que los diferencia es el texto grande impreso: léelo con mucho cuidado y ponlo en 'keySpecs' Y en 'name'.

1. DATOS DEL CATÁLOGO:
- 'name': Nombre comercial claro en español y en MAYÚSCULAS (Tipo de producto + Marca + Modelo exacto + especificaciones clave). Ejemplos: "CARGADOR REDD 100W PD TYPE-C", "CABLE REDD 6.2A USB A TYPE-C", "SPLITTER HDMI CABLETIME 1X8 4K", "ADAPTADOR DE CORRIENTE AMERICAN NET 5V 2.5A".
  REGLA DE MARCA CRÍTICA: Si la marca es 'American NET', escribe siempre 'AMERICAN NET' completo.
- 'category': Categoría exacta en español ${categories.length > 0 ? `(elige entre: ${categories.join(", ")})` : "('LAPTOPS', 'ACCESORIOS', 'ALMACENAMIENTO', 'CABLES Y ADAPTADORES', 'REDES Y CONECTIVIDAD', 'TECLADOS Y MOUSE', 'AUDIO Y SONIDO', 'IMPRESORAS', 'TINTAS Y TÓNERS', 'MONITORES Y PANTALLAS', 'COMPONENTES DE PC', 'CARGADORES Y ENERGÍA', 'SEGURIDAD Y CÁMARAS', 'COMPUTADORAS Y PC')"}.
- 'description': Redacción comercial y técnica impecable en español. NUNCA menciones "la foto muestra" ni "no se ve en la imagen".
- 'searchQueries': 3 búsquedas precisas combinando tipo de producto y marca completa. PROHIBIDO términos genéricos sin producto tecnológico.
- 'negativeKeywords': términos que deben filtrarse (ej: 'avion', 'airline', 'ropa', 'deporte').`,
            },
            ...photos.map((ph) => ({ type: "file" as const, data: ph.base64, mediaType: ph.mime })),
          ],
        },
      ],
    });

    const cleanName = object.name.trim().toUpperCase();
    const cleanDescription = object.description.trim().toUpperCase();
    const aiBarcode = object.barcode?.replace(/[^0-9]/g, "") || "";
    // ZXing reading is exact; the AI reading is only trusted when it has a full EAN/UPC length
    const cleanBarcode =
      exactBc.length >= 6 ? decodedBarcode!.trim() : [8, 12, 13, 14].includes(aiBarcode.length) ? aiBarcode : undefined;
    const cleanBrand = object.brand?.trim() || undefined;
    const cleanModel = object.model?.trim() || undefined;
    const keySpecs = (object.keySpecs ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12);
    const visibleText = (object.visibleText ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const categoryInSpanish = translateCategoryToSpanish(object.category, cleanName);
    const fallback = { description: cleanDescription, category: categoryInSpanish, barcode: cleanBarcode };

    // ── PASO 1: código de barras leído por la IA ──────────────────────────
    const targetBc = normalizeBarcode(cleanBarcode);
    if (targetBc.length >= 6) {
      const byBarcode = existingProducts.find((p) => p.barcode && normalizeBarcode(p.barcode) === targetBc);
      if (byBarcode) return existingResult(byBarcode, "Mismo código de barras", fallback, refTokens);
    }

    // ── FILTRO DURO: lo que contradice la foto queda descartado (la IA no puede elegirlo) ─
    //  - un producto con OTRO código de barras es otro producto
    //  - otra marca impresa
    //  - otra especificación impresa (100W vs 70W, 1x8 vs 1x4, 18mm vs 12mm, 64GB vs 128GB...)
    const photoSpecText = [cleanName, ...keySpecs].join(" ");
    const brandFromPhoto = cleanBrand ? extractBrand(cleanBrand) ?? normalizeText(cleanBrand) : extractBrand(cleanName);
    const pool = existingProducts.filter((p) => {
      if (targetBc.length >= 6 && p.barcode) return false;
      const pb = extractProductBrand(p.name);
      if (brandFromPhoto && pb && pb !== brandFromPhoto) return false;
      if (haveConflictingTechnicalSpecs(photoSpecText, p.name)) return false;
      return true;
    });

    // ── PASO 2: código de modelo impreso que aparece en el catálogo ───────
    const modelKey = cleanModel ? normalizeText(cleanModel).replace(/ /g, "") : "";
    let modelHits: ProductSummary[] = [];
    if (modelKey.length >= 4 && /[0-9]/.test(modelKey) && /[a-z]/.test(modelKey)) {
      modelHits = pool.filter((p) =>
        normalizeText(`${p.name} ${p.description ?? ""}`).replace(/ /g, "").includes(modelKey)
      );
    }

    // ── PASO 3: coincidencia determinística por nombre ────────────────────
    const deterministic = findBestDuplicateMatch({ name: cleanName, description: cleanDescription }, pool);
    if (
      deterministic.isDuplicate &&
      deterministic.existingProduct &&
      (deterministic.reason === "exact_name" || deterministic.reason === "normalized_name")
    ) {
      return existingResult(deterministic.existingProduct, "Mismo nombre en el catálogo", fallback, refTokens);
    }

    // ── PASO 4: lista corta + verificación VISUAL contra tus fotos reales ─
    const ranked: RankedCandidate[] = rankSimilarProducts(
      {
        name: cleanName,
        description: cleanDescription,
        brand: cleanBrand,
        model: cleanModel,
        extraText: [...keySpecs, ...visibleText].join(" "),
      },
      pool,
      10
    );
    const shortlistMap = new Map<string, ProductSummary>();
    for (const p of modelHits.slice(0, 4)) shortlistMap.set(p.id, p);
    if (deterministic.existingProduct) shortlistMap.set(deterministic.existingProduct.id, deterministic.existingProduct);
    for (const r of ranked) {
      if (shortlistMap.size >= 8) break;
      shortlistMap.set(r.product.id, r.product);
    }
    const shortlist = Array.from(shortlistMap.values());

    let possibleMatches: ProductSummary[] = [];
    if (shortlist.length > 0) {
      const verdict = await verifyAgainstCatalog(
        photos,
        { name: cleanName, brand: cleanBrand, model: cleanModel, keySpecs, visibleText },
        shortlist
      );
      const chosen = verdict && verdict.index >= 0 ? shortlist[verdict.index] : undefined;

      if (chosen && verdict?.confidence === "exacto") {
        return existingResult(chosen, verdict.reason || "Verificado visualmente por IA", fallback, refTokens);
      }

      if (!verdict) {
        // Verificación no disponible: solo se acepta una señal fuerte e inequívoca.
        if (modelHits.length === 1) {
          return existingResult(modelHits[0], `Mismo modelo (${cleanModel})`, fallback, refTokens);
        }
        if (deterministic.isDuplicate && deterministic.existingProduct) {
          return existingResult(
            deterministic.existingProduct,
            deterministic.message ?? "Coincidencia en catálogo",
            fallback,
            refTokens
          );
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

    // ── PASO 5: producto nuevo → las 4 fotos se buscan en una llamada aparte
    //    (findProductPhotos) para que esta respuesta sea rápida y nunca exceda
    //    el tiempo límite del proxy.
    const queries = Array.from(
      new Set([...(object.searchQueries ?? []), `${cleanName} product`, cleanName].filter(Boolean))
    ).slice(0, 6);

    return {
      name: cleanName,
      description: cleanDescription,
      category: categoryInSpanish,
      barcode: cleanBarcode,
      // Precio inicial SIEMPRE en 0: el admin pone el precio real (nada estimado por IA)
      price: 0,
      costPrice: 0,
      stock: object.detectedStock ?? 1,
      possibleMatches: possibleMatches.length > 0 ? possibleMatches : undefined,
      refTokens,
      photoSearch: { queries, negativeKeywords: object.negativeKeywords },
    };
  } catch (err) {
    console.error("[scan-actions] recognizeProductImage failed:", err);
    return { error: "No se pudo procesar la imagen. Intenta con otra foto más clara." };
  }
}

export interface ProductPhotosResult {
  /** Local paths [cover, ...gallery] already downloaded and re-encoded */
  appliedLocalImages: string[];
  /** All candidate URLs found (to let the admin pick others) */
  imageOptions: string[];
}

/**
 * Busca y descarga las 4 mejores fotos de catálogo para un producto NUEVO.
 * Si internet no da 4 fotos válidas, completa con la foto que tomó el admin
 * (por su token de foto pendiente), para que el producto nunca quede sin foto.
 */
export async function findProductPhotos(input: {
  name: string;
  category?: string;
  queries?: string[];
  negativeKeywords?: string[];
  fallbackRefToken?: string;
}): Promise<ProductPhotosResult> {
  const name = String(input.name ?? "").trim().slice(0, 160);
  if (!name) return { appliedLocalImages: [], imageOptions: [] };

  let ip = "127.0.0.1";
  try {
    ip = getClientIP(await headers());
  } catch {}
  const rateCheck = checkRateLimit(rateLimitKey("product-photos", ip), 40, 5 * 60 * 1000);
  if (!rateCheck.allowed) return { appliedLocalImages: [], imageOptions: [] };

  const queries = (Array.isArray(input.queries) ? input.queries : [])
    .filter((q): q is string => typeof q === "string")
    .map((q) => q.slice(0, 160))
    .slice(0, 6);
  const candidateUrls = await searchProductImages({
    queries: queries.length > 0 ? queries : [name, `${name} product`],
    negativeKeywords: Array.isArray(input.negativeKeywords)
      ? input.negativeKeywords.filter((k): k is string => typeof k === "string").slice(0, 20)
      : undefined,
    productName: name,
    category: typeof input.category === "string" ? input.category : undefined,
    max: 12,
  }).catch((err) => {
    console.error("[scan-actions] findProductPhotos search failed:", err);
    return [] as string[];
  });

  const adminPhoto = input.fallbackRefToken ? await readPendingRefPhoto(input.fallbackRefToken) : null;
  const fallbackDataUrl = adminPhoto ? `data:image/webp;base64,${adminPhoto.toString("base64")}` : undefined;

  // Descarga hasta 8 candidatas y deja que la IA elija SOLO las del mismo producto y variante
  const pool = await downloadTopProductImages(candidateUrls, 6);
  const approved = await pickMatchingPhotos(name, pool.allPaths, adminPhoto);

  let finalPaths: string[];
  if (approved) {
    finalPaths = approved.slice(0, 4);
  } else {
    // IA no disponible → orden del buscador de texto
    finalPaths = pool.allPaths.slice(0, 4);
  }
  // Borrar del disco las descargadas que no se usan
  await Promise.all(pool.allPaths.filter((p) => !finalPaths.includes(p)).map((p) => deleteProductImageIfManaged(p)));

  if (finalPaths.length < 4 && fallbackDataUrl) {
    const own = await uploadProductImage(fallbackDataUrl);
    if (own.path) finalPaths.push(own.path);
  }

  const used = new Set(pool.validSourceUrls);
  return {
    appliedLocalImages: finalPaths,
    imageOptions: candidateUrls.filter((u) => !used.has(u)),
  };
}

/**
 * La IA compara las fotos descargadas de internet con la foto del admin (o con el
 * nombre si no hay foto) y devuelve, en orden (mejor portada primero), solo las que
 * muestran EXACTAMENTE el mismo producto y variante (color, aroma, capacidad, W...).
 * null = la IA no respondió.
 */
async function pickMatchingPhotos(
  name: string,
  paths: string[],
  adminPhoto: Buffer | null
): Promise<string[] | null> {
  if (paths.length === 0) return [];
  if (!process.env.DEEPSEEK_API_KEY) return null;
  const thumbs = await Promise.all(paths.map((p) => loadProductThumb(p, 256)));
  const usable = paths.map((p, i) => ({ path: p, thumb: thumbs[i] })).filter((x): x is { path: string; thumb: string } => !!x.thumb);
  if (usable.length === 0) return [];

  let adminJpg: string | null = null;
  if (adminPhoto) {
    try {
      adminJpg = (await sharp(adminPhoto).resize(512, 512, { fit: "inside" }).jpeg({ quality: 72 }).toBuffer()).toString("base64");
    } catch {}
  }

  const content: Part[] = [
    {
      type: "text",
      text: `Producto: "${name}".
${adminJpg ? "La PRIMERA imagen es la foto real del producto tomada en la tienda." : ""}
Después vienen ${usable.length} fotos candidatas descargadas de internet, numeradas.
Elige SOLO las candidatas que muestran EXACTAMENTE este mismo producto y la misma variante: misma marca, mismo modelo, mismo color/aroma/sabor, misma capacidad/potencia/medida. Descarta otras variantes de la misma marca (otro color, otro aroma, otra potencia), otros productos, logos, banners, collages, capturas de tiendas con texto encima o fotos borrosas.
Ordénalas de mejor a peor: primero la mejor para portada (producto completo, de frente, fondo limpio).`,
    },
  ];
  if (adminJpg) content.push({ type: "file", data: adminJpg, mediaType: "image/jpeg" });
  usable.forEach((u, i) => {
    content.push({ type: "text", text: `Candidata ${i + 1}:` });
    content.push({ type: "file", data: u.thumb, mediaType: "image/jpeg" });
  });

  try {
    const { object } = await generateObject({
      model: deepseek(VISION_MODEL),
      schema: z.object({
        approved: z
          .array(z.number().int())
          .describe("Números de las candidatas correctas, de mejor a peor. Vacío si ninguna es correcta."),
      }),
      messages: [{ role: "user", content }],
      abortSignal: AbortSignal.timeout(22_000),
    });
    const seen = new Set<number>();
    return object.approved
      .filter((n) => n >= 1 && n <= usable.length && !seen.has(n) && (seen.add(n), true))
      .map((n) => usable[n - 1].path);
  } catch (err) {
    console.error("[scan-actions] pickMatchingPhotos failed:", err);
    return null;
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
