"use client";

import { useState, useTransition } from "react";
import { Trash2, CircleCheck } from "lucide-react";
import { registerCollection, registerPayment, deleteReceivable, deletePayable, type AccountRow as Row } from "./actions";
import { PAYMENT_METHODS, STATUS_STYLES } from "./constants";

const fmtDate = (d: Date) => new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" });
const fmtMoney = (n: number) => `S/. ${n.toFixed(2)}`;

export function AccountRow({ row, kind }: { row: Row; kind: "cobrar" | "pagar" }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(row.saldo > 0 ? row.saldo : 0);
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [isPending, startTransition] = useTransition();

  const settle = () => {
    if (amount <= 0) return;
    startTransition(async () => {
      const registerFn = kind === "cobrar" ? registerCollection : registerPayment;
      await registerFn(row.id, { amount, paymentMethod: method as (typeof PAYMENT_METHODS)[number] });
      setOpen(false);
    });
  };

  const remove = () => {
    if (!confirm(`¿Eliminar la cuenta de "${row.party}"?`)) return;
    startTransition(() => (kind === "cobrar" ? deleteReceivable(row.id) : deletePayable(row.id)));
  };

  return (
    <>
      <tr className="border-b border-border last:border-0 align-top">
        <td className="px-4 py-2.5 text-fg-muted">{fmtDate(row.issueDate)}</td>
        <td className="px-4 py-2.5">
          <p className="font-semibold text-fg">{row.party}</p>
          {row.ruc && <p className="text-[11px] text-fg-muted">RUC {row.ruc}</p>}
        </td>
        <td className="px-4 py-2.5 text-fg-muted">
          {row.documentType ?? "—"}
          <p className="max-w-[220px] truncate text-[11px] text-fg-muted/80" title={row.concept}>
            {row.concept}
          </p>
        </td>
        <td className="px-4 py-2.5 font-semibold text-fg">{fmtMoney(row.total)}</td>
        <td className="px-4 py-2.5 font-bold">
          <span className={row.saldo > 0 ? "text-fg" : "text-accent"}>{fmtMoney(row.saldo)}</span>
        </td>
        <td className="px-4 py-2.5 text-fg-muted">{fmtDate(row.dueDate)}</td>
        <td className="px-4 py-2.5">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[row.status]}`}>
            {row.status}
            {row.status === "VENCIDO" && ` · ${row.overdueDays}d`}
          </span>
        </td>
        <td className="px-4 py-2.5 text-fg-muted">{row.paymentMethod ?? "—"}</td>
        <td className="px-4 py-2.5 text-right">
          <div className="flex items-center justify-end gap-1">
            {row.saldo > 0 && (
              <button
                onClick={() => setOpen((v) => !v)}
                disabled={isPending}
                aria-label={`Registrar ${kind === "cobrar" ? "cobro" : "pago"} de ${row.party}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-40"
              >
                <CircleCheck size={15} />
              </button>
            )}
            <button
              onClick={remove}
              disabled={isPending}
              aria-label={`Eliminar ${row.party}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border bg-bg-raised/50">
          <td colSpan={9} className="px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                  Monto {kind === "cobrar" ? "cobrado" : "pagado"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  max={row.saldo}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="mt-1 block w-32 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">Medio</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="mt-1 block rounded-lg border border-border bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={settle}
                disabled={isPending || amount <= 0}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? "Guardando..." : "Confirmar"}
              </button>
              <button onClick={() => setOpen(false)} className="text-xs font-semibold text-fg-muted hover:text-fg">
                Cancelar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
