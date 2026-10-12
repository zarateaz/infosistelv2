"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteProductImageIfManaged } from "./upload-actions";

export interface AdminProduct {
  id: string;
  itemNumber: number;
  name: string;
  category: string;
  description: string;
  price: number;
  costPrice: number | null;
  stock: number;
  image: string | null;
  /** Up to 3 additional reference photos — admin-only, never shown on
   *  /tienda or the storefront card, only when editing the product. */
  images: string | null;
  barcode: string | null;
  isFeatured: boolean;
  onSale: boolean;
  salePrice: number | null;
}

// Grouped by category then name — newest-first buried products alphabetically
// close to nothing else in their own category, so with 247+ products the
// list read as arbitrary. The admin page groups on this same order to turn
// it into a real catalog instead of a flat dump.
export async function getAdminProducts(): Promise<AdminProduct[]> {
  return prisma.product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
}

export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  return prisma.product.findUnique({ where: { id } });
}

export interface ProductFormState {
  error?: string;
}

const MAX_EXTRA_IMAGES = 3;

const productSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(150),
  category: z.string().trim().min(1, "La categoría es obligatoria").max(60),
  description: z.string().trim().min(1, "La descripción es obligatoria").max(1000),
  price: z.coerce.number().positive("El precio debe ser mayor a 0"),
  costPrice: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0),
  image: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : null)),
  images: z.array(z.string().trim().max(300)).max(MAX_EXTRA_IMAGES).optional(),
  barcode: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v ? v : null)),
});

/** Keeps the Category table in sync with whatever the admin types — this is
 *  what makes /tienda's filter chips and the scanner's category dropdown
 *  (once it exists) pick up a brand-new category with zero extra steps. */
async function upsertCategory(name: string): Promise<string> {
  const normalized = name.toUpperCase();
  await prisma.category.upsert({ where: { name: normalized }, update: {}, create: { name: normalized } });
  return normalized;
}

function parseProductForm(formData: FormData) {
  // Same convention as the single `image` hidden input, just JSON-encoded
  // since a plain <input> can't hold an array — ImageGalleryField writes it.
  const imagesRaw = formData.get("images");
  let images: string[] | undefined;
  if (typeof imagesRaw === "string" && imagesRaw) {
    try {
      const decoded = JSON.parse(imagesRaw);
      if (Array.isArray(decoded)) images = decoded.filter((v) => typeof v === "string");
    } catch {
      // Malformed value from a hand-crafted request — ignore rather than
      // fail the whole save over an optional field.
    }
  }

  const parsed = productSchema.safeParse({
    name: formData.get("productName"),
    category: formData.get("category"),
    description: formData.get("description"),
    price: formData.get("price"),
    costPrice: formData.get("costPrice") || 0,
    stock: formData.get("stock"),
    image: formData.get("image"),
    images,
    barcode: formData.get("barcode"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." } as const;
  }

  const isFeatured = formData.get("isFeatured") === "on";
  const onSale = formData.get("onSale") === "on";
  const salePriceRaw = formData.get("salePrice");
  const salePrice = onSale && salePriceRaw ? Number(salePriceRaw) : null;
  if (onSale && (!salePrice || salePrice <= 0 || salePrice >= parsed.data.price)) {
    return { error: "El precio de oferta debe ser mayor a 0 y menor al precio normal." } as const;
  }

  return { data: { ...parsed.data, isFeatured, onSale, salePrice } } as const;
}

/** Prisma's unique-constraint error code — see
 *  https://www.prisma.io/docs/orm/reference/error-reference#p2002 */
function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const result = parseProductForm(formData);
  if ("error" in result) return { error: result.error };

  const error = await insertProduct(result.data);
  if (error) return { error };

  revalidatePath("/taller-control/productos");
  revalidatePath("/tienda");
  redirect("/taller-control/productos");
}

/** Product.images is a single TEXT column (String?) — arrays go in/out as a
 *  JSON-encoded string, never as raw values Prisma would understand. */
function serializeExtraImages(images?: string[]): string | null {
  return images && images.length > 0 ? JSON.stringify(images) : null;
}

/** Normaliza texto para comparaciones de duplicados con 0 margen de error:
 * - quita acentos y tildes (á->a, Ó->O, etc.)
 * - convierte a minúsculas
 * - reemplaza signos de puntuación por espacios
 * - colapsa espacios continuos y quita bordes
 */
function normalizeProductKey(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Check if a product with the same barcode or same name already exists in inventory */
export async function checkDuplicateProduct(
  name: string,
  barcode?: string | null,
  excludeId?: string
): Promise<{
  isDuplicate: boolean;
  message?: string;
  existingProduct?: { id: string; name: string };
}> {
  const cleanBarcode = barcode?.trim();
  if (cleanBarcode) {
    const existingByBarcode = await prisma.product.findFirst({
      where: {
        barcode: cleanBarcode,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true, barcode: true },
    });
    if (existingByBarcode) {
      return {
        isDuplicate: true,
        message: `El producto ya se encuentra en el inventario con este código de barras ("${existingByBarcode.name}").`,
        existingProduct: existingByBarcode,
      };
    }
  }

  const cleanName = name?.trim();
  if (cleanName) {
    const normInput = normalizeProductKey(cleanName);

    // 1. Coincidencia directa SQL en SQLite (exacta y ASCII-insensitive)
    const exactMatches = excludeId
      ? await prisma.$queryRaw<{ id: string; name: string }[]>`
          SELECT id, name FROM Product
          WHERE id != ${excludeId} AND LOWER(TRIM(name)) = LOWER(TRIM(${cleanName}))
          LIMIT 1
        `
      : await prisma.$queryRaw<{ id: string; name: string }[]>`
          SELECT id, name FROM Product
          WHERE LOWER(TRIM(name)) = LOWER(TRIM(${cleanName}))
          LIMIT 1
        `;

    if (exactMatches && exactMatches.length > 0) {
      return {
        isDuplicate: true,
        message: `El producto ya se encuentra en el inventario ("${exactMatches[0].name}").`,
        existingProduct: exactMatches[0],
      };
    }

    // 2. Coincidencia normalizada en memoria para tildes y signos especiales (0 margen de error)
    if (normInput) {
      const allProducts = await prisma.product.findMany({
        where: excludeId ? { id: { not: excludeId } } : undefined,
        select: { id: true, name: true },
      });

      for (const prod of allProducts) {
        if (normalizeProductKey(prod.name) === normInput) {
          return {
            isDuplicate: true,
            message: `El producto ya se encuentra en el inventario ("${prod.name}").`,
            existingProduct: prod,
          };
        }
      }
    }
  }

  return { isDuplicate: false };
}

async function insertProduct(data: z.infer<typeof productSchema>): Promise<string | null> {
  const dupCheck = await checkDuplicateProduct(data.name, data.barcode);
  if (dupCheck.isDuplicate && dupCheck.message) {
    return dupCheck.message;
  }

  const category = await upsertCategory(data.category);
  const { images, ...rest } = data;
  try {
    const maxItem = await prisma.product.findFirst({ orderBy: { itemNumber: 'desc' }, select: { itemNumber: true } });
    const itemNumber = (maxItem?.itemNumber ?? 0) + 1;
    await prisma.product.create({ data: { ...rest, category, images: serializeExtraImages(images), itemNumber } });
    return null;
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return "El producto ya se encuentra en el inventario con ese código de barras.";
    }
    throw err;
  }
}

/** Same validation/insert path as createProduct, but takes a plain object
 *  instead of FormData and never redirects — the Alta Rápida scanner stays
 *  on its own page and resets for the next scan instead of navigating away,
 *  since the whole point of that flow is scanning several items in a row. */
export async function createProductQuick(input: {
  name: string;
  category: string;
  description: string;
  price: number;
  costPrice: number;
  stock: number;
  image: string | null;
  images?: string[];
  barcode: string | null;
}): Promise<{ error?: string }> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const error = await insertProduct(parsed.data);
  if (error) return { error };

  revalidatePath("/taller-control/productos");
  revalidatePath("/tienda");
  return {};
}

