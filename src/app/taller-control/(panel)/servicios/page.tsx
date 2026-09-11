import Link from "next/link";
import { Search, Wallet, Clock3, ClipboardList, UserCheck } from "lucide-react";
import { getAdminServices, getServiceStats, getTechnicians, type StatsPeriod } from "./actions";
import { AddServiceForm } from "./AddServiceForm";
import { TechnicianManager } from "./TechnicianManager";
import { ServiceRow } from "./ServiceRow";
import { StatCard } from "../StatCard";

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "todo", label: "Todo" },
];

function buildHref(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return `/taller-control/servicios${s ? `?${s}` : ""}`;
}

export default async function AdminServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tecnico?: string; estado?: string; periodo?: string }>;
}) {
  const { q, tecnico, estado, periodo } = await searchParams;
  const period: StatsPeriod = (["hoy", "semana", "mes", "todo"] as const).includes(periodo as StatsPeriod)
    ? (periodo as StatsPeriod)
    : "todo";
  const paymentStatus = estado === "PAGADO" || estado === "PENDIENTE" ? estado : undefined;

  const [stats, technicians, allTechnicians, services] = await Promise.all([
    getServiceStats(period),
    getTechnicians(true),
    getTechnicians(false),
    getAdminServices({ q, technicianId: tecnico, paymentStatus, period }),
  ]);

  const statCards = [
    {
      icon: ClipboardList,
      label: `Servicios (${PERIODS.find((p) => p.value === period)?.label.toLowerCase()})`,
      value: stats.periodCount,
      tint: "blue" as const,
    },
    {
      icon: Wallet,
      label: `Cobrado (${PERIODS.find((p) => p.value === period)?.label.toLowerCase()})`,
      value: `S/. ${stats.periodPaidAmount.toFixed(2)}`,
      tint: "emerald" as const,
    },
    {
      icon: Clock3,
      label: "Pendiente de cobro (total)",
      value: `S/. ${stats.pendingAmount.toFixed(2)}`,
      warn: stats.pendingAmount > 0,
      tint: "amber" as const,
    },
    { icon: UserCheck, label: "Técnicos activos", value: stats.activeTechnicians, tint: "violet" as const },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Servicios técnicos</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {services.length} servicio{services.length === 1 ? "" : "s"} registrado{services.length === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-bg-alt p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={buildHref({ q, tecnico, estado, periodo: p.value })}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                period === p.value ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} tint={s.tint} warn={s.warn} />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AddServiceForm technicians={technicians} />
        <TechnicianManager technicians={allTechnicians} />
      </div>

      <form className="mt-8 flex flex-wrap items-center gap-3 admin-glass rounded-[var(--radius-lg)] p-4">
        <input type="hidden" name="periodo" value={period} />
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Buscar por cliente, trabajo o técnico..."
            className="w-full rounded-xl border border-border bg-bg-alt py-2.5 pl-10 pr-4 text-sm text-fg outline-none focus:border-accent"
          />
        </div>
        <select
          name="tecnico"
          defaultValue={tecnico ?? ""}
          className="rounded-xl border border-border bg-bg-alt px-4 py-2.5 text-sm text-fg outline-none focus:border-accent"
        >
          <option value="">Todos los técnicos</option>
          {allTechnicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          name="estado"
          defaultValue={estado ?? ""}
          className="rounded-xl border border-border bg-bg-alt px-4 py-2.5 text-sm text-fg outline-none focus:border-accent"
        >
          <option value="">Cualquier estado</option>
          <option value="PAGADO">Pagado</option>
          <option value="PENDIENTE">Pendiente</option>
        </select>
        <button
          type="submit"
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-fg transition-opacity hover:opacity-90"
        >
          Filtrar
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {services.map((service) => (
          <ServiceRow key={service.id} service={service} technicians={technicians} />
        ))}

        {services.length === 0 && (
          <div className="admin-glass rounded-[var(--radius-lg)] px-6 py-14 text-center text-fg-muted">
            {q || tecnico || estado ? "Ningún servicio coincide con esos filtros." : "Todavía no hay servicios registrados."}
          </div>
        )}
      </div>
    </div>
  );
}
