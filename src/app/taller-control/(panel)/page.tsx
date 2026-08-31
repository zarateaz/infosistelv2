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
    { icon: Package, label: "Productos", value: productCount, href: "/taller-control/productos" },
    { icon: ShoppingBag, label: "Pedidos", value: orderCount, href: "/taller-control/pedidos" },
    {
      icon: TrendingUp,
      label: "Ingresos totales",
      value: `S/. ${(revenueAgg._sum.total ?? 0).toFixed(2)}`,
      href: "/taller-control/pedidos",
    },
    {
      icon: AlertTriangle,
      label: "Stock bajo (≤3)",
      value: lowStockCount,
      href: "/taller-control/productos",
      warn: lowStockCount > 0,
    },
    { icon: Wrench, label: "Reparaciones pendientes", value: pendingRepairCount, href: "/taller-control/reparaciones" },
    { icon: Wallet, label: "Caja de hoy", value: `S/. ${todayCajaTotal.toFixed(2)}`, href: "/taller-control/caja" },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Dashboard</h1>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group admin-glass rounded-[var(--radius-lg)] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/10"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-inner transition-colors ${
                s.warn
                  ? "bg-red-50 text-red-600 shadow-[0_0_16px_-4px_rgba(220,38,38,0.35)]"
                  : "bg-accent/10 text-accent shadow-[0_0_16px_-4px_rgba(10,95,219,0.35)] group-hover:bg-accent group-hover:text-accent-fg"
              }`}
            >
              <s.icon size={17} strokeWidth={1.75} />
            </div>
            <p className="mt-4 text-2xl font-bold text-fg">{s.value}</p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-fg-muted">{s.label}</p>
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
              className="flex items-center justify-between admin-glass rounded-xl px-5 py-3.5"
            >
              <div>
                <p className="text-sm font-semibold text-fg">{order.customerName}</p>
                <p className="text-xs text-fg-muted">
                  {new Date(order.date).toLocaleDateString("es-PE", { dateStyle: "medium" })}
                </p>
              </div>
              <p className="text-sm font-bold text-accent">S/. {order.total.toFixed(2)}</p>
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
