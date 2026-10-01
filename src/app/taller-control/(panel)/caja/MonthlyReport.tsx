"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Printer, Download, Calendar, ArrowRight } from "lucide-react";
import type { AdminTransaction, AdminCashboxPeriod, CashboxMonthSummary } from "./actions";
import { MonthlyReportRow } from "./MonthlyReportRow";
import { generateCashboxReportPDF } from "@/lib/pdfReportGenerator";
import { monthKeyUTC } from "./month";

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  return `${MONTH_NAMES[monthNum - 1]} de ${year}`;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function money(n: number): string {
  return n === 0 ? "" : `S/. ${n.toFixed(2)}`;
}

function computeRows(transactions: AdminTransaction[]) {
  let running = 0;
  return transactions.map((t) => {
    const isIncome = t.type === "INCOME";
    running += isIncome ? t.amount : -t.amount;
    return {
      t,
      isIncome,
      running,
      incomeYape1: isIncome && t.paymentMethod === "YAPE 1" ? t.amount : 0,
      incomeYape2: isIncome && t.paymentMethod === "YAPE 2" ? t.amount : 0,
      incomeCash: isIncome && t.paymentMethod === "EFECTIVO" ? t.amount : 0,
      expenseYape1: !isIncome && t.paymentMethod === "YAPE 1" ? t.amount : 0,
      expenseYape2: !isIncome && t.paymentMethod === "YAPE 2" ? t.amount : 0,
      expenseCash: !isIncome && t.paymentMethod === "EFECTIVO" ? t.amount : 0,
    };
  });
}

/**
 * Printable & downloadable monthly cashbox report.
 * If there are no transactions in the selected month, it stays cleanly collapsed
 * with a quick shortcut to download the previous closed month's PDF.
 */
