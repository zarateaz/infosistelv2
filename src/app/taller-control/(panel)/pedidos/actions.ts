"use server";

import { prisma } from "@/lib/prisma";
import { decryptPII, blindIndex } from "@/lib/crypto";
import { digitsOnly } from "@/lib/sanitize";

export interface AdminOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  total: number;
  date: Date;
  items: { id: string; name: string; category: string; quantity: number; unitPrice: number | null }[];
}

/** Encrypted at rest (Fase 4) — a raw value that fails to decrypt (corrupt,
 *  or written before encryption existed) shows a flag instead of crashing
 *  the whole order list. */
function safeDecryptPhone(stored: string): string {
  try {
    return decryptPII(stored);
  } catch {
    return "⚠ no se pudo descifrar";
  }
}

export async function getAdminOrders(phoneQuery?: string): Promise<AdminOrder[]> {
  const where = phoneQuery
    ? { customerPhoneIndex: blindIndex(digitsOnly(phoneQuery)) }
    : {};

  const orders = await prisma.order.findMany({
    where,
    orderBy: { date: "desc" },
    include: { items: true },
  });

  return orders.map((o) => ({
    id: o.id,
    customerName: o.customerName,
    customerPhone: safeDecryptPhone(o.customerPhone),
    total: o.total,
    date: o.date,
    items: o.items,
  }));
}
