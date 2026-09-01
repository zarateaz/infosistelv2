"use client";

import { Printer } from "lucide-react";
import type { AdminTransaction, AdminCashboxPeriod } from "./actions";
import { MonthlyReportRow } from "./MonthlyReportRow";

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

/** Row-by-row running balance + one entry per payment-method column —
 *  same layout as the spreadsheet this replaces (ING./EGR. × TOTAL/YAPE
 *  1/YAPE 2/EFECTIVO, then a cumulative SALDO). Printable via the
 *  browser's own Ctrl+P: everything outside .cashbox-report is hidden by
 *  the @media print rule in globals.css, so the printout is just this
 *  table, not the admin sidebar or the rest of the page. */
export function MonthlyReport({
  month,
  period,
  transactions,
}: {
  month: string;
  period: AdminCashboxPeriod | null;
  transactions: AdminTransaction[];
}) {
  let running = 0;
  const rows = transactions.map((t) => {
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

  const totals = rows.reduce(
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
    { income: 0, incomeYape1: 0, incomeYape2: 0, incomeCash: 0, expense: 0, expenseYape1: 0, expenseYape2: 0, expenseCash: 0 }
  );
  const finalBalance = rows.length > 0 ? rows[rows.length - 1].running : 0;

  return (
    <div className="cashbox-report admin-glass overflow-x-auto rounded-[var(--radius-lg)] p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-fg">
          Reporte de caja — {formatMonthLabel(month)}
        </h2>
        <button
          type="button"
          onClick={() => window.print()}
          className="print:hidden inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-accent-fg transition-colors hover:bg-accent-hover"
        >
          <Printer size={14} />
          Imprimir reporte
        </button>
      </div>

      {/* Print-only letterhead — screen readers/users never see this, the
          on-screen title above already covers it. Real border instead of
          the glass card's blur, which most browsers skip on paper anyway. */}
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
          <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-fg-muted">
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
          {rows.map(({ t, running: rowBalance }) => (
            <MonthlyReportRow key={t.id} transaction={t} running={rowBalance} />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={13} className="px-2 py-8 text-center text-fg-muted">
                Todavía no hay movimientos este mes.
              </td>
            </tr>
          )}
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
