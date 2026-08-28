"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHODS } from "./constants";

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
