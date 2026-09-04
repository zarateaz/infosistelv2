"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { decryptPII, blindIndex } from "@/lib/crypto";
import { digitsOnly } from "@/lib/sanitize";
import { retryInvoiceEmission } from "@/lib/invoicing";

export interface AdminOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  total: number;
  date: Date;
  items: { id: string; name: string; category: string; quantity: number; unitPrice: number | null }[];
  invoice: { id: string; estado: string; pdfUrl: string | null } | null;
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
    include: {
      items: true,
      invoices: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    customerName: o.customerName,
    customerPhone: safeDecryptPhone(o.customerPhone),
    total: o.total,
    date: o.date,
    items: o.items,
    invoice: o.invoices[0] ? { id: o.invoices[0].id, estado: o.invoices[0].estado, pdfUrl: o.invoices[0].pdfUrl } : null,
  }));
}

export async function retryOrderInvoice(invoiceId: string): Promise<void> {
  await retryInvoiceEmission(invoiceId);
  revalidatePath("/taller-control/pedidos");
}
