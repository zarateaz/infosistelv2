import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getCashboxTransactions,
  getCashboxTransactionsForMonth,
  getCashboxPeriod,
  listCashboxMonths,
} from "./actions";
import { monthKey } from "./month";
import { PAYMENT_METHODS } from "./constants";
import { AddTransactionForm } from "./AddTransactionForm";
import { CajaChart } from "./CajaChart";
import { TransactionRow } from "./TransactionRow";
import { PeriodHeader } from "./PeriodHeader";
import { MonthlyReport } from "./MonthlyReport";
import { MonthSelector } from "./MonthSelector";

function adjacentMonth(month: string, delta: number): string {
  const [year, monthNum] = month.split("-").map(Number);
  const d = new Date(year, monthNum - 1 + delta, 1);
  return monthKey(d);
}

export default async function AdminCashboxPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : monthKey();

  const [transactions, monthTransactions, period, availableMonths] = await Promise.all([
    getCashboxTransactions(),
    getCashboxTransactionsForMonth(month),
    getCashboxPeriod(month),
    listCashboxMonths(),
  ]);

  const balance = transactions.reduce((sum, t) => sum + (t.type === "INCOME" ? t.amount : -t.amount), 0);
  const totalsByMethod = Object.fromEntries(
    PAYMENT_METHODS.map((method) => [
      method,
      transactions
        .filter((t) => t.paymentMethod === method)
        .reduce((sum, t) => sum + (t.type === "INCOME" ? t.amount : -t.amount), 0),
    ])
  );

  return (
    <div>
      <div className="print:hidden">
        <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Caja</h1>
        <p className="mt-1 text-sm text-fg-muted">Saldo actual: S/. {balance.toFixed(2)}</p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PAYMENT_METHODS.map((method) => (
            <div key={method} className="admin-glass rounded-[var(--radius-lg)] p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-fg-muted">{method}</p>
              <p className="mt-2 text-xl font-bold text-fg">S/. {totalsByMethod[method].toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 admin-glass rounded-[var(--radius-lg)] p-6">
          <h2 className="font-display text-lg font-bold text-fg">Evolución del saldo</h2>
          <div className="mt-4">
            <CajaChart transactions={transactions} />
          </div>
        </div>

        <div className="mt-8">
          <AddTransactionForm />
        </div>
      </div>

      <div className="print:hidden mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-fg">Reporte mensual</h2>
        <div className="flex items-center gap-2">
          <Link
            href={`/taller-control/caja?month=${adjacentMonth(month, -1)}`}
            aria-label="Mes anterior"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong text-fg-muted transition-colors hover:border-accent hover:text-accent"
          >
            <ChevronLeft size={15} />
          </Link>
          <MonthSelector month={month} availableMonths={availableMonths} />
          <Link
            href={`/taller-control/caja?month=${adjacentMonth(month, 1)}`}
            aria-label="Mes siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong text-fg-muted transition-colors hover:border-accent hover:text-accent"
          >
            <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      <div className="print:hidden mt-4">
        <PeriodHeader month={month} period={period} />
      </div>

      <div className="mt-4">
        <MonthlyReport month={month} period={period} transactions={monthTransactions} />
      </div>

      <div className="print:hidden mt-10 overflow-x-auto admin-glass rounded-[var(--radius-lg)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-bold uppercase tracking-wider text-fg-muted">
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3">Tipo</th>
              <th className="px-5 py-3">Descripción</th>
              <th className="px-5 py-3">Método</th>
              <th className="px-5 py-3">Monto</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {[...transactions].reverse().map((t) => (
              <TransactionRow key={t.id} transaction={t} />
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-fg-muted">
                  Todavía no hay movimientos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
