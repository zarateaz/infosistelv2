"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteProductImageIfManaged } from "./upload-actions";

export interface AdminProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  costPrice: number | null;
  stock: number;
  image: string | null;
  barcode: string | null;
  isFeatured: boolean;
  onSale: boolean;
  salePrice: number | null;
}

export async function getAdminProducts(): Promise<AdminProduct[]> {
  return prisma.product.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  return prisma.product.findUnique({ where: { id } });
}

export interface ProductFormState {
  error?: string;
}

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
  const parsed = productSchema.safeParse({
    name: formData.get("productName"),
    category: formData.get("category"),
    description: formData.get("description"),
    price: formData.get("price"),
    costPrice: formData.get("costPrice") || 0,
    stock: formData.get("stock"),
    image: formData.get("image"),
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

  const category = await upsertCategory(result.data.category);
  try {
    await prisma.product.create({ data: { ...result.data, category } });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return { error: "Ya existe un producto con ese código de barras." };
    }
    throw err;
  }

  revalidatePath("/admin/productos");
  revalidatePath("/tienda");
  redirect("/admin/productos");
}

export async function updateProduct(
  id: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const result = parseProductForm(formData);
  if ("error" in result) return { error: result.error };

  const category = await upsertCategory(result.data.category);
  const previous = await prisma.product.findUnique({ where: { id }, select: { image: true } });
  try {
    await prisma.product.update({ where: { id }, data: { ...result.data, category } });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return { error: "Ya existe un producto con ese código de barras." };
    }
    throw err;
  }

  // Only clean up once the new row is safely saved, and only if the image
  // actually changed — otherwise re-saving a product with the same photo
  // would delete the very file it still points to.
  if (previous?.image && previous.image !== result.data.image) {
    await deleteProductImageIfManaged(previous.image);
  }

  revalidatePath("/admin/productos");
  revalidatePath("/tienda");
  redirect("/admin/productos");
}

export async function deleteProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, select: { image: true } });
  await prisma.product.delete({ where: { id } });
  if (product?.image) await deleteProductImageIfManaged(product.image);
  revalidatePath("/admin/productos");
  revalidatePath("/tienda");
}