export function MonthlyReport({
  month,
  period,
  transactions,
  monthsSummary,
  allTransactions,
}: {
  month: string;
  period: AdminCashboxPeriod | null;
  transactions: AdminTransaction[];
  monthsSummary?: CashboxMonthSummary[];
  allTransactions?: AdminTransaction[];
}) {
  const rows = useMemo(() => computeRows(transactions), [transactions]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        income: acc.income + (r.isIncome ? r.t.amount : 0),
        incomeYape1: acc.incomeYape1 + r.incomeYape1,
        incomeYape2: acc.incomeYape2 + r.incomeYape2,
        incomeCash: acc.incomeCash + r.incomeCash,
        expense: acc.expense + (!r.isIncome ? r.t.amount : 0),
        expenseYape1: acc.expenseYape1 + r.expenseYape1,
        expenseYape2: acc.expenseYape2 + r.expenseYape2,
        expenseCash: acc.expenseCash + r.expenseCash,
      }),
      {
        income: 0,
        incomeYape1: 0,
        incomeYape2: 0,
        incomeCash: 0,
        expense: 0,
        expenseYape1: 0,
        expenseYape2: 0,
        expenseCash: 0,
      }
    );
  }, [rows]);

  const finalBalance = rows.length > 0 ? rows[rows.length - 1].running : 0;
  const displayRows = useMemo(() => [...rows].reverse(), [rows]);

  const handleDownloadPDF = () => {
    generateCashboxReportPDF({
      month,
      monthLabel: formatMonthLabel(month),
      responsible: period?.responsible,
      transactions,
    });
  };

  // If there are no movements yet in this month, offer a clear shortcut to download
  // the previous closed month's PDF so the user is never stuck!
  if (transactions.length === 0) {
    const latestClosedMonth = monthsSummary?.find((m) => !m.isCurrent && m.count > 0);

    const handleDownloadPreviousMonth = () => {
      if (!latestClosedMonth) return;
      const txs = allTransactions
        ? allTransactions.filter((t) => monthKeyUTC(t.date) === latestClosedMonth.month)
        : [];
      generateCashboxReportPDF({
        month: latestClosedMonth.month,
        monthLabel: latestClosedMonth.label,
        responsible: latestClosedMonth.responsible || undefined,
        transactions: txs,
      });
    };

    return (
      <div className="admin-glass rounded-[var(--radius-lg)] p-8 text-center text-fg-muted">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-fg/5 text-fg-muted">
          <Calendar size={24} />
        </div>
        <p className="mt-3 text-sm font-bold text-fg">
          El reporte de caja para {formatMonthLabel(month)} no tiene movimientos registrados
        </p>
        <p className="mt-1 text-xs text-fg-muted max-w-md mx-auto">
          El mes inicia en blanco. Al registrar movimientos en este mes, el balance y reporte se generarán automáticamente aquí.
        </p>

        {latestClosedMonth && (
          <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-accent/40 bg-accent/[0.04] p-4 text-left sm:flex-row max-w-xl mx-auto">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                Último mes cerrado disponible
              </span>
              <p className="font-display text-sm font-bold text-fg">
                {latestClosedMonth.label} — {latestClosedMonth.count} movimientos
              </p>
              <p className="text-xs text-fg-muted">
                Saldo neto: S/. {latestClosedMonth.balance.toFixed(2)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPreviousMonth}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-fg shadow-sm shadow-accent/25 transition-all hover:opacity-90 active:scale-95"
                title={`Descargar reporte en PDF de ${latestClosedMonth.label}`}
              >
                <Download size={13} />
                <span>Descargar PDF</span>
              </button>
              <Link
                href={`/taller-control/caja?month=${latestClosedMonth.month}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-bg px-3 py-2 text-xs font-semibold text-fg transition-colors hover:border-accent hover:text-accent"
              >
                <span>Ver mes</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cashbox-report admin-glass overflow-x-auto rounded-[var(--radius-lg)] p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-fg">
          Reporte de caja — {formatMonthLabel(month)}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="print:hidden inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wide text-accent-fg shadow-sm transition-opacity hover:opacity-90 active:scale-95"
            title="Descargar reporte mensual de caja en PDF"
          >
            <Download size={14} />
            Descargar PDF ({transactions.length} movs.)
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="print:hidden inline-flex items-center gap-2 rounded-full border border-border bg-bg-alt px-4 py-2 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-accent hover:text-accent"
            title="Imprimir reporte"
          >
            <Printer size={14} />
            Imprimir
          </button>
        </div>
      </div>

      {/* Print-only letterhead */}
      <div className="hidden print:block print:mb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-extrabold tracking-tight text-fg">INFOSISTEL</span>
          <span className="text-xs text-fg-muted">Huancayo, Perú</span>
        </div>
        <div className="mt-1 h-[3px] w-full bg-accent" />
        <h1 className="mt-2 text-base font-bold uppercase tracking-wide text-fg">
          Control de caja — {formatMonthLabel(month)}
        </h1>
      </div>

      <table className="w-full min-w-[900px] border-collapse text-left text-xs">
        <thead>
          <tr className="admin-thead text-[10px] font-bold uppercase tracking-wider text-fg-muted">
            <th className="px-2 py-2">Fecha</th>
            <th className="px-2 py-2">Concepto</th>
            <th className="px-2 py-2 text-right">Ing. total</th>
            <th className="px-2 py-2 text-right">Ing. Yape 1</th>
            <th className="px-2 py-2 text-right">Ing. Yape 2</th>
            <th className="px-2 py-2 text-right">Ing. efect.</th>
            <th className="px-2 py-2 text-right">Egr. total</th>
            <th className="px-2 py-2 text-right">Egr. Yape 1</th>
            <th className="px-2 py-2 text-right">Egr. Yape 2</th>
            <th className="px-2 py-2 text-right">Egr. efect.</th>
            <th className="px-2 py-2 text-right">Saldo</th>
            <th className="px-2 py-2">Notas</th>
            <th className="print:hidden px-2 py-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map(({ t, running: rowBalance }) => (
            <MonthlyReportRow key={t.id} transaction={t} running={rowBalance} />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border text-xs font-bold text-fg">
            <td className="px-2 py-2" colSpan={2}>
              Totales del período
            </td>
            <td className="px-2 py-2 text-right">{money(totals.income)}</td>
            <td className="px-2 py-2 text-right">{money(totals.incomeYape1)}</td>
            <td className="px-2 py-2 text-right">{money(totals.incomeYape2)}</td>
            <td className="px-2 py-2 text-right">{money(totals.incomeCash)}</td>
            <td className="px-2 py-2 text-right">{money(totals.expense)}</td>
            <td className="px-2 py-2 text-right">{money(totals.expenseYape1)}</td>
            <td className="px-2 py-2 text-right">{money(totals.expenseYape2)}</td>
            <td className="px-2 py-2 text-right">{money(totals.expenseCash)}</td>
            <td className="px-2 py-2 text-right text-accent">{money(finalBalance)}</td>
            <td className="px-2 py-2" />
            <td className="print:hidden px-2 py-2" />
          </tr>
        </tfoot>
      </table>

      {period && (
        <p className="mt-3 hidden text-xs text-fg-muted print:block">
          Responsable: {period.responsible} — impreso el {formatDate(new Date())}
        </p>
      )}
    </div>
  );
}
