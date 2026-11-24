"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/money";
import type { PaymentMethodType } from "@/lib/paymentMethods";
import { dateToInputValue, parseDateInput, todayInputValue } from "../caja/month";
import {
  calculateNextPaymentDate,
  effectiveNextPaymentDate,
  formatMonthKeyLabel,
  normalizeClientPayments,
  normalizeInternetPaymentMethod,
  parsePaidMonths,
  type InternetClientRow,
  type PaidMonthsMap,
} from "./cobranza";
import { sendInternetPaymentThankYou } from "@/lib/whatsappAutoNotifier";

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

const STALE_MSG =
  "Este cliente se acaba de actualizar desde otra pantalla o por un aviso automático. Recarga la página e inténtalo de nuevo.";

class StaleClientError extends Error {}

/**
 * Escritura atómica (compare-and-swap): solo guarda si el historial de meses sigue
 * siendo el que se leyó. Evita que dos pestañas/usuarios (o el aviso automático de
 * WhatsApp) se pisen y borren un pago en silencio. Si cambió, se revierte todo
 * (incluido el ingreso a Caja) y se pide recargar.
 */
async function casUpdateClient(
  tx: Pick<typeof prisma, "internetClient">,
  id: string,
  expectedPaidMonths: string | null,
  data: Record<string, unknown>
): Promise<void> {
  const res = await tx.internetClient.updateMany({ where: { id, paidMonths: expectedPaidMonths }, data });
  if (res.count !== 1) throw new StaleClientError(STALE_MSG);
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
  return rows
    .map((r) => {
      const startDate = dateToInputValue(r.startDate);
      const storedNext = dateToInputValue(r.nextPaymentDate);
      return {
        id: r.id,
        clientCode: r.clientCode,
        clientName: r.clientName,
        whatsapp: r.whatsapp,
        galeria: r.galeria,
        router: r.router,
        portNumber: r.portNumber,
        startDate,
        // Siempre coherente con los meses marcados (ver effectiveNextPaymentDate).
        nextPaymentDate: effectiveNextPaymentDate({
          startDate,
          nextPaymentDate: storedNext,
          paidMonths: r.paidMonths,
          amount: r.amount,
        }),
        amount: r.amount,
        concept: r.concept,
        paidMonths: r.paidMonths,
      };
    })
    .sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate));
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
  const { map, nextPaymentDate: nextPayStr } = normalizeClientPayments({
    startDate: startStr,
    nextPaymentDate: dateToInputValue(row.nextPaymentDate),
    paidMonths: row.paidMonths,
    amount: row.amount,
  });

  const [ny, nm] = nextPayStr.split("-").map(Number);
  const key = `${ny}-${String(nm).padStart(2, "0")}`;
  if (map[key]?.status === "paid") {
    // Evita doble registro (doble clic / dos pestañas): el mes ya figura pagado.
    return { ok: false, error: `El mes ${formatMonthKeyLabel(key)} ya está registrado como pagado.` };
  }
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

  try {
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

      await casUpdateClient(tx, id, row.paidMonths, {
          paidMonths: JSON.stringify(map),
          nextPaymentDate: newNextPay,
        });
    });
  } catch (e) {
    if (e instanceof StaleClientError) return { ok: false, error: e.message };
    throw e;
  }

  // Enviar automáticamente agradecimiento y confirmación oficial por WhatsApp
  sendInternetPaymentThankYou({
    clientName: row.clientName,
    clientCode: row.clientCode,
    whatsapp: row.whatsapp,
    galeria: row.galeria,
    amount: payAmount,
    monthKey: formatMonthKeyLabel(key),
    receiptNumber: finalReceiptNumber,
    nextPaymentDate: newNextPaymentDateStr,
    paymentMethod: payMethod,
  }).catch((e) => console.error("[WhatsApp] Error al enviar agradecimiento:", e));

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

/**
 * Reconcilia el historial al editar un cliente:
 *  - quita los meses anteriores a la nueva fecha de inicio,
 *  - los meses entre el inicio y la "Próxima fecha de pago" del formulario se consideran
 *    pagados (misma regla que al crear el cliente: "próximo pago" = primer mes que debe),
 *  - la próxima fecha de pago final SIEMPRE es el primer mes impago (conservando el día de corte).
 * Así corregir la fecha de inicio quita la deuda falsa al instante y nunca queda desfasado.
 */
