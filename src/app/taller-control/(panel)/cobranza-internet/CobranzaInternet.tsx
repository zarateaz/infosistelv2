"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { BellRing, MessageCircle, Wifi, X, Check, Trash2 } from "lucide-react";
import { createInternetClient, markInternetPaid, deleteInternetClient, type InternetFormState } from "./internetActions";
import { cobranzaState, daysUntil, whatsappLink, type InternetClientRow } from "./cobranza";

const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";
const inputClass = "admin-field mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm text-fg";
const initialState: InternetFormState = {};

function fmt(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function dayText(days: number) {
  if (days < 0) return `venció hace ${-days} día${days === -1 ? "" : "s"}`;
  if (days === 0) return "vence HOY";
  if (days === 1) return "vence mañana";
  return `vence en ${days} días`;
}

export function CobranzaInternet({ clients }: { clients: InternetClientRow[] }) {
  const [state, formAction, isPending] = useActionState(createInternetClient, initialState);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [visible, setVisible] = useState(0);
  // `today` se fija tras montar para no desfasar hidratación (servidor en UTC, navegador en Lima).
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date());
  }, []);

  useEffect(() => {
    if (!state.error && !isPending) formRef.current?.reset();
  }, [state, isPending]);

  const rows = today
    ? clients.map((c) => {
        const days = daysUntil(c.nextPaymentDate, today);
        return { c, days, st: cobranzaState(days) };
      })
    : [];
  const alerts = rows.filter((r) => r.st !== "ok");
  const toasts = alerts.filter((r) => !dismissed.includes(`${r.c.id}:${r.c.nextPaymentDate}`));

  // Entrada escalonada de las notificaciones, como un feed de YouTube/TikTok.
  const toastCount = toasts.length;
  useEffect(() => {
    if (visible >= toastCount) return;
    const t = setTimeout(() => setVisible((v) => v + 1), 450);
    return () => clearTimeout(t);
  }, [visible, toastCount]);

  const dismiss = (r: (typeof rows)[number]) => setDismissed((d) => [...d, `${r.c.id}:${r.c.nextPaymentDate}`]);

  return (
    <section id="cobranza-internet" className="print:hidden mt-10 scroll-mt-6">
      {/* Notificaciones flotantes rojas */}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.slice(0, Math.min(visible, 5)).map((r) => (
          <div
            key={r.c.id}
            role="alert"
            className="cobranza-toast pointer-events-auto flex items-start gap-3 rounded-2xl border border-red-400/50 bg-red-600 p-3.5 text-white shadow-2xl shadow-red-900/30"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
              <BellRing size={18} className="animate-pulse" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{r.c.clientName}</p>
              <p className="text-xs text-white/90">
                {r.st === "vencido" ? "Ya se venció su fecha de pago" : "Se acerca su fecha de pago"} · {dayText(r.days)}
              </p>
              <a
                href={whatsappLink(r.c, r.days)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50"
              >
                <MessageCircle size={13} /> Cobrar por WhatsApp
              </a>
            </div>
            <button
              type="button"
              aria-label="Cerrar notificación"
              onClick={() => dismiss(r)}
              className="rounded-full p-1 text-white/80 hover:bg-white/20 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="admin-glass rounded-[var(--radius-lg)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
            <Wifi size={20} className="text-accent" /> Cobranza de internet
          </h2>
          {alerts.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
              <BellRing size={13} /> {alerts.length} por cobrar
            </span>
          )}
        </div>

        <form ref={formRef} action={formAction} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className={labelClass} htmlFor="ic-name">Cliente</label>
            <input id="ic-name" name="clientName" required maxLength={150} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="ic-wa">WhatsApp</label>
            <input id="ic-wa" name="whatsapp" type="tel" required placeholder="964 648 202" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="ic-start">Fecha de inicio</label>
            <input id="ic-start" name="startDate" type="date" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="ic-pay">Fecha de pago</label>
            <input id="ic-pay" name="nextPaymentDate" type="date" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="ic-amount">Monto (S/.) — opcional</label>
            <input id="ic-amount" name="amount" type="number" min={0} step={0.01} className={inputClass} />
          </div>
          {state.error && <p className="text-sm font-medium text-red-600 sm:col-span-2 lg:col-span-5">{state.error}</p>}
          <div className="sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto sm:px-8"
            >
              {isPending ? "Guardando..." : "Agregar cliente"}
            </button>
          </div>
        </form>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="admin-thead text-xs font-bold uppercase tracking-wider text-fg-muted">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Inicio</th>
                <th className="px-4 py-3">Próximo pago</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, days, st }) => (
                <tr key={c.id} className={st === "ok" ? "" : "bg-red-500/10"}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-fg">{c.clientName}</p>
                    <p className="text-xs text-fg-muted">
                      +{c.whatsapp}
                      {c.amount > 0 ? ` · S/. ${c.amount.toFixed(2)}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{fmt(c.startDate)}</td>
                  <td className="px-4 py-3 font-medium text-fg">{fmt(c.nextPaymentDate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        st === "ok"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-red-600 text-white"
                      }`}
                    >
                      {st === "ok" ? `Al día · ${days} d` : dayText(days)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <a
                        href={whatsappLink(c, days)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Enviar WhatsApp"
                        className="rounded-full p-2 text-emerald-600 hover:bg-emerald-500/10"
                      >
                        <MessageCircle size={16} />
                      </a>
                      <button
                        type="button"
                        title="Marcar como pagado (+1 mes)"
                        onClick={() => startTransition(() => markInternetPaid(c.id))}
                        className="rounded-full p-2 text-accent hover:bg-accent/10"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        title="Eliminar cliente"
                        onClick={() => {
                          if (confirm(`¿Eliminar a ${c.clientName}?`)) startTransition(() => deleteInternetClient(c.id));
                        }}
                        className="rounded-full p-2 text-red-600 hover:bg-red-500/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-fg-muted">
                    Aún no hay clientes de internet registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
