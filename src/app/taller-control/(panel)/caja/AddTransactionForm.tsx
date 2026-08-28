"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTransaction, type TransactionFormState } from "./actions";
import { PAYMENT_METHODS } from "./constants";

const initialState: TransactionFormState = {};
const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";
const inputClass =
  "mt-1.5 w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-fg outline-none focus:border-accent";

export function AddTransactionForm() {
  const [state, formAction, isPending] = useActionState(createTransaction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.error && !isPending) formRef.current?.reset();
  }, [state, isPending]);

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-bg-alt p-6">
      <h2 className="font-display text-lg font-bold text-fg">Registrar movimiento</h2>

      <form ref={formRef} action={formAction} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className={labelClass} htmlFor="description">
            Descripción
          </label>
          <input id="description" name="description" type="text" required maxLength={200} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="type">
            Tipo
          </label>
          <select id="type" name="type" defaultValue="INCOME" className={inputClass}>
            <option value="INCOME">Ingreso</option>
            <option value="EXPENSE">Gasto</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="amount">
            Monto (S/.)
          </label>
          <input id="amount" name="amount" type="number" min={0.01} step={0.01} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="paymentMethod">
            Método
          </label>
          <select id="paymentMethod" name="paymentMethod" defaultValue={PAYMENT_METHODS[0]} className={inputClass}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {state.error && <p className="text-sm font-medium text-red-600 sm:col-span-2 lg:col-span-4">{state.error}</p>}

        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {isPending ? "Guardando..." : "Registrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
