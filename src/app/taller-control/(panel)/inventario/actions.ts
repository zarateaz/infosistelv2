"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { emitInvoice } from "@/lib/invoicing";

const buyerSchema = z.object({
  productId: z.string().min(1),
  docNumber: z.string().trim().max(20).optional(),
  nombre: z.string().trim().max(100).optional(),
  email: z.string().trim().max(150).optional(),
  telefono: z.string().trim().max(20).optional(),
});

export async function sellOneUnit(input: unknown): Promise<{ error?: string }> {
  const parsed = buyerSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };
  const { productId, docNumber, nombre, email, telefono } = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: "Producto no encontrado." };
  if (product.stock <= 0) return { error: "Sin stock disponible." };

  const price = product.onSale && product.salePrice ? product.salePrice : product.price;
  const costPrice = product.costPrice ?? 0;

  const [sale] = await prisma.$transaction([
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

  // Fase 5: la venta ya quedó registrada arriba — un problema al emitir el
  // comprobante nunca revierte la venta ni descuenta el stock de vuelta.
  await emitInvoice({
    saleId: sale.id,
    docNumber,
    nombre,
    email,
    telefono,
    total: price,
    items: [{ descripcion: product.name, cantidad: 1, precioUnitarioConIgv: price }],
  });

  revalidatePath("/taller-control/inventario");
  revalidatePath("/taller-control/productos");
  revalidatePath("/taller-control/ventas");
  revalidatePath("/tienda");
  return {};
}
