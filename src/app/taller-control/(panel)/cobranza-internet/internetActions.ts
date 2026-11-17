"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/money";
import type { PaymentMethodType } from "@/lib/paymentMethods";
import { dateToInputValue, parseDateInput, todayInputValue } from "../caja/month";
import {
  calculateNextPaymentDate,
  formatMonthKeyLabel,
  normalizeInternetPaymentMethod,
  parsePaidMonths,
  type InternetClientRow,
  type PaidMonthsMap,
} from "./cobranza";

const PATH = "/taller-control/cobranza-internet";

function revalidateAllRelatedPaths() {
  try {
    revalidatePath(PATH);
    revalidatePath("/taller-control/internetlista");
    revalidatePath("/taller-control/caja");
    revalidatePath("/taller-control/papelera");
    revalidatePath("/taller-control/reporte-mensual");
  } catch {
    // Fuera de ciclo Next.js
  }
}

/**
 * Incrementa atómicamente el correlativo de boletas/recibos de internet en InvoiceCounter
 * y retorna un número formateado exactamente a 6 dígitos (ej: "000101").
 */
export async function getNextInternetReceiptNumber(tx?: any): Promise<string> {
  const runner = tx || prisma;
  const counter = await runner.invoiceCounter.upsert({
    where: { serie: "REC_INT" },
    create: { serie: "REC_INT", lastNumber: 101 },
    update: { lastNumber: { increment: 1 } },
  });
  return String(counter.lastNumber).padStart(6, "0");
}

/**
 * Lee sin incrementar el próximo número sugerido de recibo (para preview en UI).
 */
export async function peekNextInternetReceiptNumber(): Promise<string> {
  try {
    const counter = await prisma.invoiceCounter.findUnique({
      where: { serie: "REC_INT" },
    });
    const nextNum = (counter?.lastNumber ?? 100) + 1;
    return String(nextNum).padStart(6, "0");
  } catch {
    return "000101";
  }
}

function buildCashboxDescription(
  clientName: string,
  monthLabel: string,
  clientCode?: string | null
): string {
  const codePart = clientCode ? ` (${clientCode})` : "";
  return `Internet · ${clientName} · ${monthLabel}${codePart}`.slice(0, 200);
}

