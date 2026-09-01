"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHODS } from "./constants";
import { monthKey } from "./month";

export interface AdminTransaction {
  id: string;
  date: Date;
  description: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  paymentMethod: string;
  notes: string | null;
}

export async function getCashboxTransactions(): Promise<AdminTransaction[]> {
  const rows = await prisma.cashboxTransaction.findMany({ orderBy: { date: "asc" } });
  return rows as AdminTransaction[];
}

function monthRange(month: string): { start: Date; end: Date } {
  const [year, monthNum] = month.split("-").map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 1); // first day of the NEXT month, exclusive upper bound
  return { start, end };
}

export async function getCashboxTransactionsForMonth(month: string): Promise<AdminTransaction[]> {
  const { start, end } = monthRange(month);
  const rows = await prisma.cashboxTransaction.findMany({
    where: { date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
  });
  return rows as AdminTransaction[];
}

export interface AdminCashboxPeriod {
  month: string;
  responsible: string;
}

export async function getCashboxPeriod(month: string): Promise<AdminCashboxPeriod | null> {
  const row = await prisma.cashboxPeriod.findUnique({ where: { month } });
  return row ? { month: row.month, responsible: row.responsible } : null;
}

/** Every month that has at least one transaction OR an explicit period
 *  row — lets the report page offer a "previous months" selector without
 *  needing the admin to remember which months actually have data. */
export async function listCashboxMonths(): Promise<string[]> {
  const [txDates, periods] = await Promise.all([
    prisma.cashboxTransaction.findMany({ select: { date: true } }),
    prisma.cashboxPeriod.findMany({ select: { month: true } }),
  ]);
  const months = new Set<string>([
    ...txDates.map((t) => monthKey(t.date)),
    ...periods.map((p) => p.month),
    monthKey(), // always include the current month, even with zero data yet
  ]);
  return [...months].sort().reverse();
}

const periodSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Mes inválido."),
  responsible: z.string().trim().min(1, "El responsable es obligatorio.").max(120),
});

export async function setCashboxPeriodResponsible(
  month: string,
  responsible: string
): Promise<{ error?: string }> {
  const parsed = periodSchema.safeParse({ month, responsible });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  await prisma.cashboxPeriod.upsert({
    where: { month: parsed.data.month },
    update: { responsible: parsed.data.responsible },
    create: { month: parsed.data.month, responsible: parsed.data.responsible },
  });
  revalidatePath("/taller-control/caja");
  return {};
}

export interface TransactionFormState {
  error?: string;
}

const transactionSchema = z.object({
  description: z.string().trim().min(1, "La descripción es obligatoria").max(200),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => (v ? v : null)),
});

export async function createTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const parsed = transactionSchema.safeParse({
    description: formData.get("description"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  await prisma.cashboxTransaction.create({ data: parsed.data });
  revalidatePath("/taller-control/caja");
  return {};
}

const updateSchema = z.object({
  description: z.string().trim().min(1).max(200).optional(),
  amount: z.coerce.number().positive().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function updateTransaction(
  id: string,
  patch: z.infer<typeof updateSchema>
): Promise<{ error?: string }> {
  const parsed = updateSchema.safeParse(patch);
  if (!parsed.success) return { error: "Valor inválido." };

  await prisma.cashboxTransaction.update({ where: { id }, data: parsed.data });
  revalidatePath("/taller-control/caja");
  return {};
}

export async function deleteTransaction(id: string): Promise<void> {
  await prisma.cashboxTransaction.delete({ where: { id } });
  revalidatePath("/taller-control/caja");
}