export async function updateProduct(
  id: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const result = parseProductForm(formData);
  if ("error" in result) return { error: result.error };

  const dupCheck = await checkDuplicateProduct(result.data.name, result.data.barcode, id);
  if (dupCheck.isDuplicate && dupCheck.message) {
    return { error: dupCheck.message };
  }

  const category = await upsertCategory(result.data.category);
  const { images, ...rest } = result.data;
  const newImagesJson = serializeExtraImages(images);
  const previous = await prisma.product.findUnique({ where: { id }, select: { image: true, images: true } });
  try {
    await prisma.product.update({
      where: { id },
      data: { ...rest, category, images: newImagesJson },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return { error: "El producto ya se encuentra en el inventario con ese código de barras." };
    }
    throw err;
  }

  // Only clean up once the new row is safely saved, and only for files that
  // actually left the product (cover or gallery) — otherwise re-saving with
  // the same photos would delete files the product still points to.
  const keptImages = new Set([rest.image, ...(images ?? [])].filter((v): v is string => !!v));
  const removedPaths = [previous?.image, ...parseExtraImages(previous?.images ?? null)].filter(
    (v): v is string => !!v && !keptImages.has(v)
  );
  await Promise.all(removedPaths.map((path) => deleteProductImageIfManaged(path)));

  revalidatePath("/taller-control/productos");
  revalidatePath("/tienda");
  redirect("/taller-control/productos");
}

/** Inverse of serializeExtraImages — tolerant of null/malformed values
 *  since this only ever reads back what the app itself wrote. */
function parseExtraImages(images: string | null): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function deleteProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, select: { image: true, images: true } });
  await prisma.product.delete({ where: { id } });
  const paths = [product?.image, ...parseExtraImages(product?.images ?? null)].filter(
    (v): v is string => !!v
  );
  await Promise.all(paths.map((path) => deleteProductImageIfManaged(path)));
  revalidatePath("/taller-control/productos");
  revalidatePath("/tienda");
}
