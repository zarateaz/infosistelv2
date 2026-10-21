"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateToInputValue, parseDateInput } from "../caja/month";
import type { InternetClientRow } from "./cobranza";

const PATH = "/taller-control/cobranza-internet";

export async function getInternetClients(): Promise<InternetClientRow[]> {
  const rows = await prisma.internetClient.findMany({ orderBy: { nextPaymentDate: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    clientName: r.clientName,
    whatsapp: r.whatsapp,
    startDate: dateToInputValue(r.startDate),
    nextPaymentDate: dateToInputValue(r.nextPaymentDate),
    amount: r.amount,
  }));
}

/** Normaliza a dígitos con código de país: 9 dígitos => antepone 51 (Perú). */
function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 9 ? `51${digits}` : digits;
}

const clientSchema = z.object({
  clientName: z.string().trim().min(1, "El nombre es obligatorio").max(150),
  whatsapp: z
    .string()
    .transform(normalizeWhatsapp)
    .refine((v) => v.length >= 9 && v.length <= 15, "WhatsApp inválido (9 dígitos, ej. 964648202)"),
  startDate: z.string().refine((v) => parseDateInput(v) !== null, "Fecha de inicio inválida"),
  nextPaymentDate: z.string().refine((v) => parseDateInput(v) !== null, "Fecha de pago inválida"),
  amount: z.coerce.number().min(0, "El monto no puede ser negativo").default(0),
});

export interface InternetFormState {
  error?: string;
}

export async function createInternetClient(
  _prev: InternetFormState,
  formData: FormData
): Promise<InternetFormState> {
  const parsed = clientSchema.safeParse({
    clientName: formData.get("clientName"),
    whatsapp: formData.get("whatsapp") ?? "",
    startDate: formData.get("startDate"),
    nextPaymentDate: formData.get("nextPaymentDate"),
    amount: formData.get("amount") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const { startDate, nextPaymentDate, ...rest } = parsed.data;
  await prisma.internetClient.create({
    data: { ...rest, startDate: parseDateInput(startDate)!, nextPaymentDate: parseDateInput(nextPaymentDate)! },
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

/** "Pagó": corre la próxima fecha de pago un mes. */
export async function markInternetPaid(id: string): Promise<void> {
  const row = await prisma.internetClient.findUnique({ where: { id } });
  if (!row) return;
  await prisma.internetClient.update({
    where: { id },
    data: { nextPaymentDate: addOneMonthUTC(row.nextPaymentDate) },
  });
  revalidatePath(PATH);
}

export async function deleteInternetClient(id: string): Promise<void> {
  await prisma.internetClient.deleteMany({ where: { id } });
  revalidatePath(PATH);
}

export async function updateInternetClient(
  _prev: InternetFormState,
  formData: FormData
): Promise<InternetFormState> {
  const id = formData.get("id")?.toString();
  if (!id) return { error: "ID de cliente no proporcionado." };

  const parsed = clientSchema.safeParse({
    clientName: formData.get("clientName"),
    whatsapp: formData.get("whatsapp") ?? "",
    startDate: formData.get("startDate"),
    nextPaymentDate: formData.get("nextPaymentDate"),
    amount: formData.get("amount") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const { startDate, nextPaymentDate, ...rest } = parsed.data;
  const start = parseDateInput(startDate);
  const nextPay = parseDateInput(nextPaymentDate);
  if (!start || !nextPay) return { error: "Fechas inválidas." };

  await prisma.internetClient.update({
    where: { id },
    data: {
      ...rest,
      startDate: start,
      nextPaymentDate: nextPay,
    },
  });
  revalidatePath(PATH);
  return {};
}

export async function updateInternetClientDirect(
  id: string,
  data: {
    clientName: string;
    whatsapp: string;
    startDate: string;
    nextPaymentDate: string;
    amount: number;
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

  await prisma.internetClient.update({
    where: { id },
    data: {
      ...rest,
      startDate: start,
      nextPaymentDate: nextPay,
    },
  });
  revalidatePath(PATH);
  return { ok: true };
}

