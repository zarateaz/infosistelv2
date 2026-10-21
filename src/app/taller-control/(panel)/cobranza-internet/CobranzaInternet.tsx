"use client";

import { Fragment, useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  BellRing,
  MessageCircle,
  Wifi,
  X,
  Check,
  Trash2,
  Users,
  AlertTriangle,
  Pencil,
  StickyNote,
  Calendar,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import {
  createInternetClient,
  markInternetPaid,
  deleteInternetClient,
  type InternetFormState,
} from "./internetActions";
import {
  cobranzaState,
  daysUntil,
  whatsappLink,
  parsePaidMonths,
  getYearMonthsInfo,
  type InternetClientRow,
} from "./cobranza";
import { EditInternetClientModal } from "./EditInternetClientModal";
import { ClientYearlyMonthsView } from "./ClientYearlyMonthsView";

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
  const [editingClient, setEditingClient] = useState<InternetClientRow | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

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
                  {singleAlert.st === "vencido"
                    ? "Ya se venció su fecha de pago"
                    : "Se acerca su fecha de pago"}{" "}
                  · {dayText(singleAlert.days)}
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
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
              <Wifi size={20} className="text-accent" /> Cobranza de internet
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              Haz clic en cualquier cliente para ver y editar sus pagos mes a mes (Enero a Diciembre) y registrar pagos adelantados.
            </p>
          </div>

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

        {/* Formulario de Registro */}
        <form ref={formRef} action={formAction} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className={labelClass} htmlFor="ic-name">Cliente</label>
            <input id="ic-name" name="clientName" required maxLength={150} className={inputClass} placeholder="Ej. Computienda" />
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
            <input id="ic-amount" name="amount" type="number" min={0} step={0.01} className={inputClass} placeholder="Ej. 30.00" />
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <label className={labelClass} htmlFor="ic-concept">Concepto / nota — opcional</label>
            <input
              id="ic-concept"
              name="concept"
              maxLength={200}
              placeholder="Ej: Pagó 2 meses por adelantado (hasta diciembre)"
              className={inputClass}
            />
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

        {/* Pestañas de filtro: Todos vs Lista de Deudores */}
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

        {/* Tabla de Clientes con Modo Expandible y Mini-Tracker de 12 Meses */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="admin-thead text-xs font-bold uppercase tracking-wider text-fg-muted">
                <th className="px-4 py-3">Cliente & Meses ENE-DIC</th>
                <th className="px-4 py-3">Inicio</th>
                <th className="px-4 py-3">Próximo pago</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map(({ c, days, st }) => {
                const isExpanded = expandedClientId === c.id;

                // Mini-tracker para la fila de este cliente
                const clientMap = today
                  ? parsePaidMonths(c.paidMonths, c.startDate, c.nextPaymentDate, c.amount)
                  : {};
                const yearSummary = today
                  ? getYearMonthsInfo(today.getFullYear(), clientMap, today, c.amount)
                  : { months: [], advanceCount: 0 };

                return (
                  <Fragment key={c.id}>
                    <tr
                      onClick={() => setExpandedClientId(isExpanded ? null : c.id)}
                      className={`cursor-pointer transition-colors border-b border-border/40 hover:bg-bg-alt/70 ${
                        isExpanded
                          ? "bg-accent/5 ring-1 ring-inset ring-accent/30"
                          : st === "ok"
                            ? ""
                            : "bg-red-500/10"
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedClientId(isExpanded ? null : c.id);
                            }}
                            className={`mt-0.5 rounded-lg p-1 transition-transform ${
                              isExpanded ? "bg-accent text-accent-fg rotate-180" : "text-fg-muted hover:bg-bg-surface hover:text-fg"
                            }`}
                            title={isExpanded ? "Cerrar meses" : "Ver meses de enero a diciembre"}
                          >
                            <ChevronDown size={14} />
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-fg group-hover/row:text-accent transition-colors">
                                {c.clientName}
                              </p>
                              {yearSummary.advanceCount > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 dark:text-blue-300">
                                  <Sparkles size={11} />
                                  {yearSummary.advanceCount} mes(es) adelantado
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-fg-muted">
                              +{c.whatsapp}
                              {c.amount > 0 ? ` · S/. ${c.amount.toFixed(2)}` : ""}
                            </p>

                            {c.concept && (
                              <p
                                className="mt-1 inline-flex max-w-[320px] items-start gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                                title={c.concept}
                              >
                                <StickyNote size={11} className="mt-0.5 shrink-0" />
                                <span className="truncate">{c.concept}</span>
                              </p>
                            )}

                            {/* Mini-Tracker interactivo de los 12 Meses (E | F | M | A | M | J | J | A | S | O | N | D) */}
                            {today && (
                              <div className="mt-2 flex items-center gap-1 flex-wrap">
                                {yearSummary.months.map((m) => (
                                  <span
                                    key={m.key}
                                    title={`${m.monthName} ${today.getFullYear()}: ${m.badgeText}`}
                                    className={`inline-flex items-center justify-center h-4.5 w-5 rounded text-[9px] font-black transition-transform hover:scale-110 shadow-xs ${
                                      m.isAdvance
                                        ? "bg-blue-600 text-white ring-1 ring-blue-400"
                                        : m.isPaid
                                          ? "bg-emerald-600 text-white"
                                          : m.isOverdue
                                            ? "bg-red-600 text-white animate-pulse"
                                            : m.isDueThisMonth
                                              ? "bg-amber-500 text-white"
                                              : "bg-border/60 text-fg-muted dark:bg-border/30"
                                    }`}
                                  >
                                    {m.monthShort.charAt(0)}
                                  </span>
                                ))}
                                <span className="text-[10px] font-bold text-accent ml-1.5 hover:underline">
                                  {isExpanded ? "Ocultar meses ▲" : "Ver y editar meses ▼"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-fg-muted">{fmt(c.startDate)}</td>
                      <td className="px-4 py-3.5 font-bold text-fg">{fmt(c.nextPaymentDate)}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            st === "ok"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-red-600 text-white shadow-sm"
                          }`}
                        >
                          {st === "ok" ? `Al día · ${days} d` : dayText(days)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
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
                            title={isExpanded ? "Cerrar meses ENE-DIC" : "Abrir meses ENE-DIC (Control mensual)"}
                            onClick={() => setExpandedClientId(isExpanded ? null : c.id)}
                            className={`rounded-full p-2 transition-colors ${
                              isExpanded
                                ? "bg-accent text-accent-fg"
                                : "text-indigo-600 hover:bg-indigo-500/10"
                            }`}
                          >
                            <Calendar size={16} />
                          </button>

                          <button
                            type="button"
                            title="Editar datos del cliente"
                            onClick={() => setEditingClient(c)}
                            className="rounded-full p-2 text-blue-600 hover:bg-blue-500/10 transition-colors"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            title="Eliminar cliente"
                            onClick={() => {
                              if (confirm(`¿Eliminar a ${c.clientName}?`)) {
                                startTransition(() => deleteInternetClient(c.id));
                              }
                            }}
                            className="rounded-full p-2 text-red-600 hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Fila expandible con el Panel de los 12 Meses ENE-DIC */}
                    {isExpanded && today && (
                      <tr className="bg-accent/5 border-b-2 border-accent/30 animate-fade-in">
                        <td colSpan={5} className="p-3 sm:p-5">
                          <ClientYearlyMonthsView
                            client={c}
                            today={today}
                            onClose={() => setExpandedClientId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

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

      {editingClient && (
        <EditInternetClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
        />
      )}
    </section>
  );
}
