"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, Pencil, Check, Calendar, AlertCircle } from "lucide-react";
import { updateInternetClientDirect } from "./internetActions";
import { cobranzaState, daysUntil, type InternetClientRow } from "./cobranza";

const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";
const inputClass = "admin-field mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm text-fg";

function cleanPhoneForInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("51")) {
    return digits.slice(2);
  }
  return digits;
}

export function EditInternetClientModal({
  client,
  onClose,
}: {
  client: InternetClientRow;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientName, setClientName] = useState(client.clientName);
  const [whatsapp, setWhatsapp] = useState(cleanPhoneForInput(client.whatsapp));
  const [startDate, setStartDate] = useState(client.startDate);
  const [nextPaymentDate, setNextPaymentDate] = useState(client.nextPaymentDate);
  const [amount, setAmount] = useState<number | string>(client.amount > 0 ? client.amount : "");

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Cálculo en vivo del estado según la fecha de pago seleccionada
  const days = daysUntil(nextPaymentDate);
  const st = cobranzaState(days);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await updateInternetClientDirect(client.id, {
        clientName: clientName.trim(),
        whatsapp: whatsapp.trim(),
        startDate,
        nextPaymentDate,
        amount: Number(amount) || 0,
      });

      if (!res.ok) {
        setError(res.error || "Ocurrió un error al guardar los cambios.");
      } else {
        onClose();
      }
    });
  };

  const advanceOneMonth = () => {
    const [y, m, d] = nextPaymentDate.split("-").map(Number);
    if (!y || !m || !d) return;
    const date = new Date(Date.UTC(y, m - 1, d));
    const nextY = date.getUTCFullYear();
    const nextM = date.getUTCMonth() + 1;
    const lastDayNext = new Date(Date.UTC(nextY, nextM + 1, 0)).getUTCDate();
    const newDate = new Date(Date.UTC(nextY, nextM, Math.min(date.getUTCDate(), lastDayNext)));
    const yStr = newDate.getUTCFullYear();
    const mStr = String(newDate.getUTCMonth() + 1).padStart(2, "0");
    const dStr = String(newDate.getUTCDate()).padStart(2, "0");
    setNextPaymentDate(`${yStr}-${mStr}-${dStr}`);
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg rounded-2xl bg-bg-surface border border-border p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-client-title"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Pencil size={18} />
            </div>
            <div>
              <h3 id="edit-client-title" className="text-base font-bold text-fg">
                Editar Cliente de Internet
              </h3>
              <p className="text-xs text-fg-muted">
                Modifica los datos del cliente, contacto o fecha de corte
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-full p-1.5 text-fg-muted hover:bg-bg-raised hover:text-fg transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className={labelClass} htmlFor="edit-name">
              Nombre del Cliente
            </label>
            <input
              id="edit-name"
              required
              maxLength={150}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className={inputClass}
              placeholder="Ej: Juan Pérez"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="edit-wa">
                WhatsApp
              </label>
              <input
                id="edit-wa"
                type="tel"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={inputClass}
                placeholder="964 648 202"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="edit-amount">
                Monto Mensual (S/.)
              </label>
              <input
                id="edit-amount"
                type="number"
                min={0}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="edit-start">
                Fecha de Inicio
              </label>
              <input
                id="edit-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className={labelClass} htmlFor="edit-pay">
                  Próxima Fecha de Pago
                </label>
                <button
                  type="button"
                  onClick={advanceOneMonth}
                  className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1"
                  title="Sumar 1 mes a la fecha actual"
                >
                  <Calendar size={11} /> +1 Mes
                </button>
              </div>
              <input
                id="edit-pay"
                type="date"
                required
                value={nextPaymentDate}
                onChange={(e) => setNextPaymentDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Vista previa de estado */}
          <div className="rounded-xl border border-border/80 bg-bg-raised/40 p-3 flex items-center justify-between text-xs">
            <span className="text-fg-muted font-medium">Estado calculado:</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                st === "ok" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-600 text-white"
              }`}
            >
              {st === "ok"
                ? `Al día · faltan ${days} días`
                : days === 0
                ? "Vence HOY"
                : days < 0
                ? `Venció hace ${-days} días`
                : `Vence en ${days} días`}
            </span>
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-fg-muted hover:bg-bg-raised hover:text-fg transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !clientName.trim() || !whatsapp.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-accent-fg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
            >
              <Check size={14} />
              {isPending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
