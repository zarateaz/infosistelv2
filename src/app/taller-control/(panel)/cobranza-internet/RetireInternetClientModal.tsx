"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Building2, Router, UserMinus, X } from "lucide-react";
import { todayInputValue } from "../caja/month";
import {
  RETIRE_REASONS,
  formatMonthKeyLabel,
  getUnpaidMonthKeys,
  normalizeClientPayments,
  type InternetClientRow,
} from "./cobranza";
import { retireInternetClient } from "./internetActions";

function fmt(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Retirar (dar de baja) a un cliente de internet: se elige la fecha, el motivo y
 * qué meses impagos quedan como deuda (por defecto todos hasta el mes del retiro).
 */
export function RetireInternetClientModal({
  client,
  onClose,
}: {
  client: InternetClientRow;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [retiredAt, setRetiredAt] = useState<string>(todayInputValue());
  const [reasonPreset, setReasonPreset] = useState<string>(RETIRE_REASONS[0]);
  const [reasonOther, setReasonOther] = useState<string>("");
  // Meses que el usuario DESMARCÓ (no se cobran). Lo demás queda como deuda.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPending, onClose]);

  // Meses impagos desde el inicio hasta el mes del retiro (inclusive).
  const candidates = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(retiredAt)) return [];
    const [y, m] = retiredAt.split("-").map(Number);
    const { map } = normalizeClientPayments(client);
    return getUnpaidMonthKeys(map, client.startDate, new Date(y, m - 1, 15));
  }, [client, retiredAt]);

  const debtMonths = candidates.filter((k) => !excluded.has(k));
  const debtTotal = Math.round(debtMonths.length * (client.amount || 0) * 100) / 100;
  const reason = reasonPreset === "__otro" ? reasonOther.trim() : reasonPreset;
  const dateInvalid = !/^\d{4}-\d{2}-\d{2}$/.test(retiredAt) || retiredAt < client.startDate;

  const toggle = (k: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const submit = () => {
    if (dateInvalid) {
      setError("La fecha de retiro no puede ser anterior al inicio del servicio.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await retireInternetClient(client.id, { retiredAt, reason, debtMonths });
      if (!res.ok) {
        setError(res.error || "No se pudo retirar al cliente.");
        return;
      }
      onClose();
    });
  };

  // Solo se abre tras un clic (nunca en el render del servidor): document existe.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
        onClick={() => !isPending && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="retire-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
              <UserMinus size={22} />
            </span>
            <div>
              <h3 id="retire-title" className="font-display text-lg font-black text-slate-900 dark:text-white">
                Retirar cliente
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pasa a la lista de retirados, se libera su puerto y deja de recibir avisos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Cerrar"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-6 pt-4">
          {/* Ficha del cliente */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex flex-wrap items-center gap-2">
              {client.clientCode && (
                <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-black text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {client.clientCode}
                </span>
              )}
              <span className="font-bold text-slate-900 dark:text-white">{client.clientName}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
              {client.galeria && (
                <span className="inline-flex items-center gap-1">
                  <Building2 size={12} /> {client.galeria}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Router size={12} />
                {client.router || "Sin router"}
                {client.portNumber ? ` · Puerto ${client.portNumber}` : ""}
                {client.router && client.portNumber ? (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">(quedará libre)</span>
                ) : null}
              </span>
              <span>Inicio: {fmt(client.startDate)}</span>
              <span>S/. {client.amount.toFixed(2)} / mes</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Fecha de retiro *</span>
              <input
                type="date"
                value={retiredAt}
                min={client.startDate}
                onChange={(e) => {
                  setRetiredAt(e.target.value);
                  setExcluded(new Set());
                }}
                className="admin-field mt-1.5 w-full rounded-xl px-3 py-2 text-sm text-fg"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Motivo</span>
              <select
                value={reasonPreset}
                onChange={(e) => setReasonPreset(e.target.value)}
                className="admin-field mt-1.5 w-full cursor-pointer rounded-xl px-3 py-2 text-sm text-fg"
              >
                {RETIRE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="__otro">Otro (escribir)…</option>
              </select>
            </label>
          </div>
          {reasonPreset === "__otro" && (
            <input
              value={reasonOther}
              onChange={(e) => setReasonOther(e.target.value)}
              maxLength={200}
              placeholder="Escribe el motivo del retiro"
              className="admin-field w-full rounded-xl px-3 py-2 text-sm text-fg"
              autoFocus
            />
          )}

          {/* Deuda pendiente */}
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Deuda pendiente</span>
              <span className="text-[11px] text-slate-500">Desmarca los meses que no le vas a cobrar</span>
            </div>
            {candidates.length === 0 ? (
              <p className="mt-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Se va sin deuda: tiene todos sus meses pagados hasta el retiro. ✓
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {candidates.map((k) => {
                  const on = !excluded.has(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggle(k)}
                      aria-pressed={on}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                        on
                          ? "border-red-500 bg-red-600 text-white"
                          : "border-slate-300 bg-white text-slate-400 line-through dark:border-slate-600 dark:bg-slate-800"
                      }`}
                    >
                      {formatMonthKeyLabel(k)}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-300">
                Queda debiendo {debtMonths.length} mes{debtMonths.length === 1 ? "" : "es"}
              </span>
              <span
                className={`font-display text-lg font-black tabular-nums ${
                  debtTotal > 0 ? "text-red-600" : "text-emerald-600"
                }`}
              >
                S/. {debtTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || dateInvalid}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50"
          >
            <UserMinus size={15} />
            {isPending ? "Retirando..." : "Retirar cliente"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
