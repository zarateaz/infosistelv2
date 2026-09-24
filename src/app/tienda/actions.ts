"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sanitizeName, sanitizePhone, sanitizeInt, digitsOnly } from "@/lib/sanitize";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";
import { encryptPII, blindIndex } from "@/lib/crypto";
import { emitInvoice } from "@/lib/invoicing";
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
  // Fase 5 — facturación electrónica. Todos opcionales: sin ellos igual se
  // emite una boleta "sin documento" (sin envío automático por correo).
  docNumber?: string;
  customerEmail?: string;
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

  // Mismo criterio que el CartDrawer (defensa en profundidad: el cliente
  // nunca es el único que valida esto): celular peruano de 9 dígitos
  // empezando en 9, tolerando el prefijo internacional "51".
  const rawPhoneDigits = digitsOnly(sanitizePhone(data.customerPhone));
  const customerPhone =
    rawPhoneDigits.length === 11 && rawPhoneDigits.startsWith("51") ? rawPhoneDigits.slice(2) : rawPhoneDigits;
  if (customerPhone.length !== 9 || !customerPhone.startsWith("9")) {
    throw new Error("Celular inválido (9 dígitos, ej. 987654321)");
  }

  const rawEmail = typeof data.customerEmail === "string" ? data.customerEmail.trim() : "";
  if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    throw new Error("Correo inválido");
  }

  const docDigits = digitsOnly(typeof data.docNumber === "string" ? data.docNumber : "");
  if (docDigits && docDigits.length !== 8 && docDigits.length !== 11) {
    throw new Error("DNI (8 dígitos) o RUC (11 dígitos) inválido");
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

  // Fase 4: the phone never touches the database in plaintext. The blind
  // index (HMAC of the digits-only number) is what a future admin lookup
  // ("find this customer's past orders") would search on instead.
  const order = await prisma.order.create({
    data: {
      customerName,
      customerPhone: encryptPII(customerPhone),
      customerPhoneIndex: blindIndex(digitsOnly(customerPhone)),
      total: serverTotal,
      items: { create: orderItems },
    },
    include: { items: true },
  });

  // Fase 5: se emite el comprobante justo después de crear el pedido, nunca
  // dentro de la misma transacción — un problema con NubeFacT/SUNAT no debe
  // impedir que el pedido quede registrado.
  const invoice = await emitInvoice({
    orderId: order.id,
    docNumber: docDigits || undefined,
    nombre: customerName,
    email: rawEmail || undefined,
    total: order.total,
    items: orderItems.map((item) => ({
      descripcion: item.name,
      cantidad: item.quantity,
      precioUnitarioConIgv: item.unitPrice,
    })),
  });

  return {
    id: order.id,
    total: order.total,
    invoiceStatus: invoice?.estado ?? null,
    invoicePdfUrl: invoice?.pdfUrl ?? null,
  };
}
