import Link from "next/link";
import { Package, ShoppingBag, TrendingUp, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAdminOrders } from "./pedidos/actions";

const LOW_STOCK_THRESHOLD = 3;

export default async function AdminDashboardPage() {
  const [productCount, orderCount, revenueAgg, lowStockCount, recentOrders] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.product.count({ where: { stock: { lte: LOW_STOCK_THRESHOLD } } }),
    getAdminOrders().then((orders) => orders.slice(0, 5)),
  ]);

  const stats = [
    { icon: Package, label: "Productos", value: productCount, href: "/admin/productos" },
    { icon: ShoppingBag, label: "Pedidos", value: orderCount, href: "/admin/pedidos" },
    {
      icon: TrendingUp,
      label: "Ingresos totales",
      value: `S/. ${(revenueAgg._sum.total ?? 0).toFixed(2)}`,
      href: "/admin/pedidos",
    },
    {
      icon: AlertTriangle,
      label: "Stock bajo (≤3)",
      value: lowStockCount,
      href: "/admin/productos",
      warn: lowStockCount > 0,
    },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Dashboard</h1>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-[var(--radius-lg)] border border-border bg-bg-alt p-5 transition-colors hover:border-accent/40"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                s.warn ? "bg-red-50 text-red-600" : "bg-accent/10 text-accent"
              }`}
            >
              <s.icon size={16} strokeWidth={1.75} />
            </div>
            <p className="mt-4 text-2xl font-bold text-fg">{s.value}</p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-fg-muted">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight text-fg">Últimos pedidos</h2>
          <Link href="/admin/pedidos" className="text-xs font-bold uppercase tracking-wide text-accent">
            Ver todos
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {recentOrders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between rounded-xl border border-border bg-bg-alt px-5 py-3.5"
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
            <p className="rounded-xl border border-border bg-bg-alt px-5 py-8 text-center text-sm text-fg-muted">
              Todavía no hay pedidos.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
