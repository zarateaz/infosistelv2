"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { BellRing, MessageCircle, Wifi, X, Check, Trash2, Users, AlertTriangle } from "lucide-react";
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
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [tab, setTab] = useState<"all" | "deudores">("all");
  // `today` se fija tras montar para no desfasar hidratación (servidor en UTC, navegador en Lima).
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
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

  // Auto-desaparecer la notificación flotante luego de 3 segundos exactos
  useEffect(() => {
    if (alerts.length === 0 || dismissed) return;
    const timer = setTimeout(() => {
      setDismissed(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [alerts.length, dismissed]);

  // Si el usuario agrega un cliente nuevo o cambia el estado, reabrir toast brevemente
  const prevAlertsLength = useRef(alerts.length);
  useEffect(() => {
    if (alerts.length > prevAlertsLength.current) {
      setDismissed(false);
    }
    prevAlertsLength.current = alerts.length;
  }, [alerts.length]);

  const displayedRows = tab === "deudores" ? alerts : rows;
  const singleAlert = alerts.length === 1 ? alerts[0] : null;

  return (
    <section id="cobranza-internet" className="print:hidden mt-10 scroll-mt-6">
      {/* Notificación flotante con auto-cierre en 3 segundos */}
      {!dismissed && alerts.length > 0 && (
        <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(92vw,380px)] flex-col gap-2">
          {alerts.length === 1 && singleAlert ? (
            <div
              role="alert"
              className="cobranza-toast pointer-events-auto relative overflow-hidden flex items-start gap-3 rounded-2xl border border-red-400/50 bg-red-600 p-4 text-white shadow-2xl shadow-red-900/40"
            >
              {/* Barra de progreso de 3 segundos */}
              <div className="absolute bottom-0 left-0 h-1 bg-white/60 animate-dismiss-bar" />

              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                <BellRing size={18} className="animate-pulse" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{singleAlert.c.clientName}</p>
                <p className="text-xs text-white/90">
                  {singleAlert.st === "vencido" ? "Ya se venció su fecha de pago" : "Se acerca su fecha de pago"} · {dayText(singleAlert.days)}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <a
                    href={whatsappLink(singleAlert.c, singleAlert.days)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50 shadow-sm"
                  >
                    <MessageCircle size={13} /> Cobrar por WhatsApp
                  </a>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar notificación"
                onClick={() => setDismissed(true)}
                className="rounded-full p-1 text-white/80 hover:bg-white/20 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            /* Si hay 2 o más deudores: notificación limpia consolidada que no tapa la pantalla */
            <div
              role="alert"
              className="cobranza-toast pointer-events-auto relative overflow-hidden flex items-start gap-3 rounded-2xl border border-red-400/50 bg-red-600 p-4 text-white shadow-2xl shadow-red-900/40"
            >
              {/* Barra de progreso de 3 segundos */}
              <div className="absolute bottom-0 left-0 h-1 bg-white/60 animate-dismiss-bar" />

              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                <AlertTriangle size={18} className="animate-pulse" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Lista de deudores ({alerts.length})</p>
                <p className="text-xs text-white/90 mt-0.5">
                  Hay {alerts.length} clientes con fecha de pago vencida o por vencer.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTab("deudores");
                    setDismissed(true);
                    document.getElementById("tabla-cobranza")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50 shadow-sm"
                >
                  <Users size={13} /> Ver lista de deudores
                </button>
              </div>
              <button
                type="button"
                aria-label="Cerrar notificación"
                onClick={() => setDismissed(true)}
                className="rounded-full p-1 text-white/80 hover:bg-white/20 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="admin-glass rounded-[var(--radius-lg)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
            <Wifi size={20} className="text-accent" /> Cobranza de internet
          </h2>
          {alerts.length > 0 && (
            <button
              type="button"
              onClick={() => setTab((prev) => (prev === "deudores" ? "all" : "deudores"))}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-transform active:scale-95 ${
                tab === "deudores"
                  ? "bg-red-600 text-white shadow-md ring-2 ring-red-400"
                  : "bg-red-600/10 text-red-600 border border-red-500/30 hover:bg-red-600 hover:text-white"
              }`}
            >
              <BellRing size={13} /> {alerts.length} en lista de deudores
            </button>
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

        {/* Pestañas de filtro limpias: Todos vs Lista de Deudores */}
        <div id="tabla-cobranza" className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                tab === "all"
                  ? "bg-accent text-accent-fg shadow-sm"
                  : "border border-border/80 bg-bg-surface/80 text-fg-muted hover:text-fg"
              }`}
            >
              Todos los clientes ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("deudores")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
                tab === "deudores"
                  ? "bg-red-600 text-white shadow-sm"
                  : "border border-red-500/40 bg-red-500/5 text-red-600 hover:bg-red-500/10"
              }`}
            >
              <AlertTriangle size={13} /> Lista de deudores ({alerts.length})
            </button>
          </div>

          {tab === "deudores" && alerts.length > 0 && (
            <p className="text-xs font-semibold text-red-600">
              Mostrando únicamente clientes con cobro pendiente o vencido
            </p>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
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
              {displayedRows.map(({ c, days, st }) => (
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
              {displayedRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-fg-muted">
                    {tab === "deudores"
                      ? "¡Excelente! No hay clientes con cobro pendiente o vencido. Todos están al día."
                      : "Aún no hay clientes de internet registrados."}
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
