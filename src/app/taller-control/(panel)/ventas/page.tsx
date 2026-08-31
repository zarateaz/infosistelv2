import { DollarSign, TrendingUp, PieChart } from "lucide-react";
import { getSaleStats, getRecentSales, deleteSale } from "./actions";
import { DeleteSaleButton } from "./DeleteSaleButton";

const STAT_CARDS = [
  { key: "day" as const, label: "Ventas de hoy", icon: TrendingUp },
  { key: "week" as const, label: "Semana actual", icon: PieChart },
  { key: "month" as const, label: "Este mes", icon: DollarSign },
];

export default async function AdminSalesPage() {
  const [stats, sales] = await Promise.all([getSaleStats(), getRecentSales()]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Ventas</h1>
      <p className="mt-1 text-sm text-fg-muted">Resumen de ingresos y ganancias.</p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {STAT_CARDS.map(({ key, label, icon: Icon }) => {
          const bucket = stats[key];
          return (
            <div key={key} className="admin-glass rounded-[var(--radius-lg)] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Icon size={18} />
              </div>
              <p className="mt-4 text-2xl font-bold text-fg">S/. {bucket.total.toFixed(2)}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-fg-muted">{label}</p>
              <p className="mt-2 text-xs text-fg-muted">
                Ganancia: S/. {bucket.profit.toFixed(2)} · {bucket.count} venta{bucket.count === 1 ? "" : "s"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 overflow-x-auto admin-glass rounded-[var(--radius-lg)]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-bold uppercase tracking-wider text-fg-muted">
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3">Cantidad</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Ganancia</th>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-fg">{s.pName}</p>
                  {s.category && <p className="text-xs text-fg-muted">{s.category}</p>}
                </td>
                <td className="px-5 py-3.5 text-fg">x{s.quantity}</td>
                <td className="px-5 py-3.5 text-fg">S/. {s.price.toFixed(2)}</td>
                <td className="px-5 py-3.5 text-accent">S/. {s.profit.toFixed(2)}</td>
                <td className="px-5 py-3.5 text-fg-muted">
                  {new Date(s.date).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td className="px-5 py-3.5">
                  <DeleteSaleButton
                    productName={s.pName}
                    action={async () => {
                      "use server";
                      await deleteSale(s.id);
                    }}
                  />
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-fg-muted">
                  Todavía no hay ventas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
