"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInputToUtcNoon, formatQuotationDate } from "@/lib/quotationDates";

export interface QuotationItemData {
  id?: string;
  productId?: string | null;
  description: string;
  brand?: string | null;
  model?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string | null;
}

export interface QuotationRecord {
  id: string;
  code: string;
  clientName: string;
  clientDocType: string | null;
  clientDocNum: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  clientAddress: string | null;
  attentionTo: string | null;
  issueDate: Date;
  validDays: number;
  currency: string;
  includeIgv: boolean;
  subtotal: number;
  igv: number;
  discount: number;
  total: number;
  status: string;
  deliveryTime: string | null;
  paymentMethod: string | null;
  warranty: string | null;
  notes: string | null;
  items: QuotationItemData[];
  createdAt: Date;
}

export interface CatalogProductResult {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string | null;
}

export async function generateNextQuotationCode(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `COT-${currentYear}-`;

  const lastQuotation = await prisma.quotation.findFirst({
    where: {
      code: { startsWith: prefix },
    },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  if (!lastQuotation) {
    return `${prefix}0001`;
  }

  const parts = lastQuotation.code.split("-");
  const lastNum = parseInt(parts[parts.length - 1], 10);
  const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export async function listQuotations(filter?: {
  status?: string;
  query?: string;
}): Promise<QuotationRecord[]> {
  const where: any = {
    deletedAt: null,
  };

  if (filter?.status && filter.status !== "TODAS") {
    where.status = filter.status;
  }

  if (filter?.query && filter.query.trim()) {
    const q = filter.query.trim();
    where.OR = [
      { code: { contains: q } },
      { clientName: { contains: q } },
      { clientDocNum: { contains: q } },
      { clientPhone: { contains: q } },
    ];
  }

  const rows = await prisma.quotation.findMany({
    where,
    orderBy: { issueDate: "desc" },
    include: {
      items: {
        orderBy: { id: "asc" },
      },
    },
  });

  return rows as unknown as QuotationRecord[];
}

export async function getQuotationById(id: string): Promise<QuotationRecord | null> {
  const row = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { id: "asc" },
      },
    },
  });

  return row as unknown as QuotationRecord | null;
}

export async function getQuotationByCode(code: string): Promise<QuotationRecord | null> {
  const row = await prisma.quotation.findUnique({
    where: { code },
    include: {
      items: {
        orderBy: { id: "asc" },
      },
    },
  });

  return row as unknown as QuotationRecord | null;
}

const itemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullish(),
  description: z.string().trim().min(1, "La descripción del ítem es requerida."),
  brand: z.string().nullish(),
  model: z.string().nullish(),
  quantity: z.coerce.number().int().min(1, "La cantidad mínima es 1"),
  unitPrice: z.coerce.number().min(0, "El precio no puede ser negativo"),
  notes: z.string().nullish(),
});

const quotationInputSchema = z.object({
  clientName: z.string().trim().min(1, "El nombre del cliente es obligatorio."),
  clientDocType: z.string().nullish(),
  clientDocNum: z.string().nullish(),
  clientPhone: z.string().nullish(),
  clientEmail: z.string().nullish(),
  clientAddress: z.string().nullish(),
  attentionTo: z.string().nullish(),
  issueDate: z.string().optional(),
  validDays: z.coerce.number().int().min(1).default(15).optional(),
  currency: z.enum(["PEN", "USD"]).default("PEN").optional(),
  includeIgv: z.boolean().default(true).optional(),
  discount: z.coerce.number().min(0).default(0).optional(),
  status: z.enum(["PENDIENTE", "ENVIADA", "APROBADA", "RECHAZADA", "FACTURADA"]).default("PENDIENTE").optional(),
  deliveryTime: z.string().nullish(),
  paymentMethod: z.string().nullish(),
  warranty: z.string().nullish(),
  notes: z.string().nullish(),
  items: z.array(itemSchema).min(1, "Debe agregar al menos un ítem a la cotización."),
});