function reconcilePaidMonthsOnEdit(
  rawPaidMonths: string | null | undefined,
  storedStartDate: string | null,
  storedNextPaymentDate: string | null,
  startDate: string,
  formNextPaymentDate: string,
  amount: number
): { paidMonths: string; nextPaymentDate: Date } {
  const source = normalizeClientPayments({
    startDate: storedStartDate ?? startDate,
    nextPaymentDate: storedNextPaymentDate ?? formNextPaymentDate,
    paidMonths: rawPaidMonths,
    amount,
  }).map;
  const startKey = startDate.slice(0, 7);
  const map: PaidMonthsMap = {};
  for (const [k, v] of Object.entries(source)) {
    if (k >= startKey) map[k] = v;
  }

  const formNextKey = formNextPaymentDate.slice(0, 7);
  let [cy, cm] = startDate.split("-").map(Number);
  for (let guard = 0; guard < 600; guard++) {
    const key = `${cy}-${String(cm).padStart(2, "0")}`;
    if (key >= formNextKey) break;
    if (map[key]?.status !== "paid") {
      map[key] = {
        status: "paid",
        paidAt: `${key}-01`,
        amount,
        note: "Registrado al inicio",
      };
    }
    cm++;
    if (cm > 12) {
      cm = 1;
      cy++;
    }
  }

  const nextStr = calculateNextPaymentDate(startDate, formNextPaymentDate, map);
  return {
    paidMonths: JSON.stringify(map),
    nextPaymentDate: parseDateInput(nextStr) ?? parseDateInput(formNextPaymentDate)!,
  };
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
  const ERR_NOT_FOUND = { error: "Cliente no encontrado." };

  const existing = await prisma.internetClient.findUnique({
    where: { id },
    select: { paidMonths: true, startDate: true, nextPaymentDate: true },
  });
  if (!existing) return ERR_NOT_FOUND;
  const reconciled = reconcilePaidMonthsOnEdit(
    existing.paidMonths,
    dateToInputValue(existing.startDate),
    dateToInputValue(existing.nextPaymentDate),
    startDate,
    dateToInputValue(nextPay),
    rest.amount
  );

  const saved = await prisma.internetClient.updateMany({
    where: { id, paidMonths: existing.paidMonths },
    data: {
      ...rest,
      startDate: start,
      nextPaymentDate: reconciled.nextPaymentDate,
      paidMonths: reconciled.paidMonths,
    },
  });
  if (saved.count !== 1) return { ...ERR_NOT_FOUND, error: STALE_MSG };
  revalidateAllRelatedPaths();
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
  const ERR_NOT_FOUND = { ok: false, error: "Cliente no encontrado." };

  const existing = await prisma.internetClient.findUnique({
    where: { id },
    select: { paidMonths: true, startDate: true, nextPaymentDate: true },
  });
  if (!existing) return ERR_NOT_FOUND;
  const reconciled = reconcilePaidMonthsOnEdit(
    existing.paidMonths,
    dateToInputValue(existing.startDate),
    dateToInputValue(existing.nextPaymentDate),
    startDate,
    dateToInputValue(nextPay),
    rest.amount
  );

  const saved = await prisma.internetClient.updateMany({
    where: { id, paidMonths: existing.paidMonths },
    data: {
      ...rest,
      startDate: start,
      nextPaymentDate: reconciled.nextPaymentDate,
      paidMonths: reconciled.paidMonths,
    },
  });
  if (saved.count !== 1) return { ...ERR_NOT_FOUND, error: STALE_MSG };
  revalidateAllRelatedPaths();
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
  const { map, nextPaymentDate: nextPayStr } = normalizeClientPayments({
    startDate: startStr,
    nextPaymentDate: dateToInputValue(row.nextPaymentDate),
    paidMonths: row.paidMonths,
    amount: row.amount,
  });

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

  try {
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

      await casUpdateClient(tx, id, row.paidMonths, {
          paidMonths: JSON.stringify(map),
          ...(newNextPayDate ? { nextPaymentDate: newNextPayDate } : {}),
        });
    });
  } catch (e) {
    if (e instanceof StaleClientError) return { ok: false, error: e.message };
    throw e;
  }

  const finalNextPaymentDateStr = calculateNextPaymentDate(startStr, nextPayStr, map);

  // Si se marcó como pagado (y antes no lo estaba), enviar el agradecimiento por WhatsApp
  if (shouldBePaid && !currentlyPaid) {
    sendInternetPaymentThankYou({
      clientName: row.clientName,
      clientCode: row.clientCode,
      whatsapp: row.whatsapp,
      galeria: row.galeria,
      amount: payAmount,
      monthKey: formatMonthKeyLabel(yearMonth),
      receiptNumber: assignedReceiptNumber,
      nextPaymentDate: finalNextPaymentDateStr,
      paymentMethod: payMethod,
    }).catch((e) => console.error("[WhatsApp] Error al enviar agradecimiento:", e));
  }

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
  const { map, nextPaymentDate: nextPayStr } = normalizeClientPayments({
    startDate: startStr,
    nextPaymentDate: dateToInputValue(row.nextPaymentDate),
    paidMonths: row.paidMonths,
    amount: row.amount,
  });

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
  const currentKey = todayStr.slice(0, 7);

  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < keysToPay.length; i++) {
        const key = keysToPay[i];
        // Solo es "adelanto" si el mes aún no llega; si es atrasado/actual es un pago normal.
        const kindLabel = key > currentKey ? "Adelanto" : "Pago";
        let cashboxTransactionId: string | undefined = undefined;
        const receiptNumber = await getNextInternetReceiptNumber(tx);
        generatedReceipts.push(receiptNumber);

        if (syncToCashbox && amountPerMonth > 0) {
          const monthLabel = formatMonthKeyLabel(key);
          const description = buildCashboxDescription(
            row.clientName,
            key > currentKey ? `${monthLabel} (Adelanto)` : monthLabel,
            row.clientCode
          );
          const noteDetail = options?.note
            ? `${options.note} (${i + 1}/${keysToPay.length} meses) · Recibo #${receiptNumber}`
            : `${kindLabel} (${i + 1}/${keysToPay.length} meses) · Recibo #${receiptNumber}`;
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
          note: options?.note || `${kindLabel} (${i + 1}/${keysToPay.length} meses)`,
          receiptNumber,
          ...(cashboxTransactionId ? { cashboxTransactionId } : {}),
        };
      }

      const newNextPaymentDateStr = calculateNextPaymentDate(startStr, nextPayStr, map);
      const newNextPayDate = parseDateInput(newNextPaymentDateStr);

      await casUpdateClient(tx, id, row.paidMonths, {
          paidMonths: JSON.stringify(map),
          ...(newNextPayDate ? { nextPaymentDate: newNextPayDate } : {}),
        });
    });
  } catch (e) {
    if (e instanceof StaleClientError) return { ok: false, error: e.message };
    throw e;
  }

  const finalNextPaymentDateStr = calculateNextPaymentDate(startStr, nextPayStr, map);

  // Si se registraron adelantos, enviar agradecimiento oficial por WhatsApp
  if (paidSoFar > 0) {
    sendInternetPaymentThankYou({
      clientName: row.clientName,
      clientCode: row.clientCode,
      whatsapp: row.whatsapp,
      galeria: row.galeria,
      amount: round2(amountPerMonth * paidSoFar),
      monthKey: `${paidSoFar} mes(es): ${keysToPay.map(formatMonthKeyLabel).join(", ")}`,
      receiptNumber: generatedReceipts[0] || undefined,
      nextPaymentDate: finalNextPaymentDateStr,
      paymentMethod: payMethod,
    }).catch((e) => console.error("[WhatsApp] Error al enviar agradecimiento:", e));
  }

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
  const { map, nextPaymentDate: nextPayStr } = normalizeClientPayments({
    startDate: startStr,
    nextPaymentDate: dateToInputValue(row.nextPaymentDate),
    paidMonths: row.paidMonths,
    amount: row.amount,
  });
  const existingTxId = map[yearMonth]?.cashboxTransactionId;
  const wasPaid = map[yearMonth]?.status === "paid";
  const payAmount = round2(details.amount);
  const payMethod = normalizeInternetPaymentMethod(details.method);
  const todayStr = todayInputValue();
  const paidAtStr = details.paidAt || map[yearMonth]?.paidAt || todayStr;
  const paidDate = parseDateInput(paidAtStr) ?? parseDateInput(todayStr)!;
  const syncToCashbox = details.syncToCashbox !== false;

  let assignedReceiptNumber: string | undefined = undefined;

  try {
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
        } else if (!wasPaid && syncToCashbox && payAmount > 0) {
          // Crear nuevo movimiento solo si el mes pasa de "no pagado" a "pagado".
          // Si ya estaba pagado sin movimiento enlazado (pago histórico registrado a mano
          // en Caja), editar sus detalles NO debe generar un ingreso duplicado.
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

      await casUpdateClient(tx, id, row.paidMonths, {
          paidMonths: JSON.stringify(map),
          ...(newNextPayDate ? { nextPaymentDate: newNextPayDate } : {}),
        });
    });
  } catch (e) {
    if (e instanceof StaleClientError) return { ok: false, error: e.message };
    throw e;
  }

  const finalNextPaymentDateStr = calculateNextPaymentDate(startStr, nextPayStr, map);

  // Solo enviar agradecimiento si el mes pasó a pagado (no al editar uno ya pagado)
  if (details.status === "paid" && !wasPaid) {
    sendInternetPaymentThankYou({
      clientName: row.clientName,
      clientCode: row.clientCode,
      whatsapp: row.whatsapp,
      galeria: row.galeria,
      amount: payAmount,
      monthKey: formatMonthKeyLabel(yearMonth),
      receiptNumber: assignedReceiptNumber,
      nextPaymentDate: finalNextPaymentDateStr,
      paymentMethod: payMethod,
    }).catch((e) => console.error("[WhatsApp] Error al enviar agradecimiento:", e));
  }

  revalidateAllRelatedPaths();
  return { ok: true, newNextPaymentDate: finalNextPaymentDateStr, receiptNumber: assignedReceiptNumber };
}

