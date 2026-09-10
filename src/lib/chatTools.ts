import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Feeds the system prompt's category list at request time instead of
// hardcoding it in route.ts — categories are admin-editable
// (/taller-control/categorias), so a hardcoded list silently goes stale
// the moment someone adds or renames one (caught "WIRELESS ROUTERS" and
// "SIN CATEGORÍA" missing from the old static list). "SIN CATEGORÍA" is
// filtered out — it's the internal catch-all for unsorted products, not
// something to describe to a customer as a browsable category.
export async function getCategoryNames(): Promise<string[]> {
  const categories = await prisma.category.findMany({
    where: { name: { not: "SIN CATEGORÍA" } },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return categories.map((c) => toSentenceCase(c.name));
}

function toSentenceCase(s: string): string {
  const lower = s.toLocaleLowerCase("es-PE");
  return lower.charAt(0).toLocaleUpperCase("es-PE") + lower.slice(1);
}

// Lets the chatbot answer price/stock questions against the real catalog
// instead of guessing or blanket-deferring to WhatsApp. Read-only, public
// data only — same field allowlist as the /tienda queries (no costPrice).
export const buscarProductos = tool({
  description:
    "Busca productos en el catálogo real de la tienda por nombre, categoría o descripción. " +
    "Úsala siempre que el cliente pregunte por un producto, precio o stock concreto — nunca inventes esos datos.",
  inputSchema: z.object({
    consulta: z
      .string()
      .min(1)
      .max(100)
      .describe('Término de búsqueda, p. ej. "ssd 480", "mouse logitech", "ram".'),
  }),
  execute: async ({ consulta }) => {
    // Match each word independently (AND across words, OR across fields) —
    // "mouse logitech" must find "Mouse Gamer Logitech G203" even though
    // that exact phrase never appears contiguously in any single field.
    const words = consulta.split(/\s+/).filter(Boolean).slice(0, 6);
    const products = await prisma.product.findMany({
      where: {
        AND: words.map((word) => ({
          OR: [
            { name: { contains: word } },
            { description: { contains: word } },
            { category: { contains: word } },
          ],
        })),
      },
      // costPrice is admin-only — never select it into a response the model can relay.
      select: {
        name: true,
        category: true,
        description: true,
        price: true,
        stock: true,
        onSale: true,
        salePrice: true,
        image: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    if (products.length === 0) {
      return { encontrados: 0, productos: [] };
    }

    return {
      encontrados: products.length,
      productos: products.map((p) => ({
        nombre: p.name,
        categoria: p.category,
        // Short spec hint for the model to use when comparing products —
        // the chat UI never shows this raw, only the model reads it.
        especificaciones: p.description.slice(0, 200),
        precio: `S/. ${(p.onSale && p.salePrice ? p.salePrice : p.price).toFixed(2)}`,
        precioRegular: p.onSale && p.salePrice ? `S/. ${p.price.toFixed(2)}` : null,
        disponible: p.stock > 0,
        stock: p.stock,
        // Real product photo path (same one shown on /tienda) — the chat
        // widget renders this as a photo card next to the message, `null`
        // when the admin hasn't uploaded one yet (shows a category icon
        // placeholder instead, same as the storefront).
        imagen: p.image ?? null,
      })),
    };
  },
});
