"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { emitInvoice } from "@/lib/invoicing";

const buyerSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).default(1).optional(),
  docNumber: z.string().trim().max(20).optional(),
  nombre: z.string().trim().max(100).optional(),
  email: z.string().trim().max(150).optional(),
  telefono: z.string().trim().max(20).optional(),
});

export async function sellOneUnit(input: unknown): Promise<{
  error?: string;
  lowStockAlert?: boolean;
  remainingStock?: number;
  productName?: string;
}> {
  const parsed = buyerSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };
  const { productId, docNumber, nombre, email, telefono } = parsed.data;
  const quantity = parsed.data.quantity ?? 1;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: "Producto no encontrado." };
  if (product.stock <= 0) return { error: "Sin stock disponible." };
  if (product.stock < quantity) {
    return { error: `Stock insuficiente. Solo quedan ${product.stock} unidad(es) disponible(s).` };
  }

  const unitPrice = product.onSale && product.salePrice ? product.salePrice : product.price;
  const unitCost = product.costPrice ?? 0;
  const totalPrice = unitPrice * quantity;
  const totalCost = unitCost * quantity;
  const totalProfit = totalPrice - totalCost;

  const [sale, updatedProduct] = await prisma.$transaction([
    prisma.sale.create({
      data: {
        productId: product.id,
        pName: product.name,
        category: product.category,
        quantity,
        price: totalPrice,
        costPrice: totalCost,
        profit: totalProfit,
      },
    }),
    prisma.product.update({ where: { id: product.id }, data: { stock: { decrement: quantity } } }),
  ]);

  // Fase 5: la venta ya quedó registrada arriba — un problema al emitir el
  // comprobante nunca revierte la venta ni descuenta el stock de vuelta.
  await emitInvoice({
    saleId: sale.id,
    docNumber,
    nombre,
    email,
    telefono,
    total: totalPrice,
    items: [{ descripcion: product.name, cantidad: quantity, precioUnitarioConIgv: unitPrice }],
  });

  revalidatePath("/taller-control/inventario");
  revalidatePath("/taller-control/productos");
  revalidatePath("/taller-control/ventas");
  revalidatePath("/taller-control/reporte-mensual");
  revalidatePath("/taller-control");
  revalidatePath("/tienda");

  return {
    lowStockAlert: updatedProduct.stock <= 1,
    remainingStock: updatedProduct.stock,
    productName: product.name,
  };
}