/**
 * Corrige la fecha de inicio del servicio (p. ej. se registró 2025 en vez de 2026).
 * Quita los meses impagos anteriores al nuevo inicio y recalcula la próxima fecha de pago.
 * Nunca borra pagos reales: si hay meses pagados antes de esa fecha, se rechaza.
 */
export async function correctInternetClientStartDate(
  id: string,
  newStartDate: string
): Promise<{ ok: boolean; error?: string; newNextPaymentDate?: string }> {
  const start = parseDateInput(newStartDate);
  if (!start) return { ok: false, error: "Fecha de inicio inválida." };

  const row = await prisma.internetClient.findUnique({ where: { id } });
  if (!row) return { ok: false, error: "Cliente no encontrado." };

  const startStr = dateToInputValue(start);
  const nextPayStr = dateToInputValue(row.nextPaymentDate);
  const source = normalizeClientPayments({
    startDate: dateToInputValue(row.startDate),
    nextPaymentDate: nextPayStr,
    paidMonths: row.paidMonths,
    amount: row.amount,
  }).map;
  const startKey = startStr.slice(0, 7);

  const map: PaidMonthsMap = {};
  for (const [k, v] of Object.entries(source)) {
    if (k >= startKey) map[k] = v;
    else if (v.status === "paid") {
      return {
        ok: false,
        error: `${formatMonthKeyLabel(k)} figura pagado y es anterior a la nueva fecha de inicio. Revísalo antes de corregir.`,
      };
    }
  }

  const newNextStr = calculateNextPaymentDate(startStr, nextPayStr, map);
  const newNext = parseDateInput(newNextStr) ?? row.nextPaymentDate;

  const saved = await prisma.internetClient.updateMany({
    where: { id, paidMonths: row.paidMonths },
    data: { startDate: start, nextPaymentDate: newNext, paidMonths: JSON.stringify(map) },
  });
  if (saved.count !== 1) return { ok: false, error: STALE_MSG };

  revalidateAllRelatedPaths();
  return { ok: true, newNextPaymentDate: newNextStr };
}
