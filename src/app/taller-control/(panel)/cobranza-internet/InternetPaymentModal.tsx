"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Check,
  CheckCircle2,
  DollarSign,
  Calendar,
  Building2,
  Router,
  Smartphone,
  Banknote,
  StickyNote,
  AlertCircle,
  Zap,
  ArrowRight,
} from "lucide-react";
import { PAYMENT_METHODS, PAYMENT_METHOD_INFO, type PaymentMethodType } from "@/lib/paymentMethods";
import { todayInputValue } from "../caja/month";
import { round2 } from "@/lib/money";
import type { InternetClientRow } from "./cobranza";

export interface InternetPaymentModalProps {
  isOpen: boolean;
  client: InternetClientRow;
  monthKey?: string; // ej: "2026-05"
  monthLabel?: string; // ej: "Mayo 2026"
  isAdvance?: boolean;
  advanceCount?: number;
  initialAmount?: number;
  initialMethod?: PaymentMethodType;
  onClose: () => void;
  onConfirm: (payment: {
    amount: number;
    method: PaymentMethodType;
    paidAt: string;
    note?: string;
    syncToCashbox: boolean;
  }) => Promise<void> | void;
}

export function InternetPaymentModal({
  isOpen,
  client,
  monthKey,
  monthLabel,
  isAdvance = false,
  advanceCount = 1,
  initialAmount,
  initialMethod = "YAPE 1",
  onClose,
  onConfirm,
}: InternetPaymentModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaultTotal = isAdvance
    ? (initialAmount ?? client.amount) * advanceCount
    : (initialAmount ?? client.amount);

  const [amount, setAmount] = useState<number | string>(defaultTotal > 0 ? defaultTotal : "");
  const [method, setMethod] = useState<PaymentMethodType>(initialMethod);
  const [paidAt, setPaidAt] = useState<string>(todayInputValue());
  const [note, setNote] = useState<string>("");
  const [syncToCashbox, setSyncToCashbox] = useState<boolean>(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const calcTotal = isAdvance
        ? (initialAmount ?? client.amount) * advanceCount
        : (initialAmount ?? client.amount);
      setAmount(calcTotal > 0 ? calcTotal : "");
      setMethod(initialMethod);
      setPaidAt(todayInputValue());
      setNote("");
      setSyncToCashbox(true);
      setError(null);
    }
  }, [isOpen, client, isAdvance, advanceCount, initialAmount, initialMethod]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isPending) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!mounted || !isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await onConfirm({
          amount: round2(numAmount),
          method,
          paidAt: paidAt || todayInputValue(),
          note: note.trim() || undefined,
          syncToCashbox,
        });
        onClose();
      } catch (err: any) {
        setError(err?.message || "Ocurrió un error al registrar el pago.");
      }
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={() => !isPending && onClose()}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2 size={22} />
            </span>
            <div>
              <h3 className="font-display text-lg font-black text-slate-900 dark:text-white">
                {isAdvance ? `Confirmar Adelanto (${advanceCount} Meses)` : "Confirmar Pago de Internet"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Registra el pago del servicio y sincronízalo automáticamente con Caja.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tarjeta resumen del Cliente */}
        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-800/40">
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cliente</span>
              <h4 className="truncate font-display text-base font-bold text-slate-900 dark:text-white">
                {client.clientName}
              </h4>
            </div>
            {client.clientCode && (
              <span className="shrink-0 rounded-lg bg-indigo-500/10 px-2 py-0.5 text-xs font-mono font-black text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                {client.clientCode}
              </span>
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            {client.galeria && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 shadow-2xs dark:bg-slate-800">
                <Building2 size={12} className="text-slate-400" />
                <span className="font-semibold">{client.galeria}</span>
              </span>
            )}
            {client.router && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 shadow-2xs dark:bg-slate-800">
                <Router size={12} className="text-blue-500" />
                <span className="font-semibold">
                  {client.router}
                  {client.portNumber ? ` · Puerto ${client.portNumber}` : ""}
                </span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 font-bold text-emerald-800 dark:text-emerald-300">
              <Calendar size={12} />
              {monthLabel ? `Mes: ${monthLabel}` : `Próximo: ${client.nextPaymentDate}`}
            </span>
          </div>
        </div>

        {/* Formulario de Pago */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Selección de Método de Pago (EFECTIVO, YAPE 1, YAPE 2) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Método de Pago (Caja) *
            </label>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PAYMENT_METHODS.map((m) => {
                const info = PAYMENT_METHOD_INFO[m];
                const active = method === m;
                const isYape = m === "YAPE 1" || m === "YAPE 2";

                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`relative flex flex-col items-start rounded-2xl border p-3 text-left transition-all ${
                      active
                        ? "border-emerald-600 bg-emerald-500/10 text-emerald-950 ring-2 ring-emerald-500/40 dark:border-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-200"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide">
                        {isYape ? (
                          <Smartphone size={13} className="text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Banknote size={13} className="text-emerald-600 dark:text-emerald-400" />
                        )}
                        {info.id}
                      </span>
                      {active && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <span className="mt-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">
                      {info.titular}
                    </span>
                    {info.formattedPhone && (
                      <span className="mt-0.5 text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500">
                        {info.formattedPhone}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fila: Monto y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="pay-amount-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Monto cobrado (S/.) *
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-bold text-slate-400">
                  S/.
                </span>
                <input
                  id="pay-amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-base font-black text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                  placeholder="30.00"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="pay-date-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Fecha de pago *
              </label>
              <input
                id="pay-date-input"
                type="date"
                required
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Nota / N° de operación */}
          <div>
            <label
              htmlFor="pay-note-input"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              N° de Operación / Nota (opcional)
            </label>
            <input
              id="pay-note-input"
              type="text"
              maxLength={150}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Op. 483921 · Pagó puntual en efectivo"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Switch de Sincronización con Caja */}
          <label className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 cursor-pointer hover:bg-emerald-500/10 transition-colors dark:bg-emerald-950/20">
            <input
              type="checkbox"
              checked={syncToCashbox}
              onChange={(e) => setSyncToCashbox(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-bold text-slate-900 dark:text-white">
                Ingresar automáticamente a Caja
              </span>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                Se creará un movimiento de <strong className="text-emerald-600 dark:text-emerald-400">INGRESO</strong> en Caja con el método <strong>{method}</strong>, nombre del cliente y mes pagado.
              </p>
            </div>
          </label>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-600 dark:text-red-400">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {isPending ? (
                <span>Registrando...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>Confirmar e Ingresar a Caja</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
