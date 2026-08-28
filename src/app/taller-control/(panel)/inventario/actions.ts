"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function sellOneUnit(productId: string): Promise<{ error?: string }> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: "Producto no encontrado." };
  if (product.stock <= 0) return { error: "Sin stock disponible." };

  const price = product.onSale && product.salePrice ? product.salePrice : product.price;
  const costPrice = product.costPrice ?? 0;

  await prisma.$transaction([
    prisma.sale.create({
      data: {
        productId: product.id,
        pName: product.name,
        category: product.category,
        quantity: 1,
        price,
        costPrice,
        profit: price - costPrice,
      },
    }),
    prisma.product.update({ where: { id: product.id }, data: { stock: { decrement: 1 } } }),
  ]);

  revalidatePath("/taller-control/inventario");
  revalidatePath("/taller-control/productos");
  revalidatePath("/taller-control/ventas");
  revalidatePath("/tienda");
  return {};
}
