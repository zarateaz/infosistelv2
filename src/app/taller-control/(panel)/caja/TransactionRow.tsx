"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { updateTransaction, deleteTransaction, type AdminTransaction } from "./actions";
import { PAYMENT_METHODS } from "./constants";

const cellInputClass =
  "w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm outline-none focus:border-accent focus:bg-bg";

export function TransactionRow({ transaction }: { transaction: AdminTransaction }) {
  const [description, setDescription] = useState(transaction.description);
  const [amount, setAmount] = useState(transaction.amount);
  const [method, setMethod] = useState(transaction.paymentMethod);
  const [isPending, startTransition] = useTransition();

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
    <tr className="border-b border-border last:border-0">
      <td className="px-5 py-2.5 text-fg-muted">
        {new Date(transaction.date).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
      </td>
      <td className="px-5 py-2.5">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            transaction.type === "INCOME" ? "bg-accent/10 text-accent" : "bg-red-50 text-red-600"
          }`}
        >
          {transaction.type === "INCOME" ? "Ingreso" : "Gasto"}
        </span>
      </td>
      <td className="px-5 py-2.5">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== transaction.description && saveField({ description })}
          className={`${cellInputClass} font-semibold text-fg`}
        />
      </td>
      <td className="px-5 py-2.5">
        <select
          value={method}
          onChange={(e) => {
            setMethod(e.target.value);
            saveField({ paymentMethod: e.target.value as (typeof PAYMENT_METHODS)[number] });
          }}
          className={cellInputClass}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </td>
      <td className="px-5 py-2.5">
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          onBlur={() => amount !== transaction.amount && saveField({ amount })}
          className={`${cellInputClass} font-bold ${transaction.type === "INCOME" ? "text-accent" : "text-red-600"}`}
        />
      </td>
      <td className="px-5 py-2.5 text-right">
        <button
          onClick={remove}
          disabled={isPending}
          aria-label={`Eliminar ${transaction.description}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}