export type CreateQuotationInput = z.infer<typeof quotationInputSchema>;

export async function createQuotation(
  data: CreateQuotationInput
): Promise<{ success?: boolean; error?: string; quotation?: QuotationRecord }> {
  try {
    const parsed = quotationInputSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const val = parsed.data;

    // Calculate items totals
    let rawSubtotal = 0;
    const computedItems = val.items.map((it) => {
      const lineTotal = Number((it.quantity * it.unitPrice).toFixed(2));
      rawSubtotal += lineTotal;
      return {
        productId: it.productId || null,
        description: it.description,
        brand: it.brand || null,
        model: it.model || null,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: lineTotal,
        notes: it.notes || null,
      };
    });

    const discount = Number((val.discount || 0).toFixed(2));
    const taxableBase = Math.max(0, rawSubtotal - discount);

    let igv = 0;
    let finalTotal = taxableBase;

    if (val.includeIgv) {
      igv = Number((taxableBase * 0.18).toFixed(2));
      finalTotal = Number((taxableBase + igv).toFixed(2));
    }

    const code = await generateNextQuotationCode();
    const issueDate = parseDateInputToUtcNoon(val.issueDate);

    const created = await prisma.quotation.create({
      data: {
        code,
        clientName: val.clientName,
        clientDocType: val.clientDocType || null,
        clientDocNum: val.clientDocNum || null,
        clientPhone: val.clientPhone || null,
        clientEmail: val.clientEmail || null,
        clientAddress: val.clientAddress || null,
        attentionTo: val.attentionTo || null,
        issueDate,
        validDays: val.validDays,
        currency: val.currency,
        includeIgv: val.includeIgv,
        subtotal: Number(rawSubtotal.toFixed(2)),
        discount,
        igv,
        total: finalTotal,
        status: val.status,
        deliveryTime: val.deliveryTime || "Inmediata",
        paymentMethod: val.paymentMethod || "Contado contra entrega / Transferencia",
        warranty: val.warranty || "12 meses de garantía oficial Infosistel",
        notes: val.notes || null,
        items: {
          create: computedItems,
        },
      },
      include: {
        items: true,
      },
    });

    revalidatePath("/taller-control/cotizaciones");
    revalidatePath("/cotizar");

    return { success: true, quotation: created as unknown as QuotationRecord };
  } catch (err: any) {
    console.error("Error creating quotation:", err);
    return { error: err.message || "Error al crear la cotización." };
  }
}

export async function updateQuotation(
  id: string,
  data: CreateQuotationInput
): Promise<{ success?: boolean; error?: string; quotation?: QuotationRecord }> {
  try {
    const parsed = quotationInputSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const val = parsed.data;

    let rawSubtotal = 0;
    const computedItems = val.items.map((it) => {
      const lineTotal = Number((it.quantity * it.unitPrice).toFixed(2));
      rawSubtotal += lineTotal;
      return {
        productId: it.productId || null,
        description: it.description,
        brand: it.brand || null,
        model: it.model || null,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: lineTotal,
        notes: it.notes || null,
      };
    });

    const discount = Number((val.discount || 0).toFixed(2));
    const taxableBase = Math.max(0, rawSubtotal - discount);

    let igv = 0;
    let finalTotal = taxableBase;

    if (val.includeIgv) {
      igv = Number((taxableBase * 0.18).toFixed(2));
      finalTotal = Number((taxableBase + igv).toFixed(2));
    }

    const issueDate = val.issueDate ? parseDateInputToUtcNoon(val.issueDate) : undefined;

    // Delete previous items and insert new ones
    const updated = await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });

      return tx.quotation.update({
        where: { id },
        data: {
          clientName: val.clientName,
          clientDocType: val.clientDocType || null,
          clientDocNum: val.clientDocNum || null,
          clientPhone: val.clientPhone || null,
          clientEmail: val.clientEmail || null,
          clientAddress: val.clientAddress || null,
          attentionTo: val.attentionTo || null,
          ...(issueDate ? { issueDate } : {}),
          validDays: val.validDays,
          currency: val.currency,
          includeIgv: val.includeIgv,
          subtotal: Number(rawSubtotal.toFixed(2)),
          discount,
          igv,
          total: finalTotal,
          status: val.status,
          deliveryTime: val.deliveryTime || null,
          paymentMethod: val.paymentMethod || null,
          warranty: val.warranty || null,
          notes: val.notes || null,
          items: {
            create: computedItems,
          },
        },
        include: {
          items: true,
        },
      });
    });

    revalidatePath("/taller-control/cotizaciones");
    return { success: true, quotation: updated as unknown as QuotationRecord };
  } catch (err: any) {
    console.error("Error updating quotation:", err);
    return { error: err.message || "Error al actualizar la cotización." };
  }
}

