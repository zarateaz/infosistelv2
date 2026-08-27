"use server";

import { z } from "zod";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";

export interface BarcodeLookupResult {
  existingProductId?: string;
  existingProductName?: string;
  suggestion?: { name?: string; description?: string; category?: string };
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

    return {
      source: "external",
      suggestion: {
        name: title.slice(0, 150),
        description: (item.description || title).slice(0, 500),
        category: guessCategory(`${title} ${item.category ?? ""}`, categories),
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
  error?: string;
}

export async function recognizeProductImage(
  dataUrl: string
): Promise<RecognizeImageResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "El reconocimiento por IA no está configurado (falta ANTHROPIC_API_KEY)." };
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

  const categories = (await prisma.category.findMany({ select: { name: true } })).map((c) => c.name);
  if (categories.length === 0) {
    return { error: "No hay categorías registradas todavía." };
  }

  try {
    const { object } = await generateObject({
      model: anthropic("claude-opus-5"),
      schema: z.object({
        name: z.string().describe("Nombre comercial corto del producto, en español."),
        description: z.string().describe("Descripción breve (1-2 frases) basada en lo que dice la caja."),
        category: z.enum(categories as [string, ...string[]]).describe(
          "La categoría de esta lista que mejor corresponde al producto."
        ),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Esta es una foto de la caja o etiqueta de un producto de una tienda de tecnología. Lee la marca, modelo y especificaciones impresas para completar los datos. Si no puedes leer algo con certeza, no lo inventes.",
            },
            { type: "image", image: base64, mediaType: mimeType },
          ],
        },
      ],
    });

    return object;
  } catch {
    return { error: "No se pudo procesar la imagen. Intenta con otra foto más clara." };
  }
}