function buildCashboxNotes(
  row: {
    galeria?: string | null;
    router?: string | null;
    portNumber?: number | null;
    whatsapp?: string | null;
  },
  note?: string | null
): string | null {
  const parts = [
    row.galeria ? `Galería/Stand: ${row.galeria}` : null,
    row.router && row.portNumber
      ? `${row.router} - Pto ${row.portNumber}`
      : row.router
      ? row.router
      : null,
    row.whatsapp ? `Cel: ${row.whatsapp}` : null,
    note ? `Nota: ${note}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ").slice(0, 500) : null;
}

export async function getInternetClients(): Promise<InternetClientRow[]> {
  const rows = await prisma.internetClient.findMany({ orderBy: { nextPaymentDate: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    clientCode: r.clientCode,
    clientName: r.clientName,
    whatsapp: r.whatsapp,
    galeria: r.galeria,
    router: r.router,
    portNumber: r.portNumber,
    startDate: dateToInputValue(r.startDate),
    nextPaymentDate: dateToInputValue(r.nextPaymentDate),
    amount: r.amount,
    concept: r.concept,
    paidMonths: r.paidMonths,
  }));
}

/** Normaliza a dígitos con código de país: 9 dígitos => antepone 51 (Perú). */
function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 9 ? `51${digits}` : digits;
}

const clientSchema = z.object({
  clientCode: z
    .string()
    .trim()
    .max(50, "El código no puede superar 50 caracteres")
    .optional()
    .nullable()
    .transform((v) => (v ? v.toUpperCase() : null)),
  clientName: z.string().trim().min(1, "El nombre es obligatorio").max(150),
  whatsapp: z
    .string()
    .transform(normalizeWhatsapp)
    .refine((v) => v.length >= 9 && v.length <= 15, "WhatsApp inválido (9 dígitos, ej. 964648202)"),
  galeria: z
    .string()
    .trim()
    .max(120, "El nombre de la galería no puede superar 120 caracteres")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  router: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  portNumber: z.coerce
    .number()
    .min(1, "El puerto debe ser entre 1 y 16")
    .max(16, "El puerto debe ser entre 1 y 16")
    .optional()
    .nullable()
    .transform((v) => (v && v >= 1 && v <= 16 ? v : null)),
  startDate: z.string().refine((v) => parseDateInput(v) !== null, "Fecha de inicio inválida"),
  nextPaymentDate: z.string().refine((v) => parseDateInput(v) !== null, "Fecha de pago inválida"),
  amount: z.coerce.number().min(0, "El monto no puede ser negativo").default(0),
  concept: z
    .string()
    .trim()
    .max(200, "El concepto no puede superar 200 caracteres")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export interface InternetFormState {
  error?: string;
}

export async function createInternetClient(
  _prev: InternetFormState,
  formData: FormData
): Promise<InternetFormState> {
  const parsed = clientSchema.safeParse({
    clientCode: formData.get("clientCode")?.toString() || null,
    clientName: formData.get("clientName"),
    whatsapp: formData.get("whatsapp") ?? "",
    galeria: formData.get("galeria")?.toString() || null,
    router: formData.get("router")?.toString() || null,
    portNumber: formData.get("portNumber") ? Number(formData.get("portNumber")) : null,
    startDate: formData.get("startDate"),
    nextPaymentDate: formData.get("nextPaymentDate"),
    amount: formData.get("amount") || 0,
    concept: formData.get("concept")?.toString() ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const { startDate, nextPaymentDate, ...rest } = parsed.data;
  const start = parseDateInput(startDate)!;
  const nextPay = parseDateInput(nextPaymentDate)!;

  // Inicializar mapa de meses pagados
  const map = parsePaidMonths(null, startDate, nextPaymentDate, rest.amount);

  await prisma.internetClient.create({
    data: {
      ...rest,
      startDate: start,
      nextPaymentDate: nextPay,
      paidMonths: JSON.stringify(map),
    },
  });
  revalidatePath(PATH);
  return {};
}

/** Suma un mes (UTC) conservando el día; si no existe (31 → feb) usa el último día. */
function addOneMonthUTC(date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const lastDayNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDayNext)));
}

export interface MarkPaidOptions {
  amount?: number;
  method?: PaymentMethodType | string;
  paidAt?: string;
  note?: string;
  receiptNumber?: string;
  syncToCashbox?: boolean;
}

/**
 * "Pagó": corre la próxima fecha de pago al siguiente mes pendiente,
 * marca el mes pagado en paidMonths con correlativo de recibo de 6 dígitos
 * y opcionalmente sincroniza a Caja (CashboxTransaction).
 */
export async function markInternetPaid(
  id: string,
  options?: MarkPaidOptions
): Promise<{ ok: boolean; error?: string; newNextPaymentDate?: string; receiptNumber?: string }> {
  const row = await prisma.internetClient.findUnique({ where: { id } });
  if (!row) return { ok: false, error: "Cliente no encontrado." };

  const startStr = dateToInputValue(row.startDate);
  const nextPayStr = dateToInputValue(row.nextPaymentDate);
  const map: PaidMonthsMap = parsePaidMonths(row.paidMonths, startStr, nextPayStr, row.amount);

  const [ny, nm] = nextPayStr.split("-").map(Number);
  const key = `${ny}-${String(nm).padStart(2, "0")}`;
  const todayStr = todayInputValue();
  const paidAtStr = options?.paidAt || todayStr;
  const paidDate = parseDateInput(paidAtStr) ?? parseDateInput(todayStr)!;
  const payAmount = round2(options?.amount !== undefined ? options.amount : row.amount);
  const payMethod = normalizeInternetPaymentMethod(options?.method);
  const syncToCashbox = options?.syncToCashbox !== false;

  let finalReceiptNumber = options?.receiptNumber?.trim();

  const newNextPaymentDateStr = calculateNextPaymentDate(startStr, nextPayStr, {
    ...map,
    [key]: { status: "paid", amount: payAmount, method: payMethod, paidAt: paidAtStr },
  });
  const newNextPay = parseDateInput(newNextPaymentDateStr) ?? addOneMonthUTC(row.nextPaymentDate);

  await prisma.$transaction(async (tx) => {
    let cashboxTransactionId: string | undefined = undefined;

    if (!finalReceiptNumber) {
      finalReceiptNumber = await getNextInternetReceiptNumber(tx);
    } else {
      finalReceiptNumber = finalReceiptNumber.replace(/\D/g, "").slice(-6).padStart(6, "0");
    }

    if (syncToCashbox && payAmount > 0) {
      const monthLabel = formatMonthKeyLabel(key);
      const description = buildCashboxDescription(row.clientName, monthLabel, row.clientCode);
      const notes = buildCashboxNotes(row, options?.note ? `${options.note} · Recibo #${finalReceiptNumber}` : `Recibo #${finalReceiptNumber}`);

      const cashboxTx = await tx.cashboxTransaction.create({
        data: {
          date: paidDate,
          type: "INCOME",
          amount: payAmount,
          paymentMethod: payMethod,
          description,
          notes,
        },
      });
      cashboxTransactionId = cashboxTx.id;
    }

    map[key] = {
      status: "paid",
      paidAt: paidAtStr,
      amount: payAmount,
      method: payMethod,
      note: options?.note || "Pago puntual",
      receiptNumber: finalReceiptNumber,
      ...(cashboxTransactionId ? { cashboxTransactionId } : {}),
    };

    await tx.internetClient.update({
      where: { id },
      data: {
        paidMonths: JSON.stringify(map),
        nextPaymentDate: newNextPay,
      },
    });
  });

  revalidateAllRelatedPaths();
  return { ok: true, newNextPaymentDate: newNextPaymentDateStr, receiptNumber: finalReceiptNumber };
}

