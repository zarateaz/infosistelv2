"use server";

import { z } from "zod";
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import { logAudit } from "@/lib/audit";
import { loadProductThumb } from "@/lib/productThumbs";
import { mergeProductsCore } from "@/lib/productMerge";
import { moveRefPhotos, loadRefThumbs } from "@/lib/productRefPhotos";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimit";

export interface MergeResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/**
 * Une productos repetidos en uno solo (`keepId`):
 * - suma el stock de todos,
 * - mueve ventas, pedidos, cotizaciones e historial de stock al que se conserva,
 * - completa código de barras / fotos / costo / descripción que le falten,
 * - elimina los repetidos.
 * Todo dentro de una transacción: o se hace completo o no se hace nada.
 */
export async function mergeProducts(keepId: string, removeIds: string[]): Promise<MergeResult> {
  const session = await requireSession();

  const ids = Array.from(new Set(removeIds.filter((id) => typeof id === "string" && id && id !== keepId)));
  if (!keepId || ids.length === 0) return { ok: false, error: "Selecciona qué producto conservar." };
  if (ids.length > 20) return { ok: false, error: "Demasiados productos a la vez." };

  try {
    const summary = await mergeProductsCore(prisma, keepId, ids);
    await moveRefPhotos(ids, keepId);

    await logAudit({
      action: "PRODUCT_MERGE",
      adminId: session.sub,
      details: `Conservado #${summary.keepItem} ${summary.keepName}; unidos: ${summary.removed.join(" | ")}; stock ${summary.totalStock}`,
    });

    revalidatePath("/taller-control/productos");
    revalidatePath("/taller-control/productos/duplicados");
    revalidatePath("/taller-control/inventario");
    revalidatePath("/taller-control/seguimiento-stock");
    revalidatePath("/tienda");

    return {
      ok: true,
      message: `Listo: ${summary.removed.length} repetido(s) unido(s) en "${summary.keepName}". Stock total: ${summary.totalStock} u.`,
    };
  } catch (err) {
    console.error("[duplicados] mergeProducts failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo unir los productos." };
  }
}

export interface AiGroupVerdict {
  verdict?: "mismo" | "distintos" | "dudoso";
  reason?: string;
  error?: string;
}

/** Asks the vision model whether the products of a group (names + their photos) are the same item. */
export async function askAiAboutGroup(productIds: string[]): Promise<AiGroupVerdict> {
  const session = await requireSession();
  if (!process.env.DEEPSEEK_API_KEY) return { error: "Falta DEEPSEEK_API_KEY en el servidor." };
  const rate = checkRateLimit(rateLimitKey("dup-ai", session.sub), 40, 10 * 60 * 1000);
  if (!rate.allowed) return { error: "Demasiadas consultas seguidas. Espera unos minutos." };

  const ids = Array.from(new Set(productIds)).slice(0, 6);
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, itemNumber: true, name: true, description: true, barcode: true, category: true, image: true },
  });
  if (products.length < 2) return { error: "El grupo ya no tiene productos para comparar." };

  type Part = { type: "text"; text: string } | { type: "file"; data: string; mediaType: string };
  const content: Part[] = [
    {
      type: "text",
      text: `Eres el auditor de inventario de INFOSISTEL (tienda de tecnología). ¿Estos productos del catálogo son EL MISMO artículo registrado varias veces, o son productos distintos?
Reglas: mismo artículo = misma marca + mismo modelo + misma variante (capacidad, color, medida, potencia, voltaje). Si cualquiera difiere → 'distintos'. Si no hay datos suficientes para asegurarlo → 'dudoso'. Los nombres pueden estar redactados distinto.
Una misma marca usa el MISMO diseño de empaque para muchos productos: decide por el texto impreso (potencia W, amperaje, conector, puertos, medida, modelo), no por el parecido del empaque.

${products
  .map(
    (p, i) =>
      `Producto ${i + 1} (#${p.itemNumber}): ${p.name}${p.barcode ? ` | código: ${p.barcode}` : ""}${p.category ? ` | ${p.category}` : ""}${p.description ? ` | ${p.description.slice(0, 160)}` : ""}`
  )
  .join("\n")}`,
    },
  ];
  for (let i = 0; i < products.length; i++) {
    const real = await loadRefThumbs(products[i].id, 2);
    if (real.length > 0) {
      content.push({ type: "text", text: `Fotos REALES (tomadas en la tienda) del producto ${i + 1}:` });
      for (const img of real) content.push({ type: "file", data: img, mediaType: "image/jpeg" });
      continue;
    }
    const t = await loadProductThumb(products[i].image);
    if (!t) continue;
    content.push({ type: "text", text: `Foto de CATÁLOGO (internet) del producto ${i + 1}:` });
    content.push({ type: "file", data: t, mediaType: "image/jpeg" });
  }

  const schema = z.object({
    verdict: z.enum(["mismo", "distintos", "dudoso"]),
    reason: z.string().describe("Explicación breve en español (1 frase)."),
  });
  const attempts: Part[][] = content.length > 1 ? [content, content.slice(0, 1)] : [content];
  for (const attempt of attempts) {
    try {
      const { object } = await generateObject({
        model: deepseek("deepseek-v4-flash-vision-exp"),
        schema,
        messages: [{ role: "user", content: attempt }],
      });
      return { verdict: object.verdict, reason: object.reason };
    } catch (err) {
      console.error("[duplicados] askAiAboutGroup attempt failed:", err);
    }
  }
  return { error: "La IA no respondió. Intenta de nuevo." };
}
