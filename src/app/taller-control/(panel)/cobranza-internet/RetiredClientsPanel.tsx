"use client";

import { useState, useTransition } from "react";
import {
  Building2,
  Check,
  Download,
  HandCoins,
  MessageCircle,
  Router,
  Trash2,
  HeartHandshake,
  UserCheck,
} from "lucide-react";
import {
  directWhatsappLink,
  formatMonthKeyLabel,
  retiredDebtInfo,
  retiredDebtWhatsappLink,
  type InternetClientRow,
  type RetiredDebtInfo,
} from "./cobranza";
import { deleteInternetClient, forgiveRetiredDebt, payRetiredDebt, reactivateInternetClient } from "./internetActions";
import { InternetPaymentModal } from "./InternetPaymentModal";
import { ConfirmDialog } from "../ConfirmDialog";

function fmt(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

/** Meses completos de servicio entre inicio y retiro (aprox., para mostrar). */
function serviceMonths(start: string, end: string): number {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

type Row = { c: InternetClientRow; debt: RetiredDebtInfo };

function exportCsv(rows: Row[]) {
  const header = [
    "Código", "Cliente", "WhatsApp", "Galería", "Router", "Puerto", "Inicio", "Retiro",
    "Motivo", "Mensualidad", "Meses que debe", "Deuda S/.",
  ];
  const esc = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map(({ c, debt }) =>
    [
      c.clientCode, c.clientName, c.whatsapp, c.galeria, c.router, c.portNumber,
      fmt(c.startDate), c.retiredAt ? fmt(c.retiredAt) : "", c.retiredReason,
      c.amount.toFixed(2), debt.pendingMonths.map(formatMonthKeyLabel).join(" / "), debt.pendingTotal.toFixed(2),
    ].map(esc).join(",")
  );
  const blob = new Blob(["﻿" + [header.map(esc).join(","), ...lines].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clientes-retirados-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RetiredClientsPanel({
  clients,
  totalRetired,
}: {
  /** Retirados ya filtrados por router / galería / búsqueda. */
  clients: InternetClientRow[];
  totalRetired: number;
}) {
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [paying, setPaying] = useState<Row | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "reactivate" | "forgive" | "delete"; row: Row } | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const all: Row[] = clients
    .map((c) => ({ c, debt: retiredDebtInfo(c) }))
    .sort((a, b) => (b.c.retiredAt ?? "").localeCompare(a.c.retiredAt ?? ""));
  const withDebt = all.filter((r) => r.debt.pendingMonths.length > 0);
  const rows = onlyDebt ? withDebt : all;
  const totalDebt = withDebt.reduce((s, r) => s + r.debt.pendingTotal, 0);

  const runConfirm = () => {
    if (!confirm) return;
    const { kind, row } = confirm;
    startTransition(async () => {
      if (kind === "delete") {
        await deleteInternetClient(row.c.id);
        setNotice({ tone: "ok", text: `${row.c.clientName} fue eliminado.` });
      } else if (kind === "forgive") {
        const res = await forgiveRetiredDebt(row.c.id);
        setNotice(
          res.ok
            ? { tone: "ok", text: `Deuda de ${row.c.clientName} perdonada.` }
            : { tone: "error", text: res.error || "No se pudo perdonar la deuda." }
        );
      } else {
        const res = await reactivateInternetClient(row.c.id);
        setNotice(
          !res.ok
            ? { tone: "error", text: res.error || "No se pudo reactivar." }
            : res.warning
              ? { tone: "warn", text: res.warning }
              : { tone: "ok", text: `${row.c.clientName} volvió a la lista de clientes activos.` }
        );
      }
      setConfirm(null);
    });
  };

  return (
    <div className="mt-4">
      {/* Resumen */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/80 bg-bg-raised/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">Clientes retirados</p>
          <p className="mt-1 font-display text-2xl font-black tabular-nums text-fg">{totalRetired}</p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-bg-raised/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">Se fueron debiendo</p>
          <p className="mt-1 font-display text-2xl font-black tabular-nums text-fg">
            {withDebt.length}
            <span className="ml-1 text-sm font-semibold text-fg-muted">de {all.length}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">Deuda por cobrar</p>
          <p className="mt-1 font-display text-2xl font-black tabular-nums text-red-600">S/. {totalDebt.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-fg-muted">
          <input type="checkbox" checked={onlyDebt} onChange={(e) => setOnlyDebt(e.target.checked)} />
          Solo los que tienen deuda
        </label>
        <button
          type="button"
          onClick={() => exportCsv(rows)}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-bg-surface/80 px-3 py-1.5 text-xs font-bold text-fg-muted hover:text-fg disabled:opacity-50"
        >
          <Download size={13} /> Descargar lista (Excel/CSV)
        </button>
      </div>

      {notice && (
        <p
          role="status"
          className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${
            notice.tone === "ok"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : notice.tone === "warn"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "bg-red-500/10 text-red-600"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="admin-thead text-xs font-bold uppercase tracking-wider text-fg-muted">
              <th className="px-4 py-3">Cliente / Código / Galería</th>
              <th className="px-4 py-3">Red que usaba</th>
              <th className="px-4 py-3">Servicio</th>
              <th className="px-4 py-3">Motivo</th>
              <th className="px-4 py-3">Deuda pendiente</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { c, debt } = row;
              const owes = debt.pendingMonths.length > 0;
              return (
                <tr key={c.id} className={`border-b border-border/40 ${owes ? "bg-red-500/5" : ""}`}>
                  <td className="px-4 py-3.5 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      {c.clientCode && (
                        <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-black text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                          {c.clientCode}
                        </span>
                      )}
                      <span className="font-bold text-fg">{c.clientName}</span>
                      <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-orange-700 dark:text-orange-300">
                        Retirado
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                      {c.galeria && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300">
                          <Building2 size={12} /> {c.galeria}
                        </span>
                      )}
                      <span>+{c.whatsapp}</span>
                      <span>· S/. {c.amount.toFixed(2)} / mes</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    {c.router || c.portNumber ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-bg-surface px-2.5 py-1 text-xs font-bold text-fg-muted">
                          <Router size={13} /> {c.router || "Router"}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-fg-muted">
                          {c.portNumber ? `Puerto ${c.portNumber} · liberado` : "Sin puerto"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs italic text-fg-muted">Sin conexión asignada</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-top text-xs">
                    <p className="text-fg-muted">Inicio: {fmt(c.startDate)}</p>
                    <p className="font-bold text-fg">Retiro: {c.retiredAt ? fmt(c.retiredAt) : "—"}</p>
                    {c.retiredAt && (
                      <p className="text-fg-muted">
                        {serviceMonths(c.startDate, c.retiredAt)} mes(es) de servicio
                      </p>
                    )}
                  </td>
                  <td className="max-w-[200px] px-4 py-3.5 align-top text-xs text-fg">
                    {c.retiredReason || <span className="italic text-fg-muted">Sin motivo</span>}
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    {owes ? (
                      <>
                        <p className="font-display text-base font-black tabular-nums text-red-600">
                          S/. {debt.pendingTotal.toFixed(2)}
                        </p>
                        <div className="mt-1 flex max-w-[240px] flex-wrap gap-1">
                          {debt.pendingMonths.map((k) => (
                            <span key={k} className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {formatMonthKeyLabel(k)}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <Check size={12} /> Sin deuda
                      </span>
                    )}
                    {debt.paidMonths.length > 0 && (
                      <p className="mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Ya pagó {debt.paidMonths.length} mes(es) de su deuda
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      <a
                        href={owes ? retiredDebtWhatsappLink(c, debt) : directWhatsappLink(c.whatsapp, c.clientName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={owes ? "Cobrar la deuda por WhatsApp" : `Escribir a ${c.clientName}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-600"
                      >
                        <MessageCircle size={13} />
                        <span className="hidden sm:inline">{owes ? "Cobrar" : "WhatsApp"}</span>
                      </a>
                      {owes && (
                        <>
                          <button
                            type="button"
                            title="Registrar pago de la deuda (entra a Caja)"
                            onClick={() => setPaying(row)}
                            className="rounded-full p-2 text-accent hover:bg-accent/10"
                          >
                            <HandCoins size={16} />
                          </button>
                          <button
                            type="button"
                            title="Perdonar la deuda (no se le cobra)"
                            onClick={() => setConfirm({ kind: "forgive", row })}
                            className="rounded-full p-2 text-amber-600 hover:bg-amber-500/10"
                          >
                            <HeartHandshake size={16} />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        title="Reactivar: el cliente regresó"
                        onClick={() => setConfirm({ kind: "reactivate", row })}
                        className="rounded-full p-2 text-blue-600 hover:bg-blue-500/10"
                      >
                        <UserCheck size={16} />
                      </button>
                      <button
                        type="button"
                        title="Eliminar definitivamente"
                        onClick={() => setConfirm({ kind: "delete", row })}
                        className="rounded-full p-2 text-red-600 hover:bg-red-500/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-fg-muted">
                  {totalRetired === 0
                    ? "Aún no hay clientes retirados. Usa el botón naranja de retirar en la lista de clientes cuando alguien se vaya."
                    : onlyDebt
                      ? "Ningún cliente retirado tiene deuda pendiente."
                      : "No se encontraron retirados con los filtros aplicados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paying && (
        <InternetPaymentModal
          isOpen
          client={paying.c}
          monthKey={paying.debt.pendingMonths[0]}
          monthLabel={`Deuda: ${paying.debt.pendingMonths.map(formatMonthKeyLabel).join(", ")}`}
          initialAmount={paying.debt.pendingTotal}
          initialMethod="YAPE 1"
          onClose={() => setPaying(null)}
          onConfirm={async (payment) => {
            const res = await payRetiredDebt(paying.c.id, {
              months: paying.debt.pendingMonths,
              totalAmount: payment.amount,
              method: payment.method,
              paidAt: payment.paidAt,
              note: payment.note,
              syncToCashbox: payment.syncToCashbox,
            });
            if (!res.ok) throw new Error(res.error || "No se pudo registrar el pago.");
            return { receiptNumber: res.receiptNumbers?.[0] };
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === "delete"
              ? "Eliminar cliente retirado"
              : confirm.kind === "forgive"
                ? "Perdonar deuda"
                : "Reactivar cliente"
          }
          message={
            confirm.kind === "delete"
              ? `¿Eliminar definitivamente a "${confirm.row.c.clientName}"? Se borra su historial y sus pagos registrados en Caja pasan a la Papelera. No se puede deshacer.`
              : confirm.kind === "forgive"
                ? `¿Perdonar a "${confirm.row.c.clientName}" la deuda de S/. ${confirm.row.debt.pendingTotal.toFixed(2)} (${confirm.row.debt.pendingMonths.map(formatMonthKeyLabel).join(", ")})? Seguirá en la lista de retirados, pero sin deuda.`
                : `¿"${confirm.row.c.clientName}" regresó? Vuelve a la lista de clientes activos con su mismo router y puerto (si sigue libre). Los meses que estuvo retirado no se le cobran${confirm.row.debt.pendingMonths.length > 0 ? "; la deuda que dejó sí sigue pendiente" : ""}.`
          }
          danger={confirm.kind !== "reactivate"}
          confirmLabel={
            confirm.kind === "delete" ? "Sí, eliminar" : confirm.kind === "forgive" ? "Sí, perdonar" : "Sí, reactivar"
          }
          pendingLabel="Guardando..."
          pending={isPending}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
