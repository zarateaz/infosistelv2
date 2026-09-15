"use client";

import { useState, useTransition } from "react";
import { Trash2, CircleCheck } from "lucide-react";
import { updateTransaction, deleteTransaction, type AdminTransaction } from "./actions";
import { PAYMENT_METHODS } from "./constants";
import { toDateInputValue, parseDateInput } from "./month";
import { ConfirmDialog } from "./ConfirmDialog";

function formatDate(date: Date): string {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function money(n: number): string {
  return n === 0 ? "" : `S/. ${n.toFixed(2)}`;
}

const cellInputClass =
  "w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-xs outline-none focus:border-accent focus:bg-bg";

interface Draft {
  description: string;
  amount: number;
  paymentMethod: string;
  date: string;
}

function draftFrom(t: AdminTransaction): Draft {
  return {
    description: t.description,
    amount: t.amount,
    paymentMethod: t.paymentMethod,
    date: toDateInputValue(new Date(t.date)),
  };
}

function isDirty(draft: Draft, t: AdminTransaction): boolean {
  return (
    draft.description !== t.description ||
    draft.amount !== t.amount ||
    draft.paymentMethod !== t.paymentMethod ||
    draft.date !== toDateInputValue(new Date(t.date))
  );
}

/** Same fields editable as TransactionRow.tsx (the all-time table above),
 *  adapted to the report's wider per-method columns — type (Ingreso/Gasto)
 *  stays fixed once created: converting an income into an expense in place
 *  is unusual enough, and would jump the amount across the ING./EGR.
 *  column groups, that delete-and-recreate is clearer here. Every other
 *  field — fecha, descripción, método, monto — is editable, and nothing
 *  saves until "Confirmar cambios" is clicked, same guard as TransactionRow. */
export function MonthlyReportRow({
  transaction,
  running,
}: {
  transaction: AdminTransaction;
  running: number;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(transaction));
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isIncome = transaction.type === "INCOME";
  const dirty = isDirty(draft, transaction);
  const dateValid = parseDateInput(draft.date) !== null;
  const descValid = draft.description.trim().length > 0 && draft.description.trim().length <= 200;
  const amountValid = Number.isFinite(draft.amount) && draft.amount > 0;
  const isValid = dateValid && descValid && amountValid;

  const applyEdit = () => {
    startTransition(async () => {
      const result = await updateTransaction(transaction.id, {
        description: draft.description.trim(),
        amount: draft.amount,
        paymentMethod: draft.paymentMethod as (typeof PAYMENT_METHODS)[number],
        date: draft.date,
      });
      setConfirming(false);
      setError(result.error ?? null);
    });
  };

  const remove = () => {
    if (!confirm(`¿Eliminar el movimiento "${transaction.description}"? Esta acción no se puede deshacer.`)) return;
    startTransition(() => deleteTransaction(transaction.id));
  };

  return (
    <>
    <tr className={`border-b border-border/50 ${dirty ? "bg-accent/5" : ""}`}>
      <td className="whitespace-nowrap px-2 py-1.5">
        <input
          type="date"
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          disabled={isPending}
          className={`${cellInputClass} ${dateValid ? "" : "border-red-400"}`}
          title={dateValid ? formatDate(transaction.date) : "Fecha inválida"}
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          disabled={isPending}
          maxLength={200}
          className={`${cellInputClass} min-w-[140px] font-medium text-fg ${descValid ? "" : "border-red-400"}`}
        />
      </td>
      <td className="px-2 py-1.5 text-right font-semibold text-accent">{isIncome ? money(draft.amount) : ""}</td>
      <td className="px-2 py-1.5 text-right">{isIncome && draft.paymentMethod === "YAPE 1" ? money(draft.amount) : ""}</td>
      <td className="px-2 py-1.5 text-right">{isIncome && draft.paymentMethod === "YAPE 2" ? money(draft.amount) : ""}</td>
      <td className="px-2 py-1.5 text-right">{isIncome && draft.paymentMethod === "EFECTIVO" ? money(draft.amount) : ""}</td>
      <td className="px-2 py-1.5 text-right font-semibold text-red-600">{!isIncome ? money(draft.amount) : ""}</td>
      <td className="px-2 py-1.5 text-right">{!isIncome && draft.paymentMethod === "YAPE 1" ? money(draft.amount) : ""}</td>
      <td className="px-2 py-1.5 text-right">{!isIncome && draft.paymentMethod === "YAPE 2" ? money(draft.amount) : ""}</td>
      <td className="px-2 py-1.5 text-right">{!isIncome && draft.paymentMethod === "EFECTIVO" ? money(draft.amount) : ""}</td>
      <td className="px-2 py-1.5 text-right font-bold text-fg">{money(running)}</td>
      <td className="px-2 py-1.5 text-fg-muted">{transaction.notes ?? ""}</td>
      <td className="print:hidden px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <select
            value={draft.paymentMethod}
            onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value })}
            disabled={isPending}
            className={`${cellInputClass} w-[92px] border-border`}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
            disabled={isPending}
            className={`${cellInputClass} w-16 border-border text-right ${amountValid ? "" : "border-red-400"}`}
          />
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={isPending || !dirty || !isValid}
            aria-label="Confirmar cambios"
            title={dirty ? "Confirmar cambios" : "Sin cambios"}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${
              dirty && isValid
                ? "animate-pulse bg-accent text-accent-fg hover:animate-none hover:bg-accent-hover"
                : "text-fg-muted"
            }`}
          >
            <CircleCheck size={14} />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            aria-label={`Eliminar ${transaction.description}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>

      {confirming && (
        <ConfirmDialog
          title="Confirmar cambios del movimiento"
          pending={isPending}
          onConfirm={applyEdit}
          onCancel={() => setConfirming(false)}
          fields={[
            { label: "Fecha", value: draft.date },
            { label: "Descripción", value: draft.description.trim() },
            { label: "Método", value: draft.paymentMethod },
            { label: "Monto", value: `S/. ${draft.amount.toFixed(2)}` },
          ]}
        />
      )}
    </tr>
    {error && (
      <tr className="border-b border-border/50">
        <td colSpan={13} className="px-2 pb-1.5 pt-0 text-[11px] font-semibold text-red-600">
          {error}
        </td>
      </tr>
    )}
    </>
  );
}
