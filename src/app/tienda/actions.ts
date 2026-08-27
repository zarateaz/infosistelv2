"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sanitizeName, sanitizePhone, sanitizeInt } from "@/lib/sanitize";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";
import type { Product, Category } from "@/types";

export async function getProducts(): Promise<Product[]> {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    // costPrice is admin-only — never select it into a response a browser can read.
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      price: true,
      stock: true,
      image: true,
      isFeatured: true,
      onSale: true,
      salePrice: true,
    },
  });
  return products;
}

export async function getCategories(): Promise<Category[]> {
  return prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  items: { productId: string; quantity: number }[];
}

export async function createOrder(input: unknown) {
  // Order creation is public (no login yet) and cheap to spam — same
  // rate-limit discipline as the chat endpoint. OWASP API4:2023.
  const ip = getClientIP(await headers());
  const rateCheck = checkRateLimit(rateLimitKey("order", ip), 20, 10 * 60 * 1000);
  if (!rateCheck.allowed) {
    throw new Error("Demasiadas solicitudes. Intenta de nuevo en unos minutos.");
  }

  const data = input as Partial<CreateOrderInput>;
  const customerName = sanitizeName(data.customerName, 80) || "Cliente Web";
  const customerPhone = sanitizePhone(data.customerPhone);
  if (!customerPhone || customerPhone.length < 7) {
    throw new Error("Teléfono requerido (mínimo 7 dígitos)");
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("El carrito está vacío");
  }
  if (data.items.length > 50) {
    throw new Error("Demasiados productos en el pedido");
  }

  // SECURITY: the total is NEVER taken from the client — every line's price
  // is looked up fresh from the database right here, at order time.
  let serverTotal = 0;
  const orderItems: { productId: string; name: string; category: string; quantity: number; unitPrice: number }[] = [];

  for (const rawItem of data.items) {
    const quantity = sanitizeInt(rawItem?.quantity, 1, 99) ?? 1;
    const productId = typeof rawItem?.productId === "string" ? rawItem.productId : "";
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, category: true, price: true, salePrice: true, onSale: true },
    });
    if (!product) {
      throw new Error("Uno de los productos ya no está disponible");
    }
    const unitPrice = product.onSale && product.salePrice ? product.salePrice : product.price;
    serverTotal += unitPrice * quantity;
    orderItems.push({ productId: product.id, name: product.name, category: product.category, quantity, unitPrice });
  }

  const order = await prisma.order.create({
    data: {
      customerName,
      customerPhone,
      total: serverTotal,
      items: { create: orderItems },
    },
    include: { items: true },
  });

  return { id: order.id, total: order.total };
}