export async function deleteInternetClient(id: string): Promise<void> {
  const row = await prisma.internetClient.findUnique({
    where: { id },
    select: { paidMonths: true },
  });
  const cashboxIds: string[] = [];
  if (row?.paidMonths) {
    try {
      const parsed = JSON.parse(row.paidMonths) as PaidMonthsMap;
      for (const rec of Object.values(parsed)) {
        if (rec.cashboxTransactionId) cashboxIds.push(rec.cashboxTransactionId);
      }
    } catch {
      // ignore
    }
  }

  await prisma.$transaction(async (tx) => {
    if (cashboxIds.length > 0) {
      await tx.cashboxTransaction.updateMany({
        where: { id: { in: cashboxIds }, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }
    await tx.internetClient.deleteMany({ where: { id } });
  });

  revalidateAllRelatedPaths();
}

/** Elimina del historial los meses anteriores a la fecha de inicio real del cliente. */
function prunePaidMonthsBeforeStart(raw: string | null | undefined, startDate: string): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    const startKey = startDate.slice(0, 7);
    const cleaned: PaidMonthsMap = {};
    for (const [k, v] of Object.entries(parsed as PaidMonthsMap)) {
      if (k >= startKey) cleaned[k] = v;
    }
    return JSON.stringify(cleaned);
  } catch {
    return undefined;
  }
}

export async function updateInternetClient(
  _prev: InternetFormState,
  formData: FormData
): Promise<InternetFormState> {
  const id = formData.get("id")?.toString();
  if (!id) return { error: "ID de cliente no proporcionado." };

  const parsed = clientSchema.safeParse({
    clientCode: formData.get("clientCode")?.toString() || null,
    clientName: formData.get("clientName"),
    whatsapp: formData.get("whatsapp") ?? "",
    galeria: formData.get("galeria")?.toString() || null,
    router: formData.get("router")?.toString() || null,
    portNumber: formData.get("portNumber") ? Number(formData.get("portNumber")) : null,
    startDate: formData.get("startDate"),
    nextPaymentDate: formData.get("nextPaymentDate"),
    amount: formData.get("amount") || 0,
    concept: formData.get("concept")?.toString() ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const { startDate, nextPaymentDate, ...rest } = parsed.data;
  const start = parseDateInput(startDate);
  const nextPay = parseDateInput(nextPaymentDate);
  if (!start || !nextPay) return { error: "Fechas inválidas." };

  const existing = await prisma.internetClient.findUnique({ where: { id }, select: { paidMonths: true } });
  const prunedPaidMonths = prunePaidMonthsBeforeStart(existing?.paidMonths, startDate);

  await prisma.internetClient.update({
    where: { id },
    data: {
      ...rest,
      startDate: start,
      nextPaymentDate: nextPay,
      ...(prunedPaidMonths !== undefined ? { paidMonths: prunedPaidMonths } : {}),
    },
  });
  revalidatePath(PATH);
  return {};
}

export async function updateInternetClientDirect(
  id: string,
  data: {
    clientCode?: string | null;
    clientName: string;
    whatsapp: string;
    galeria?: string | null;
    router?: string | null;
    portNumber?: number | null;
    startDate: string;
    nextPaymentDate: string;
    amount: number;
    concept?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { startDate, nextPaymentDate, ...rest } = parsed.data;
  const start = parseDateInput(startDate);
  const nextPay = parseDateInput(nextPaymentDate);
  if (!start || !nextPay) {
    return { ok: false, error: "Fechas inválidas." };
  }

  const existing = await prisma.internetClient.findUnique({ where: { id }, select: { paidMonths: true } });
  const prunedPaidMonths = prunePaidMonthsBeforeStart(existing?.paidMonths, startDate);

  await prisma.internetClient.update({
    where: { id },
    data: {
      ...rest,
      startDate: start,
      nextPaymentDate: nextPay,
      ...(prunedPaidMonths !== undefined ? { paidMonths: prunedPaidMonths } : {}),
    },
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Alterna (o fija) el estado de pago de un mes específico (ej: "2026-08").
 * Recalcula automáticamente la próxima fecha de pago y sincroniza con Caja.
 */
export async function toggleInternetClientMonth(
  id: string,
  yearMonth: string,
  details?: {
    paid?: boolean;
    amount?: number;
    method?: string;
    note?: string;
    paidAt?: string;
    receiptNumber?: string;
    syncToCashbox?: boolean;
  }
): Promise<{ ok: boolean; newNextPaymentDate?: string; receiptNumber?: string; error?: string }> {
  const row = await prisma.internetClient.findUnique({ where: { id } });
  if (!row) return { ok: false, error: "Cliente no encontrado." };

  const startStr = dateToInputValue(row.startDate);
  const nextPayStr = dateToInputValue(row.nextPaymentDate);
  const map: PaidMonthsMap = parsePaidMonths(row.paidMonths, startStr, nextPayStr, row.amount);

  const currentlyPaid = map[yearMonth]?.status === "paid";
  const shouldBePaid = details?.paid !== undefined ? details.paid : !currentlyPaid;
  const todayStr = todayInputValue();
  const paidAtStr = details?.paidAt || map[yearMonth]?.paidAt || todayStr;
  const paidDate = parseDateInput(paidAtStr) ?? parseDateInput(todayStr)!;
  const payAmount = round2(
    details?.amount !== undefined ? details.amount : map[yearMonth]?.amount ?? row.amount
  );
  const payMethod = normalizeInternetPaymentMethod(details?.method ?? map[yearMonth]?.method);
  const syncToCashbox = details?.syncToCashbox !== false;
  const existingTxId = map[yearMonth]?.cashboxTransactionId;

  let assignedReceiptNumber: string | undefined = undefined;

  await prisma.$transaction(async (tx) => {
    if (shouldBePaid) {
      let cashboxTransactionId = existingTxId;
      assignedReceiptNumber = details?.receiptNumber?.trim()
        ? details.receiptNumber.trim().replace(/\D/g, "").slice(-6).padStart(6, "0")
        : map[yearMonth]?.receiptNumber || (await getNextInternetReceiptNumber(tx));

      if (!cashboxTransactionId && syncToCashbox && payAmount > 0) {
        const monthLabel = formatMonthKeyLabel(yearMonth);
        const description = buildCashboxDescription(row.clientName, monthLabel, row.clientCode);
        const notes = buildCashboxNotes(row, details?.note ? `${details.note} · Recibo #${assignedReceiptNumber}` : `Recibo #${assignedReceiptNumber}`);

        const cashboxTx = await tx.cashboxTransaction.create({
          data: {
            date: paidDate,
            type: "INCOME",
            amount: payAmount,
            paymentMethod: payMethod,
            description,
            notes,
          },
        });
        cashboxTransactionId = cashboxTx.id;
      }

      map[yearMonth] = {
        status: "paid",
        paidAt: paidAtStr,
        amount: payAmount,
        method: payMethod,
        note: details?.note ?? map[yearMonth]?.note ?? "Pago registrado",
        receiptNumber: assignedReceiptNumber,
        ...(cashboxTransactionId ? { cashboxTransactionId } : {}),
      };
    } else {
      // Revertir pago: si tenía movimiento en Caja, enviarlo a papelera (soft delete)
      if (existingTxId) {
        await tx.cashboxTransaction.updateMany({
          where: { id: existingTxId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      }
      map[yearMonth] = {
        status: "unpaid",
      };
    }

    const newNextPaymentDateStr = calculateNextPaymentDate(startStr, nextPayStr, map);
    const newNextPayDate = parseDateInput(newNextPaymentDateStr);

    await tx.internetClient.update({
      where: { id },
      data: {
        paidMonths: JSON.stringify(map),
        ...(newNextPayDate ? { nextPaymentDate: newNextPayDate } : {}),
      },
    });
  });

  const finalNextPaymentDateStr = calculateNextPaymentDate(startStr, nextPayStr, map);
  revalidateAllRelatedPaths();
  return { ok: true, newNextPaymentDate: finalNextPaymentDateStr, receiptNumber: assignedReceiptNumber };
}

/**
 * Paga N meses por adelantado (ej. 2 meses adelantados).
 * Marca los siguientes N meses impagos como pagados, crea los ingresos en Caja y actualiza la fecha de próximo pago.
 */
export async function payAdvanceInternetMonths(
  id: string,
  count: number = 2,
  options?: {
    amountPerMonth?: number;
    method?: string;
    note?: string;
    paidAt?: string;
    syncToCashbox?: boolean;
  }
): Promise<{ ok: boolean; countPaid?: number; newNextPaymentDate?: string; receiptNumbers?: string[]; error?: string }> {
  if (count <= 0) return { ok: false, error: "Cantidad de meses inválida." };

  const row = await prisma.internetClient.findUnique({ where: { id } });
  if (!row) return { ok: false, error: "Cliente no encontrado." };

  const startStr = dateToInputValue(row.startDate);
  const nextPayStr = dateToInputValue(row.nextPaymentDate);
  const map: PaidMonthsMap = parsePaidMonths(row.paidMonths, startStr, nextPayStr, row.amount);

  const todayStr = todayInputValue();
  const paidAtStr = options?.paidAt || todayStr;
  const paidDate = parseDateInput(paidAtStr) ?? parseDateInput(todayStr)!;
  const amountPerMonth = round2(options?.amountPerMonth ?? row.amount);
  const payMethod = normalizeInternetPaymentMethod(options?.method);
  const syncToCashbox = options?.syncToCashbox !== false;

  const [ny, nm] = nextPayStr.split("-").map(Number);
  let cy = ny;
  let cm = nm;
  let paidSoFar = 0;
  const keysToPay: string[] = [];

  while (paidSoFar < count && cy <= new Date().getFullYear() + 4) {
    const key = `${cy}-${String(cm).padStart(2, "0")}`;
    if (map[key]?.status !== "paid") {
      keysToPay.push(key);
      paidSoFar++;
    }
    cm++;
    if (cm > 12) {
      cm = 1;
      cy++;
    }
  }

  const generatedReceipts: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < keysToPay.length; i++) {
      const key = keysToPay[i];
      let cashboxTransactionId: string | undefined = undefined;
      const receiptNumber = await getNextInternetReceiptNumber(tx);
      generatedReceipts.push(receiptNumber);

      if (syncToCashbox && amountPerMonth > 0) {
        const monthLabel = formatMonthKeyLabel(key);
        const description = buildCashboxDescription(
          row.clientName,
          `${monthLabel} (Adelanto)`,
          row.clientCode
        );
        const noteDetail = options?.note
          ? `${options.note} (${i + 1}/${keysToPay.length} meses) · Recibo #${receiptNumber}`
          : `Adelanto (${i + 1}/${keysToPay.length} meses) · Recibo #${receiptNumber}`;
        const notes = buildCashboxNotes(row, noteDetail);

        const cashboxTx = await tx.cashboxTransaction.create({
          data: {
            date: paidDate,
            type: "INCOME",
            amount: amountPerMonth,
            paymentMethod: payMethod,
            description,
            notes,
          },
        });
        cashboxTransactionId = cashboxTx.id;
      }

      map[key] = {
        status: "paid",
        paidAt: paidAtStr,
        amount: amountPerMonth,
        method: payMethod,
        note: options?.note || `Adelanto (${i + 1}/${keysToPay.length} meses)`,
        receiptNumber,
        ...(cashboxTransactionId ? { cashboxTransactionId } : {}),
      };
    }

    const newNextPaymentDateStr = calculateNextPaymentDate(startStr, nextPayStr, map);
    const newNextPayDate = parseDateInput(newNextPaymentDateStr);

    await tx.internetClient.update({
      where: { id },
      data: {
        paidMonths: JSON.stringify(map),
        ...(newNextPayDate ? { nextPaymentDate: newNextPayDate } : {}),
      },
    });
  });

  const finalNextPaymentDateStr = calculateNextPaymentDate(startStr, nextPayStr, map);
  revalidateAllRelatedPaths();
  return { ok: true, countPaid: paidSoFar, newNextPaymentDate: finalNextPaymentDateStr, receiptNumbers: generatedReceipts };
}

/**
 * Actualiza los detalles específicos de un mes (monto especial, método de pago, nota, recibo).
 * Si ya tenía movimiento en Caja, lo actualiza atómicamente; si se desmarca, lo envía a papelera.
 */
export async function updateInternetMonthDetails(
  id: string,
  yearMonth: string,
  details: {
    status: "paid" | "unpaid";
    amount: number;
    method?: string;
    note?: string;
    paidAt?: string;
    receiptNumber?: string;
    syncToCashbox?: boolean;
  }
): Promise<{ ok: boolean; newNextPaymentDate?: string; receiptNumber?: string; error?: string }> {
  const row = await prisma.internetClient.findUnique({ where: { id } });
  if (!row) return { ok: false, error: "Cliente no encontrado." };

  const startStr = dateToInputValue(row.startDate);
  const nextPayStr = dateToInputValue(row.nextPaymentDate);
  const map: PaidMonthsMap = parsePaidMonths(row.paidMonths, startStr, nextPayStr, row.amount);
  const existingTxId = map[yearMonth]?.cashboxTransactionId;
  const payAmount = round2(details.amount);
  const payMethod = normalizeInternetPaymentMethod(details.method);
  const todayStr = todayInputValue();
  const paidAtStr = details.paidAt || map[yearMonth]?.paidAt || todayStr;
  const paidDate = parseDateInput(paidAtStr) ?? parseDateInput(todayStr)!;
  const syncToCashbox = details.syncToCashbox !== false;

  let assignedReceiptNumber: string | undefined = undefined;

  await prisma.$transaction(async (tx) => {
    let finalTxId = existingTxId;

    if (details.status === "unpaid") {
      if (existingTxId) {
        await tx.cashboxTransaction.updateMany({
          where: { id: existingTxId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        finalTxId = undefined;
      }
      map[yearMonth] = {
        status: "unpaid",
      };
    } else {
      assignedReceiptNumber = details.receiptNumber?.trim()
        ? details.receiptNumber.trim().replace(/\D/g, "").slice(-6).padStart(6, "0")
        : map[yearMonth]?.receiptNumber || (await getNextInternetReceiptNumber(tx));

      if (existingTxId) {
        // Actualizar el movimiento existente en Caja
        await tx.cashboxTransaction.updateMany({
          where: { id: existingTxId, deletedAt: null },
          data: {
            amount: payAmount,
            paymentMethod: payMethod,
            date: paidDate,
            notes: buildCashboxNotes(row, details.note ? `${details.note} · Recibo #${assignedReceiptNumber}` : `Recibo #${assignedReceiptNumber}`),
          },
        });
      } else if (syncToCashbox && payAmount > 0) {
        // Crear nuevo movimiento si no tenía
        const monthLabel = formatMonthKeyLabel(yearMonth);
        const description = buildCashboxDescription(row.clientName, monthLabel, row.clientCode);
        const notes = buildCashboxNotes(row, details.note ? `${details.note} · Recibo #${assignedReceiptNumber}` : `Recibo #${assignedReceiptNumber}`);

        const cashboxTx = await tx.cashboxTransaction.create({
          data: {
            date: paidDate,
            type: "INCOME",
            amount: payAmount,
            paymentMethod: payMethod,
            description,
            notes,
          },
        });
        finalTxId = cashboxTx.id;
      }

      map[yearMonth] = {
        status: "paid",
        amount: payAmount,
        method: payMethod,
        note: details.note,
        paidAt: paidAtStr,
        receiptNumber: assignedReceiptNumber,
        ...(finalTxId ? { cashboxTransactionId: finalTxId } : {}),
      };
    }

    const newNextPaymentDateStr = calculateNextPaymentDate(startStr, nextPayStr, map);
    const newNextPayDate = parseDateInput(newNextPaymentDateStr);

    await tx.internetClient.update({
      where: { id },
      data: {
        paidMonths: JSON.stringify(map),
        ...(newNextPayDate ? { nextPaymentDate: newNextPayDate } : {}),
      },
    });
  });

  const finalNextPaymentDateStr = calculateNextPaymentDate(startStr, nextPayStr, map);
  revalidateAllRelatedPaths();
  return { ok: true, newNextPaymentDate: finalNextPaymentDateStr, receiptNumber: assignedReceiptNumber };
}