export async function updateQuotationStatus(
  id: string,
  status: "PENDIENTE" | "ENVIADA" | "APROBADA" | "RECHAZADA" | "FACTURADA"
): Promise<{ success?: boolean; error?: string }> {
  try {
    await prisma.quotation.update({
      where: { id },
      data: { status },
    });
    revalidatePath("/taller-control/cotizaciones");
    return { success: true };
  } catch (err: any) {
    console.error("Error updating status:", err);
    return { error: err.message || "Error al actualizar el estado." };
  }
}

export async function deleteQuotation(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await prisma.quotation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/taller-control/cotizaciones");
    return { success: true };
  } catch (err: any) {
    console.error("Error deleting quotation:", err);
    return { error: err.message || "Error al eliminar la cotización." };
  }
}

export async function searchCatalogProducts(query: string): Promise<CatalogProductResult[]> {
  const q = query.trim();
  if (!q) {
    // Return latest 15 products with stock
    const products = await prisma.product.findMany({
      take: 15,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        category: true,
      },
    });
    return products;
  }

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { category: { contains: q } },
        { description: { contains: q } },
      ],
    },
    take: 20,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      category: true,
    },
  });

  return products;
}

export async function buildWhatsAppQuotationLink(
  quotation: QuotationRecord,
  baseUrl: string = "https://infosistel.pe"
): Promise<string> {
  const phone = quotation.clientPhone ? quotation.clientPhone.replace(/\D/g, "") : "";
  const targetPhone = phone.length >= 9 ? (phone.startsWith("51") ? phone : `51${phone}`) : "";

  const curr = quotation.currency === "USD" ? "$" : "S/.";

  const lines = [
    `👋 Estimado(a) *${quotation.clientName}*, le saludamos de *INFOSISTEL*.`,
    ``,
    `Le hacemos llegar la cotización solicitada:`,
    `📄 *Cotización N°:* ${quotation.code}`,
    `📅 *Fecha:* ${formatQuotationDate(quotation.issueDate)}`,
    `⏳ *Validez:* ${quotation.validDays} días calendario`,
    ``,
    `📦 *Detalle de Productos / Servicios:*`,
  ];

  quotation.items.forEach((it, idx) => {
    lines.push(`${idx + 1}. *${it.description}* (x${it.quantity}) — ${curr} ${it.total.toFixed(2)}`);
  });

  lines.push(``);
  lines.push(`💰 *TOTAL:* ${curr} ${quotation.total.toFixed(2)}`);
  if (quotation.deliveryTime) {
    lines.push(`🚚 *Entrega:* ${quotation.deliveryTime}`);
  }
  if (quotation.warranty) {
    lines.push(`🛡️ *Garantía:* ${quotation.warranty}`);
  }
  lines.push(``);
  lines.push(`🌐 Puede consultar y descargar su documento PDF oficial aquí:`);
  lines.push(`${baseUrl}/cotizacion/${quotation.code}`);
  lines.push(``);
  lines.push(`Estamos atentos a cualquier consulta. ¡Muchas gracias por su preferencia! ✨`);

  const text = encodeURIComponent(lines.join("\n"));
  return targetPhone ? `https://wa.me/${targetPhone}?text=${text}` : `https://wa.me/?text=${text}`;
}
