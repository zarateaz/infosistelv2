"use client";

import { useState, useTransition } from "react";
import {
  Calendar,
  Check,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Edit3,
  X,
  MessageCircle,
} from "lucide-react";
import {
  getYearMonthsInfo,
  parsePaidMonths,
  whatsappLink,
  formatMonthKeyLabel,
  type InternetClientRow,
  type MonthUIInfo,
} from "./cobranza";
import {
  toggleInternetClientMonth,
  payAdvanceInternetMonths,
  updateInternetMonthDetails,
} from "./internetActions";
import { ConfirmDialog } from "../ConfirmDialog";
import { InternetPaymentModal } from "./InternetPaymentModal";
import { PAYMENT_METHOD_INFO, PAYMENT_METHODS, type PaymentMethodType } from "@/lib/paymentMethods";

interface ClientYearlyMonthsViewProps {
  client: InternetClientRow;
  today: Date;
  onClose?: () => void;
}

export function ClientYearlyMonthsView({
  client,
  today,
  onClose,
}: ClientYearlyMonthsViewProps) {
  const currentRealYear = today.getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentRealYear);
  const [isPending, startTransition] = useTransition();

  // Estado para edición individual de un mes
  const [editingMonthKey, setEditingMonthKey] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(client.amount);
  const [editMethod, setEditMethod] = useState<PaymentMethodType>("YAPE 1");
  const [editNote, setEditNote] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [confirmUnmark, setConfirmUnmark] = useState<MonthUIInfo | null>(null);
  const [confirmEditMonth, setConfirmEditMonth] = useState<{ key: string; isPaid: boolean } | null>(null);

  // Modales de confirmación con sincronización a Caja
  const [payingMonthInfo, setPayingMonthInfo] = useState<MonthUIInfo | null>(null);
  const [advanceModal, setAdvanceModal] = useState<{ isOpen: boolean; count: number } | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Mapa reactivo de meses
  const paidMonthsMap = parsePaidMonths(
    client.paidMonths,
    client.startDate,
    client.nextPaymentDate,
    client.amount
  );

  const startYear = Number(client.startDate.slice(0, 4)) || currentRealYear;

  const yearInfo = getYearMonthsInfo(
    selectedYear,
    paidMonthsMap,
    today,
    client.amount,
    client.startDate
  );

  const visibleMonths = yearInfo.months.filter((m) => !m.isBeforeStart);

  // Ejecuta la reversión de un mes pagado (desmarcar)
  const executeUnmarkMonth = (m: MonthUIInfo) => {
    startTransition(async () => {
      const res = await toggleInternetClientMonth(client.id, m.key, {
        paid: false,
      });
      setConfirmUnmark(null);
      if (res.ok) {
        showToast(`Mes ${m.monthName} desmarcado (revertido y enviado a papelera en Caja si aplicaba)`);
      }
    });
  };

  const handleToggleMonth = (m: MonthUIInfo) => {
    if (m.isPaid) {
      setConfirmUnmark(m);
      return;
    }
    setPayingMonthInfo(m);
  };

  const handleOpenAdvancePay = (monthsCount: number) => {
    setAdvanceModal({ isOpen: true, count: monthsCount });
  };

  const executeSaveMonthDetails = (key: string, isCurrentlyPaid: boolean) => {
    startTransition(async () => {
      const res = await updateInternetMonthDetails(client.id, key, {
        status: isCurrentlyPaid ? "paid" : "unpaid",
        amount: editAmount,
        method: editMethod,
        note: editNote.trim() || undefined,
      });
      setConfirmEditMonth(null);
      if (res.ok) {
        setEditingMonthKey(null);
        showToast("✓ Detalles del mes y movimiento en Caja actualizados correctamente.");
      }
    });
  };

  const handleSaveMonthDetails = (key: string, isCurrentlyPaid: boolean) => {
    setConfirmEditMonth({ key, isPaid: isCurrentlyPaid });
  };

  const openMonthEditor = (m: MonthUIInfo) => {
    setEditingMonthKey(m.key);
    setEditAmount(m.amount ?? client.amount);
    const mMethod = m.method?.trim().toUpperCase();
    if (mMethod === "YAPE 2" || mMethod === "YAPE2") {
      setEditMethod("YAPE 2");
    } else if (mMethod === "EFECTIVO") {
      setEditMethod("EFECTIVO");
    } else {
      setEditMethod("YAPE 1");
    }
    setEditNote(m.note || "");
  };

  return (
    <div className="rounded-2xl border border-accent/30 bg-bg-surface/95 p-4 sm:p-6 shadow-xl backdrop-blur-md transition-all">
      {/* Toast de retroalimentación flotante en el panel */}
      {toastMsg && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md animate-fade-in">
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="rounded p-0.5 hover:bg-white/20"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Cabecera del Panel Anual */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Calendar size={16} />
            </span>
            <h3 className="font-display text-base sm:text-lg font-bold text-fg">
              Control de Pagos Mes a Mes:{" "}
              <span className="text-accent underline decoration-accent/40">{client.clientName}</span>
            </h3>
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            Haz clic en cualquier mes para marcarlo como pagado o pendiente. La próxima fecha de pago se sincroniza automáticamente.
          </p>
        </div>

        {/* Navegador de Año */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center rounded-xl border border-border/80 bg-bg-alt p-1 shadow-sm">
            <button
              type="button"
              disabled={selectedYear <= startYear}
              onClick={() => setSelectedYear((y) => Math.max(startYear, y - 1))}
              className="rounded-lg p-1.5 text-fg-muted hover:bg-bg-surface hover:text-fg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={selectedYear <= startYear ? "El cliente inició en este año" : "Año anterior"}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-sm font-black text-fg">{selectedYear}</span>
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y + 1)}
              className="rounded-lg p-1.5 text-fg-muted hover:bg-bg-surface hover:text-fg transition-colors"
              title="Año siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {selectedYear !== currentRealYear && (
            <button
              type="button"
              onClick={() => setSelectedYear(currentRealYear)}
              className="rounded-xl border border-border px-2.5 py-1.5 text-xs font-bold text-fg-muted hover:text-fg hover:bg-bg-alt"
            >
              Año Actual ({currentRealYear})
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border/80 p-2 text-fg-muted hover:bg-bg-alt hover:text-fg"
              title="Cerrar vista anual"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Métricas y Acciones Rápidas Pro */}
      <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-border/50 bg-bg-alt/50 p-3.5">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-700 dark:text-emerald-400">
            <Check size={14} /> {yearInfo.paidCount} pagados en {selectedYear}
          </span>
          {yearInfo.advanceCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-2.5 py-1 font-extrabold text-blue-700 dark:text-blue-300">
              <Sparkles size={13} /> {yearInfo.advanceCount} por adelantado
            </span>
          )}
          {yearInfo.overdueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1 font-bold text-red-600">
              <AlertTriangle size={13} /> {yearInfo.overdueCount} meses impagos
            </span>
          )}
          <span className="font-semibold text-fg-muted">
            Total recaudado: <strong className="text-fg">S/. {yearInfo.totalCollected.toFixed(2)}</strong>
          </span>
        </div>

        {/* Botones de acción rápida: ¡Pagar 2 meses adelantados! */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleOpenAdvancePay(2)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all disabled:opacity-60"
            title="Paga automáticamente los próximos 2 meses pendientes e ingresa a Caja"
          >
            <Zap size={13} className="text-amber-300" />
            + Pagar 2 meses adelantados
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => handleOpenAdvancePay(1)}
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-bg-surface px-3 py-1.5 text-xs font-bold text-fg hover:bg-bg-alt active:scale-95 transition-all disabled:opacity-60"
            title="Paga 1 mes adelantado e ingresa a Caja"
          >
            + 1 mes
          </button>
        </div>
      </div>

      {/* Grid de Meses desde la fecha de inicio del cliente */}
      {visibleMonths.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-border/70 bg-bg-alt/50 p-6 text-center text-xs text-fg-muted">
          Este cliente inicia su servicio el{" "}
          <strong className="text-fg">{client.startDate.split("-").reverse().join("/")}</strong>. No hay meses en {selectedYear}.
        </div>
      ) : (
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {visibleMonths.map((m) => {
          const isEditing = editingMonthKey === m.key;

          // Clases dinámicas según el estado del mes
          let cardStyle = "border-border/70 bg-bg-surface hover:border-border-strong";
          let badgeClass = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

          if (m.badgeStyle === "advance") {
            cardStyle =
              "border-blue-500/40 bg-blue-500/10 dark:bg-blue-950/40 shadow-sm ring-1 ring-blue-500/30";
            badgeClass = "bg-blue-600 text-white font-extrabold";
          } else if (m.badgeStyle === "paid") {
            cardStyle =
              "border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-950/40 shadow-sm";
            badgeClass = "bg-emerald-600 text-white font-extrabold";
          } else if (m.badgeStyle === "overdue") {
            cardStyle =
              "border-red-500/40 bg-red-500/10 dark:bg-red-950/40 shadow-sm ring-1 ring-red-500/30";
            badgeClass = "bg-red-600 text-white font-extrabold animate-pulse";
          } else if (m.badgeStyle === "due") {
            cardStyle =
              "border-amber-500/50 bg-amber-500/10 dark:bg-amber-950/30 shadow-sm ring-1 ring-amber-500/40";
            badgeClass = "bg-amber-500 text-white font-extrabold";
          }

          return (
            <div
              key={m.key}
              className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${cardStyle}`}
            >
              <div>
                {/* Cabecera de la tarjeta del mes */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-fg-muted">
                      {String(m.monthNum).padStart(2, "0")}
                    </span>
                    <h4 className="font-display text-sm font-black text-fg">
                      {m.monthName}
                    </h4>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${badgeClass}`}
                  >
                    {m.badgeText}
                  </span>
                </div>

                {/* Monto y Detalle */}
                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold text-fg-muted">Monto:</span>
                    <span
                      className={`text-base font-black ${
                        m.isPaid
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-fg"
                      }`}
                    >
                      S/. {(m.amount ?? client.amount).toFixed(2)}
                    </span>
                  </div>

                  {m.isPaid ? (
                    <div className="mt-1 space-y-0.5 text-[11px] text-fg-muted">
                      {m.paidAt && (
                        <p className="flex items-center gap-1">
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          <span>Pagado: {m.paidAt}</span>
                        </p>
                      )}
                      {m.method && (
                        <p className="font-semibold text-fg">Método: {m.method}</p>
                      )}
                      {m.note && (
                        <p className="italic text-[10px] text-fg-muted truncate" title={m.note}>
                          “{m.note}”
                        </p>
                      )}
                    </div>
                  ) : m.isOverdue ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-red-600">
                      <AlertTriangle size={11} /> Mes vencido sin abonar
                    </p>
                  ) : m.isDueThisMonth ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-600">
                      <Clock size={11} /> Corresponde cobrar este mes
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-fg-muted">Mes futuro</p>
                  )}
                </div>
              </div>

              {/* Formulario Inline de Edición de detalles */}
              {isEditing ? (
                <div className="mt-3 border-t border-border/60 pt-2.5 space-y-2 animate-fade-in">
                  <div>
                    <label className="text-[10px] font-bold text-fg-muted uppercase">Monto (S/.)</label>
                    <input
                      type="number"
                      step={0.5}
                      value={editAmount}
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                      className="admin-field mt-0.5 w-full rounded-lg px-2 py-1 text-xs text-fg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-fg-muted uppercase">Método de Pago (Caja)</label>
                    <select
                      value={editMethod}
                      onChange={(e) => setEditMethod(e.target.value as PaymentMethodType)}
                      className="admin-field mt-0.5 w-full rounded-lg px-2 py-1 text-xs text-fg font-bold"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_INFO[m].labelSelect}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-fg-muted uppercase">Nota / Detalle</label>
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="Ej. Yape del titular"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="admin-field mt-0.5 w-full rounded-lg px-2 py-1 text-xs text-fg"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleSaveMonthDetails(m.key, m.isPaid)}
                      className="flex-1 rounded-lg bg-accent py-1 text-xs font-bold text-white hover:opacity-90"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMonthKey(null)}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-fg-muted hover:bg-bg-alt"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* Botones de Acción de la tarjeta */
                <div className="mt-3.5 flex items-center justify-between gap-1.5 border-t border-border/50 pt-2.5">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggleMonth(m)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-1.5 px-2 text-xs font-bold transition-all active:scale-95 ${
                      m.isPaid
                        ? "border border-border/80 bg-bg-surface text-fg-muted hover:border-red-500/40 hover:text-red-600"
                        : m.isOverdue
                          ? "bg-red-600 text-white shadow-sm hover:bg-red-700"
                          : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                    }`}
                  >
                    {m.isPaid ? (
                      <span>Desmarcar</span>
                    ) : (
                      <>
                        <Check size={13} />
                        <span>Marcar Pagado</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openMonthEditor(m)}
                    className="rounded-xl border border-border/80 p-1.5 text-fg-muted hover:bg-bg-alt hover:text-fg transition-colors"
                    title="Editar monto, método o nota de este mes"
                  >
                    <Edit3 size={13} />
                  </button>

                  {m.isOverdue && (
                    <a
                      href={whatsappLink(client, -15)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl p-1.5 text-emerald-600 hover:bg-emerald-500/10"
                      title="Enviar recordatorio de WhatsApp por este mes"
                    >
                      <MessageCircle size={14} />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {confirmUnmark && (
        <ConfirmDialog
          title="Desmarcar mes pagado"
          message={`¡Atención! ¿Seguro que deseas revertir el pago de ${confirmUnmark.monthName} (${selectedYear}) para "${client.clientName}"? Si este pago fue registrado en Caja, el movimiento se enviará a la Papelera de Caja para mantener el balance exacto.`}
          danger
          confirmLabel="Sí, desmarcar"
          pendingLabel="Revirtiendo..."
          pending={isPending}
          onConfirm={() => executeUnmarkMonth(confirmUnmark)}
          onCancel={() => setConfirmUnmark(null)}
        />
      )}

      {/* Modal para pagar un mes específico con selección de método e ingreso a Caja */}
      {payingMonthInfo && (
        <InternetPaymentModal
          isOpen={Boolean(payingMonthInfo)}
          client={client}
          monthKey={payingMonthInfo.key}
          monthLabel={`${payingMonthInfo.monthName} ${selectedYear}`}
          initialAmount={payingMonthInfo.amount ?? client.amount}
          initialMethod="YAPE 1"
          onClose={() => setPayingMonthInfo(null)}
          onConfirm={async (payment) => {
            const res = await toggleInternetClientMonth(client.id, payingMonthInfo.key, {
              paid: true,
              amount: payment.amount,
              method: payment.method,
              paidAt: payment.paidAt,
              note: payment.note,
              receiptNumber: payment.receiptNumber,
              syncToCashbox: payment.syncToCashbox,
            });
            if (!res.ok) throw new Error(res.error || "No se pudo registrar el pago.");
            if (res.ok) {
              showToast(
                `✓ ${payingMonthInfo.monthName} marcado como PAGADO e ingresado a Caja (${payment.method})`
              );
            }
            return { receiptNumber: res.receiptNumber };
          }}
        />
      )}

      {/* Modal para pagar meses adelantados (+1 o +2 meses) */}
      {advanceModal && (
        <InternetPaymentModal
          isOpen={advanceModal.isOpen}
          client={client}
          isAdvance={true}
          advanceCount={advanceModal.count}
          monthLabel={`${advanceModal.count} mes(es) por adelantado`}
          initialAmount={client.amount}
          initialMethod="YAPE 1"
          onClose={() => setAdvanceModal(null)}
          onConfirm={async (payment) => {
            const count = advanceModal.count;
            const amountPerMonth = count > 0 ? payment.amount / count : payment.amount;
            const res = await payAdvanceInternetMonths(client.id, count, {
              amountPerMonth,
              method: payment.method,
              paidAt: payment.paidAt,
              note: payment.note,
              syncToCashbox: payment.syncToCashbox,
            });
            if (!res.ok) throw new Error(res.error || "No se pudo registrar el pago.");
            if (res.ok) {
              showToast(
                `🎉 ¡${res.countPaid ?? count} mes(es) pagados por adelantado e ingresados a Caja (${payment.method})!`
              );
            }
            return { receiptNumbers: res.receiptNumbers, receiptNumber: res.receiptNumbers?.[0] };
          }}
        />
      )}

      {confirmEditMonth && (
        <ConfirmDialog
          title="Confirmar modificación del mes"
          message={`¿Confirmas actualizar los detalles del mes ${confirmEditMonth.key} para "${client.clientName}"? Si ya está en Caja, su monto y método se actualizarán en sincronía.`}
          fields={[
            { label: "Monto", value: `S/. ${editAmount.toFixed(2)}` },
            { label: "Método", value: editMethod },
            ...(editNote.trim() ? [{ label: "Nota", value: editNote.trim() }] : []),
          ]}
          confirmLabel="Sí, guardar cambios"
          pendingLabel="Guardando..."
          pending={isPending}
          onConfirm={() => executeSaveMonthDetails(confirmEditMonth.key, confirmEditMonth.isPaid)}
          onCancel={() => setConfirmEditMonth(null)}
        />
      )}
    </div>
  );
}
