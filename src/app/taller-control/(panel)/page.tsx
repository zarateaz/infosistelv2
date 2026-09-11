import Link from "next/link";
import { Package, ShoppingBag, TrendingUp, AlertTriangle, Wrench, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAdminOrders } from "./pedidos/actions";

const LOW_STOCK_THRESHOLD = 3;

export default async function AdminDashboardPage() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    productCount,
    orderCount,
    revenueAgg,
    lowStockCount,
    pendingRepairCount,
    todayIncomeAgg,
    todayExpenseAgg,
    recentOrders,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.product.count({ where: { stock: { lte: LOW_STOCK_THRESHOLD } } }),
    prisma.repair.count({ where: { progress: { lt: 100 } } }),
    prisma.cashboxTransaction.aggregate({ where: { type: "INCOME", date: { gte: startOfDay } }, _sum: { amount: true } }),
    prisma.cashboxTransaction.aggregate({ where: { type: "EXPENSE", date: { gte: startOfDay } }, _sum: { amount: true } }),
    getAdminOrders().then((orders) => orders.slice(0, 5)),
  ]);

  const todayCajaTotal = (todayIncomeAgg._sum.amount ?? 0) - (todayExpenseAgg._sum.amount ?? 0);

  const stats = [
    { icon: Package, label: "Productos", value: productCount, href: "/taller-control/productos", tint: "blue" },
    { icon: ShoppingBag, label: "Pedidos", value: orderCount, href: "/taller-control/pedidos", tint: "violet" },
    {
      icon: TrendingUp,
      label: "Ingresos totales",
      value: `S/. ${(revenueAgg._sum.total ?? 0).toFixed(2)}`,
      href: "/taller-control/pedidos",
      tint: "emerald",
    },
    {
      icon: AlertTriangle,
      label: "Stock bajo (≤3)",
      value: lowStockCount,
      href: "/taller-control/productos",
      tint: lowStockCount > 0 ? "red" : "slate",
    },
    {
      icon: Wrench,
      label: "Reparaciones pendientes",
      value: pendingRepairCount,
      href: "/taller-control/reparaciones",
      tint: "amber",
    },
    { icon: Wallet, label: "Caja de hoy", value: `S/. ${todayCajaTotal.toFixed(2)}`, href: "/taller-control/caja", tint: "cyan" },
  ] as const;

  const TINTS: Record<(typeof stats)[number]["tint"], string> = {
    blue: "bg-accent/10 text-accent shadow-[0_0_20px_-6px_rgba(10,95,219,0.5)] group-hover:bg-accent group-hover:text-accent-fg",
    violet:
      "bg-violet-500/10 text-violet-600 shadow-[0_0_20px_-6px_rgba(139,92,246,0.5)] group-hover:bg-violet-500 group-hover:text-white",
    emerald:
      "bg-emerald-500/10 text-emerald-600 shadow-[0_0_20px_-6px_rgba(16,185,129,0.5)] group-hover:bg-emerald-500 group-hover:text-white",
    amber:
      "bg-amber-500/10 text-amber-600 shadow-[0_0_20px_-6px_rgba(245,158,11,0.5)] group-hover:bg-amber-500 group-hover:text-white",
    cyan: "bg-cyan-500/10 text-cyan-600 shadow-[0_0_20px_-6px_rgba(6,182,212,0.5)] group-hover:bg-cyan-500 group-hover:text-white",
    red: "bg-red-500/10 text-red-600 shadow-[0_0_20px_-6px_rgba(220,38,38,0.5)] group-hover:bg-red-500 group-hover:text-white",
    slate: "bg-fg-muted/10 text-fg-muted shadow-none group-hover:bg-fg-muted group-hover:text-white",
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Dashboard</h1>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group admin-glass flex items-center gap-4 rounded-[var(--radius-lg)] p-5 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.015] hover:border-accent/40 hover:shadow-xl hover:shadow-accent/10"
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${TINTS[s.tint]}`}
            >
              <s.icon size={20} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-extrabold tracking-tight text-fg">{s.value}</p>
              <p className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-wider text-fg-muted">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight text-fg">Últimos pedidos</h2>
          <Link href="/taller-control/pedidos" className="text-xs font-bold uppercase tracking-wide text-accent">
            Ver todos
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {recentOrders.map((order) => (
            <div
              key={order.id}
              className="group admin-glass flex items-center justify-between gap-4 rounded-xl px-5 py-3.5 transition-all duration-300 hover:-translate-y-0.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent transition-colors group-hover:bg-accent group-hover:text-accent-fg">
                  {order.customerName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{order.customerName}</p>
                  <p className="text-xs text-fg-muted">
                    {new Date(order.date).toLocaleDateString("es-PE", { dateStyle: "medium" })}
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-sm font-bold text-accent">S/. {order.total.toFixed(2)}</p>
            </div>
          ))}
          {recentOrders.length === 0 && (
            <p className="admin-glass rounded-xl px-5 py-8 text-center text-sm text-fg-muted">
              Todavía no hay pedidos.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
