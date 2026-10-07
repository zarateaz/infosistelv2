import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const buscarProductoAdmin = tool({
  description:
    "Busca un producto en el inventario por nombre, categoría o código de barras. " +
    "Úsala para encontrar el ID del producto y su stock actual antes de descontarlo.",
  inputSchema: z.object({
    consulta: z
      .string()
      .min(1)
      .describe('Nombre del producto o código de barras (ej. "teclado", "123456789").'),
  }),
  execute: async ({ consulta }) => {
    const num = parseInt(consulta, 10);
    const isNum = !isNaN(num);

    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: consulta } },
          { barcode: { equals: consulta } },
          { category: { contains: consulta } },
          ...(isNum ? [{ itemNumber: num }] : []),
        ],
      },
      select: { id: true, itemNumber: true, name: true, stock: true, barcode: true, price: true },
      take: 5,
    });
    return { encontrados: products.length, productos: products };
  },
});

export const registrarVentaAdmin = tool({
  description:
    "Descuenta stock de un producto registrando una venta. " +
    "Debes proporcionar el ID del producto, la cantidad a descontar y el origen de la venta (WEB o FISICA). " +
    "Por defecto asume FISICA si el usuario no especifica.",
  inputSchema: z.object({
    productId: z.string().describe("El ID del producto a descontar."),
    cantidad: z.number().int().positive().describe("Cantidad de unidades a descontar."),
    origen: z.enum(["WEB", "FISICA"]).describe("Origen de la venta."),
  }),
  execute: async ({ productId, cantidad, origen }) => {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return { error: "Producto no encontrado." };
    if (product.stock < cantidad) {
      return { error: `Stock insuficiente. Solo quedan ${product.stock} unidades.` };
    }

    const unitPrice = product.onSale && product.salePrice ? product.salePrice : product.price;
    const unitCost = product.costPrice ?? 0;
    const totalPrice = unitPrice * cantidad;
    const totalCost = unitCost * cantidad;
    const totalProfit = totalPrice - totalCost;

    const [sale, updatedProduct] = await prisma.$transaction([
      prisma.sale.create({
        data: {
          productId: product.id,
          pName: product.name,
          category: product.category,
          quantity: cantidad,
          price: totalPrice,
          costPrice: totalCost,
          profit: totalProfit,
          origin: origen,
        },
      }),
      prisma.product.update({ where: { id: product.id }, data: { stock: { decrement: cantidad } } }),
    ]);

    return { 
      exito: true, 
      mensaje: `Venta registrada correctamente. Stock descontado.`, 
      stockRestante: updatedProduct.stock 
    };
  },
});
