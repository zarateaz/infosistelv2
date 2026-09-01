"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { updateTransaction, deleteTransaction, type AdminTransaction } from "./actions";
import { PAYMENT_METHODS } from "./constants";

function formatDate(date: Date): string {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function money(n: number): string {
  return n === 0 ? "" : `S/. ${n.toFixed(2)}`;
}

const cellInputClass =
  "w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-xs outline-none focus:border-accent focus:bg-bg";

/** Same edit-on-blur / delete pattern as TransactionRow.tsx (the all-time
 *  table below), adapted to the report's wider per-method columns —
 *  description and amount are editable, the payment method is a select
 *  (like TransactionRow), and type (Ingreso/Gasto) is fixed once created,
 *  same restriction TransactionRow already has: converting an income into
 *  an expense in place is unusual enough that delete-and-recreate is
 *  clearer than a confusing "which of the 8 columns did I just edit" UI. */
export function MonthlyReportRow({
  transaction,
  running,
}: {
  transaction: AdminTransaction;
  running: number;
}) {
  const [description, setDescription] = useState(transaction.description);
  const [amount, setAmount] = useState(transaction.amount);
  const [method, setMethod] = useState(transaction.paymentMethod);
  const [isPending, startTransition] = useTransition();

  const isIncome = transaction.type === "INCOME";

  const saveField = (patch: Parameters<typeof updateTransaction>[1]) => {
    startTransition(() => {
      updateTransaction(transaction.id, patch);
    });
  };

  const remove = () => {
    if (!confirm(`¿Eliminar el movimiento "${transaction.description}"?`)) return;
    startTransition(() => deleteTransaction(transaction.id));
  };

  return (
    <tr className="border-b border-border/50">
      <td className="whitespace-nowrap px-2 py-1.5">{formatDate(transaction.date)}</td>
      <td className="px-2 py-1.5">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== transaction.description && saveField({ description })}
          disabled={isPending}
          className={`${cellInputClass} min-w-[140px] font-medium text-fg`}
        />
      </td>
      <td className="px-2 py-1.5 text-right font-semibold text-accent">{isIncome ? money(amount) : ""}</td>
      <td className="px-2 py-1.5 text-right">{isIncome && method === "YAPE 1" ? money(amount) : ""}</td>
      <td className="px-2 py-1.5 text-right">{isIncome && method === "YAPE 2" ? money(amount) : ""}</td>
      <td className="px-2 py-1.5 text-right">{isIncome && method === "EFECTIVO" ? money(amount) : ""}</td>
      <td className="px-2 py-1.5 text-right font-semibold text-red-600">{!isIncome ? money(amount) : ""}</td>
      <td className="px-2 py-1.5 text-right">{!isIncome && method === "YAPE 1" ? money(amount) : ""}</td>
      <td className="px-2 py-1.5 text-right">{!isIncome && method === "YAPE 2" ? money(amount) : ""}</td>
      <td className="px-2 py-1.5 text-right">{!isIncome && method === "EFECTIVO" ? money(amount) : ""}</td>
      <td className="px-2 py-1.5 text-right font-bold text-fg">{money(running)}</td>
      <td className="px-2 py-1.5 text-fg-muted">{transaction.notes ?? ""}</td>
      <td className="print:hidden px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              saveField({ paymentMethod: e.target.value as (typeof PAYMENT_METHODS)[number] });
            }}
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
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            onBlur={() => amount !== transaction.amount && saveField({ amount })}
            disabled={isPending}
            className={`${cellInputClass} w-16 border-border text-right`}
          />
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
    </tr>
  );
}
