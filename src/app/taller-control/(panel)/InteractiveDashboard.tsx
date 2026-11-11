"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  Check,
  Copy,
  Layers,
  Package,
  Radio,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Wallet,
  Wifi,
  Wrench,
  X,
} from "lucide-react";
import { YapeIcon } from "@/components/icons/YapeIcon";
import { PAYMENT_METHODS, PAYMENT_METHOD_INFO, type PaymentMethodType } from "@/lib/paymentMethods";
import type { DashboardLiveSnapshot } from "@/lib/dashboardLive";
import type { AdminTransaction } from "./caja/actions";
import { CajaChart, type ChartFilterMode } from "./caja/CajaChart";
import { CriticalStockAlert } from "./CriticalStockAlert";

function money(n: number): string {
  return `S/. ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateUTC(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function formatTimeLima(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

const ACCOUNT_STYLES: Record<
  PaymentMethodType,
  {
    ringActive: string;
    cardHover: string;
    barColor: string;
    badgeBg: string;
    amountColor: string;
    glow: string;
  }
> = {
  EFECTIVO: {
    ringActive: "ring-2 ring-emerald-500 border-emerald-500/70 shadow-lg shadow-emerald-500/15",
    cardHover: "hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10",
    barColor: "bg-emerald-500",
    badgeBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    amountColor: "text-emerald-600 dark:text-emerald-400",
    glow: "from-emerald-500/10 via-transparent to-transparent",
  },
  "YAPE 1": {
    ringActive: "ring-2 ring-[#742284] border-[#742284]/70 shadow-lg shadow-[#742284]/15",
    cardHover: "hover:border-[#742284]/40 hover:shadow-lg hover:shadow-[#742284]/10",
    barColor: "bg-[#742284]",
    badgeBg: "bg-[#742284]/10 dark:bg-[#742284]/25 text-[#742284] dark:text-[#c084fc] border-[#742284]/20",
    amountColor: "text-[#742284] dark:text-[#c084fc]",
    glow: "from-[#742284]/10 via-transparent to-transparent",
  },
  "YAPE 2": {
    ringActive: "ring-2 ring-fuchsia-600 border-fuchsia-600/70 shadow-lg shadow-fuchsia-600/15",
    cardHover: "hover:border-fuchsia-500/40 hover:shadow-lg hover:shadow-fuchsia-500/10",
    barColor: "bg-fuchsia-600",
    badgeBg: "bg-fuchsia-500/10 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/20",
    amountColor: "text-fuchsia-700 dark:text-fuchsia-400",
    glow: "from-fuchsia-500/10 via-transparent to-transparent",
  },
};

const POLL_INTERVAL_MS = 5000;

export function InteractiveDashboard({
  initialData,
}: {
  initialData: DashboardLiveSnapshot;
}) {
  const [data, setData] = useState<DashboardLiveSnapshot>(initialData);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncError, setSyncError] = useState(false);

  const [scope, setScope] = useState<"MONTH" | "TODAY">("MONTH");
  const [selectedAccount, setSelectedAccount] = useState<PaymentMethodType | null>(null);
  const [chartMode, setChartMode] = useState<ChartFilterMode>("COMPARE");
  const [feedType, setFeedType] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [changedKeys, setChangedKeys] = useState<Record<string, boolean>>({});

  const prevBalancesRef = useRef<{
    total: number;
    EFECTIVO: number;
    "YAPE 1": number;
    "YAPE 2": number;
  }>({
    total: initialData.cashbox.totalBalance,
    EFECTIVO: initialData.cashbox.accounts.EFECTIVO.balance,
    "YAPE 1": initialData.cashbox.accounts["YAPE 1"].balance,
    "YAPE 2": initialData.cashbox.accounts["YAPE 2"].balance,
  });

  const fetchLive = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch("/api/dashboard-live", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next: DashboardLiveSnapshot = await res.json();

      // Detectar cambios para animar el pulso en las tarjetas actualizadas
      const prev = prevBalancesRef.current;
      const changed: Record<string, boolean> = {};
      if (Math.abs(next.cashbox.totalBalance - prev.total) > 0.001) changed.total = true;
      for (const m of PAYMENT_METHODS) {
        if (Math.abs(next.cashbox.accounts[m].balance - prev[m]) > 0.001) {
          changed[m] = true;
        }
      }
      prevBalancesRef.current = {
        total: next.cashbox.totalBalance,
        EFECTIVO: next.cashbox.accounts.EFECTIVO.balance,
        "YAPE 1": next.cashbox.accounts["YAPE 1"].balance,
        "YAPE 2": next.cashbox.accounts["YAPE 2"].balance,
      };

      setData(next);
      setSyncError(false);

      if (Object.keys(changed).length > 0) {
        setChangedKeys(changed);
        setTimeout(() => setChangedKeys({}), 1800);
      }
    } catch {
      setSyncError(true);
    } finally {
      if (manual) setIsRefreshing(false);
    }
  }, []);

  // Sondeo en tiempo real cada 5s cuando la pestaña está activa
  useEffect(() => {
    if (!liveEnabled) return;

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchLive(false);
      }
    }, POLL_INTERVAL_MS);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void fetchLive(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [liveEnabled, fetchLive]);

  const handleSelectAccount = (method: PaymentMethodType) => {
    if (selectedAccount === method) {
      setSelectedAccount(null);
      setChartMode("COMPARE");
    } else {
      setSelectedAccount(method);
      setChartMode(method);
    }
  };

  const handleChartModeChange = (mode: ChartFilterMode) => {
    setChartMode(mode);
    if (mode === "EFECTIVO" || mode === "YAPE 1" || mode === "YAPE 2") {
      setSelectedAccount(mode);
    } else {
      setSelectedAccount(null);
    }
  };

  const copyPhone = async (e: React.MouseEvent, id: string, text: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // portapapeles no disponible
    }
  };

  // Convertir transacciones a AdminTransaction para reutilizar CajaChart con seguridad de tipos
  const chartTransactions = useMemo<AdminTransaction[]>(() => {
    const base =
      scope === "TODAY"
        ? data.cashbox.transactions.filter((t) => t.date.slice(0, 10) === data.todayStr)
        : data.cashbox.transactions;
    return base.map((t) => ({
      ...t,
      date: new Date(t.date),
    }));
  }, [data.cashbox.transactions, data.todayStr, scope]);

  // Feed en vivo (orden inverso: lo más reciente arriba)
  const liveFeed = useMemo(() => {
    let rows = [...data.cashbox.transactions];
    if (scope === "TODAY") {
      rows = rows.filter((t) => t.date.slice(0, 10) === data.todayStr);
    }
    if (selectedAccount) {
      rows = rows.filter((t) => t.paymentMethod === selectedAccount);
    }
    if (feedType !== "ALL") {
      rows = rows.filter((t) => t.type === feedType);
    }
    return rows.reverse().slice(0, 12);
  }, [data.cashbox.transactions, data.todayStr, scope, selectedAccount, feedType]);

  const heroBalance = scope === "TODAY" ? data.cashbox.todayNet : data.cashbox.totalBalance;
  const heroIncome = scope === "TODAY" ? data.cashbox.todayIncome : data.cashbox.totalIncome;
  const heroExpense = scope === "TODAY" ? data.cashbox.todayExpense : data.cashbox.totalExpense;
  const heroCount = scope === "TODAY" ? data.cashbox.todayCount : data.cashbox.totalCount;

  const { operations } = data;
  const lastUpdatedText = formatTimeLima(data.generatedAt);

  return (
    <div className="space-y-6 pb-10">
      {/* ── 1. HEADER COMANDO EN VIVO ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-fg">
              Dashboard Interactivo
            </h1>
            <button
              type="button"
              onClick={() => setLiveEnabled((v) => !v)}
              title={liveEnabled ? "Sincronización automática cada 5s activa (clic para pausar)" : "Sincronización pausada (clic para activar)"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                syncError
                  ? "border-red-500/40 bg-red-500/10 text-red-600"
                  : liveEnabled
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-border bg-bg-alt text-fg-muted"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  syncError
                    ? "bg-red-500"
                    : liveEnabled
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-fg-muted"
                }`}
              />
              {syncError ? "Sin conexión" : liveEnabled ? "En vivo · 5s" : "Pausado"}
            </button>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-fg-muted">
            Saldos de <strong className="text-fg">Efectivo, Yape 1 y Yape 2</strong> en tiempo real ·{" "}
            <span className="font-medium">Actualizado {lastUpdatedText} (Lima)</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Switch Mes Actual vs Hoy */}
          <div className="inline-flex rounded-xl border border-border/80 bg-bg-alt/80 p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setScope("MONTH")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                scope === "MONTH"
                  ? "bg-accent text-accent-fg shadow-xs"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {data.monthLabel}
            </button>
            <button
              type="button"
              onClick={() => setScope("TODAY")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                scope === "TODAY"
                  ? "bg-accent text-accent-fg shadow-xs"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              Solo Hoy ({data.todayLabel})
            </button>
          </div>

          <button
            type="button"
            onClick={() => void fetchLive(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-bg-surface px-3.5 py-2 text-xs font-bold text-fg shadow-xs transition-all hover:border-accent/50 hover:text-accent disabled:opacity-60"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-accent" : ""} />
            <span>Actualizar</span>
          </button>

          <Link
            href="/taller-control/caja"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-accent-hover px-4 py-2 text-xs font-extrabold text-accent-fg shadow-md shadow-accent/25 transition-all hover:scale-[1.02]"
          >
            <Wallet size={14} />
            <span>Abrir Caja</span>
          </Link>
        </div>
      </div>

      {/* ── 2. HERO BANNER: LIQUIDEZ TOTAL + BARRA DE DISTRIBUCIÓN ─────── */}
      <section
        className={`relative overflow-hidden rounded-[var(--radius-lg)] border bg-bg-surface/90 p-5 sm:p-6 shadow-md backdrop-blur-md transition-all duration-500 ${
          changedKeys.total ? "border-emerald-500/70 ring-2 ring-emerald-500/20" : "border-border"
        }`}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-[#742284]/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg-muted">
              <Radio size={14} className="text-emerald-500 animate-pulse" />
              <span>
                {scope === "TODAY"
                  ? `Flujo neto de hoy (${data.todayLabel})`
                  : `Saldo neto consolidado — ${data.monthLabel}`}
              </span>
              <span className="rounded-full bg-bg-alt px-2 py-0.5 text-[10px] font-extrabold text-fg-muted border border-border/60">
                {heroCount} movs.
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <p
                className={`font-display text-3xl sm:text-4xl font-black tracking-tight transition-colors duration-300 ${
                  heroBalance >= 0 ? "text-fg" : "text-red-600 dark:text-red-400"
                }`}
              >
                {money(heroBalance)}
              </p>
              {changedKeys.total && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 animate-bounce">
                  ¡Saldo actualizado!
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-4">
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                <ArrowUpRight size={13} /> Ingresos
              </p>
              <p className="mt-0.5 font-display text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
                + {money(heroIncome)}
              </p>
            </div>
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
                <ArrowDownRight size={13} /> Egresos
              </p>
              <p className="mt-0.5 font-display text-lg font-extrabold text-red-700 dark:text-red-300">
                - {money(heroExpense)}
              </p>
            </div>
          </div>
        </div>

        {/* Barra de distribución porcentual entre las 3 cuentas */}
        {scope === "MONTH" && (
          <div className="relative mt-5 pt-4 border-t border-border/60">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-fg-muted">
              <span>Distribución de liquidez entre las 3 cuentas</span>
              <div className="flex flex-wrap items-center gap-3">
                {PAYMENT_METHODS.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${ACCOUNT_STYLES[m].barColor}`} />
                    <span>
                      {PAYMENT_METHOD_INFO[m].name}: {data.cashbox.accounts[m].sharePct.toFixed(1)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-bg-alt p-0.5 border border-border/50">
              {PAYMENT_METHODS.map((m) => {
                const pct = data.cashbox.accounts[m].sharePct;
                if (pct <= 0) return null;
                return (
                  <div
                    key={m}
                    style={{ width: `${pct}%` }}
                    title={`${PAYMENT_METHOD_INFO[m].name}: ${money(data.cashbox.accounts[m].balance)} (${pct}%)`}
                    className={`h-full first:rounded-l-full last:rounded-r-full transition-all duration-700 ${ACCOUNT_STYLES[m].barColor}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── 3. LAS 3 TARJETAS DE SALDO EN TIEMPO REAL ────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-fg-muted">
              Saldos en vivo por cuenta
            </h2>
            <span className="hidden sm:inline text-xs text-fg-muted">
              · Haz clic en una cuenta para filtrar el gráfico y los movimientos
            </span>
          </div>
          {selectedAccount && (
            <button
              type="button"
              onClick={() => {
                setSelectedAccount(null);
                setChartMode("COMPARE");
              }}
              className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent hover:bg-accent/20"
            >
              <X size={13} />
              Mostrar las 3 cuentas
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PAYMENT_METHODS.map((method) => {
            const info = PAYMENT_METHOD_INFO[method];
            const acc = data.cashbox.accounts[method];
            const st = ACCOUNT_STYLES[method];
            const isSelected = selectedAccount === method;
            const justUpdated = Boolean(changedKeys[method]);

            const shownBalance = scope === "TODAY" ? acc.todayNet : acc.balance;
            const shownIncome = scope === "TODAY" ? acc.todayIncome : acc.income;
            const shownExpense = scope === "TODAY" ? acc.todayExpense : acc.expense;
            const shownCount = scope === "TODAY" ? acc.todayCount : acc.count;

            return (
              <div
                key={method}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectAccount(method)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectAccount(method);
                  }
                }}
                className={`group relative cursor-pointer overflow-hidden rounded-[var(--radius-lg)] border bg-bg-surface/95 p-5 transition-all duration-300 hover:-translate-y-1 ${
                  isSelected
                    ? st.ringActive
                    : justUpdated
                      ? "border-emerald-400 ring-2 ring-emerald-400/30"
                      : `border-border ${st.cardHover}`
                }`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${st.glow} opacity-80`} />

                <div className="relative">
                  {/* Top Row: Icon + Name + Movs badge / Phone */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {method === "EFECTIVO" ? (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs">
                          <Banknote size={22} />
                        </div>
                      ) : (
                        <YapeIcon size={44} className="shrink-0 rounded-2xl shadow-xs" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-fg-muted">
                            {info.id}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-bg-alt px-2 py-0.5 text-[10px] font-bold text-fg-muted border border-border/60">
                            {shownCount} movs.
                          </span>
                        </div>
                        <p className="font-display text-sm font-extrabold text-fg">
                          {method === "EFECTIVO" ? "Caja física del taller" : info.titular}
                        </p>
                      </div>
                    </div>

                    {info.phone && info.formattedPhone && (
                      <button
                        type="button"
                        onClick={(e) => void copyPhone(e, method, info.phone!)}
                        title="Copiar número Yape"
                        className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-bg-alt/80 px-2 py-1 text-[11px] font-mono font-bold text-fg-muted transition-colors hover:border-accent/40 hover:text-fg"
                      >
                        <span>{info.formattedPhone}</span>
                        {copiedId === method ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <Copy size={11} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Balance Hero */}
                  <div className="mt-4 flex items-baseline justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                        {scope === "TODAY" ? "Variación de hoy" : `Saldo ${info.name}`}
                      </p>
                      <p
                        className={`mt-0.5 font-display text-2xl sm:text-3xl font-black tracking-tight ${
                          shownBalance < 0 ? "text-red-600 dark:text-red-400" : "text-fg"
                        }`}
                      >
                        {money(shownBalance)}
                      </p>
                    </div>

                    {scope === "MONTH" && (
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                          acc.todayNet > 0
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : acc.todayNet < 0
                              ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                              : "border-border/60 bg-bg-alt text-fg-muted"
                        }`}
                      >
                        {acc.todayCount === 0
                          ? "Hoy: S/. 0.00"
                          : `Hoy: ${acc.todayNet >= 0 ? "+" : ""}${money(acc.todayNet)}`}
                      </span>
                    )}
                  </div>

                  {/* Ingresos vs Egresos Inset */}
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-bg-alt/60 p-2.5 text-xs">
                    <div>
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        <ArrowUpRight size={12} /> Ingresos
                      </span>
                      <span className="mt-0.5 block font-bold text-fg">
                        + {money(shownIncome)}
                      </span>
                    </div>
                    <div className="border-l border-border/60 pl-2.5">
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                        <ArrowDownRight size={12} /> Egresos
                      </span>
                      <span className="mt-0.5 block font-bold text-fg">
                        - {money(shownExpense)}
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-fg-muted">
                    <span>
                      {scope === "MONTH" ? `${acc.sharePct.toFixed(1)}% del saldo total` : `${acc.todayCount} movs. hoy`}
                    </span>
                    <span className={`font-bold ${isSelected ? st.amountColor : "group-hover:text-accent"}`}>
                      {isSelected ? "✓ Filtrando vista" : "Clic para filtrar →"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 4. GRÁFICO MULTI-CUENTA + FEED DE MOVIMIENTOS EN VIVO ──────── */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Gráfico Interactivo (7 columnas) */}
        <div className="xl:col-span-7 rounded-[var(--radius-lg)] border border-border bg-bg-surface/95 p-5 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base sm:text-lg font-extrabold text-fg">
                Evolución de Saldos en Tiempo Real
              </h2>
              <p className="text-xs text-fg-muted">
                {scope === "TODAY" ? `Movimientos de hoy (${data.todayLabel})` : data.monthLabel}
              </p>
            </div>
            <Link
              href="/taller-control/reporte-mensual"
              className="text-xs font-bold text-accent hover:underline"
            >
              Ver reporte mensual →
            </Link>
          </div>

          <CajaChart
            transactions={chartTransactions}
            activeFilter={chartMode}
            onFilterChange={handleChartModeChange}
          />
        </div>

        {/* Live Movements Feed (5 columnas) */}
        <div className="xl:col-span-5 flex flex-col rounded-[var(--radius-lg)] border border-border bg-bg-surface/95 p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base sm:text-lg font-extrabold text-fg flex items-center gap-2">
                <Activity size={18} className="text-accent" />
                <span>Actividad en Vivo</span>
              </h2>
              <p className="text-xs text-fg-muted">
                {selectedAccount ? `Solo ${PAYMENT_METHOD_INFO[selectedAccount].name}` : "Últimos movimientos de las 3 cuentas"}
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-bg-alt/70 p-0.5">
              {(
                [
                  ["ALL", "Todos"],
                  ["INCOME", "Ingresos"],
                  ["EXPENSE", "Egresos"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFeedType(key)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    feedType === key ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto max-h-[340px] pr-1">
            {liveFeed.map((t) => {
              const isIncome = t.type === "INCOME";
              const method = t.paymentMethod as PaymentMethodType;
              const badgeCls =
                ACCOUNT_STYLES[method]?.badgeBg ?? "bg-bg-alt text-fg-muted border-border";

              return (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-bg-alt/40 px-3.5 py-2.5 transition-colors hover:border-accent/40 hover:bg-bg-alt/80"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        isIncome
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-red-500/15 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isIncome ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs sm:text-sm font-bold text-fg">
                        {t.description}
                      </p>
                      {t.notes && (
                        <p className="truncate text-[11px] text-fg-muted" title={t.notes}>
                          {t.notes}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-fg-muted">
                        <span className="font-mono">{formatDateUTC(t.date)}</span>
                        <span>·</span>
                        <span className={`rounded-md border px-1.5 py-0.2 font-bold ${badgeCls}`}>
                          {t.paymentMethod}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p
                    className={`shrink-0 font-display text-xs sm:text-sm font-extrabold ${
                      isIncome
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {isIncome ? "+" : "-"} {money(t.amount)}
                  </p>
                </div>
              );
            })}

            {liveFeed.length === 0 && (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-xs text-fg-muted">
                No hay movimientos con los filtros seleccionados.
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
            <span className="text-fg-muted">Mostrando los más recientes</span>
            <Link href="/taller-control/caja" className="font-bold text-accent hover:underline">
              Ver todos en Caja ({data.cashbox.totalCount}) →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 5. ALERTAS DE STOCK + RADAR OPERATIVO DEL NEGOCIO ──────────── */}
      <CriticalStockAlert products={operations.products.lowStockItems} />

      <section>
        <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-fg-muted">
          Radar Operativo en Vivo
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* Servicios Técnicos */}
          <Link
            href="/taller-control/servicios"
            className="group admin-glass flex flex-col justify-between rounded-[var(--radius-lg)] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/40"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <Wrench size={18} />
              </div>
              {operations.serviciosTecnicos.listos > 0 && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                  {operations.serviciosTecnicos.listos} listos
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="font-display text-2xl font-extrabold text-fg">
                {operations.serviciosTecnicos.activos}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                Servicios en taller
              </p>
              <p className="mt-1 text-[11px] text-fg-muted">
                Cobrado hoy: <strong className="text-fg">{money(operations.serviciosTecnicos.cobradoHoy)}</strong>
              </p>
            </div>
          </Link>

          {/* Deudas y Obligaciones */}
          <Link
            href="/taller-control/deudas"
            className="group admin-glass flex flex-col justify-between rounded-[var(--radius-lg)] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/40"
          >
            <div className="flex items-center justify-between">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  operations.deudas.vencidasCount > 0
                    ? "bg-red-500/15 text-red-600"
                    : "bg-amber-500/10 text-amber-600"
                }`}
              >
                <CalendarClock size={18} />
              </div>
              {operations.deudas.vencidasCount > 0 && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-extrabold text-red-600 animate-pulse">
                  {operations.deudas.vencidasCount} vencidas
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="font-display text-2xl font-extrabold text-fg">
                {operations.deudas.pendientesCount}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                Deudas pendientes
              </p>
              <p className="mt-1 text-[11px] text-fg-muted">
                Por pagar: <strong className="text-fg">{money(operations.deudas.montoPendiente)}</strong>
              </p>
            </div>
          </Link>

          {/* Cobranza Internet */}
          <Link
            href="/taller-control/cobranza-internet"
            className="group admin-glass flex flex-col justify-between rounded-[var(--radius-lg)] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600">
                <Wifi size={18} />
              </div>
              {operations.cobranzaInternet.deudoresCount > 0 && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-extrabold text-red-600">
                  {operations.cobranzaInternet.deudoresCount} deudores
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="font-display text-2xl font-extrabold text-fg">
                {operations.cobranzaInternet.totalClientes}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                Clientes Internet
              </p>
              <p className="mt-1 text-[11px] text-fg-muted">
                Al día: <strong className="text-emerald-600">{operations.cobranzaInternet.alDiaCount}</strong>
              </p>
            </div>
          </Link>

          {/* Inventario / Stock */}
          <Link
            href="/taller-control/productos"
            className="group admin-glass flex flex-col justify-between rounded-[var(--radius-lg)] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40"
          >
            <div className="flex items-center justify-between">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  operations.products.lowStockCount > 0
                    ? "bg-red-500/10 text-red-600"
                    : "bg-violet-500/10 text-violet-600"
                }`}
              >
                {operations.products.lowStockCount > 0 ? <AlertTriangle size={18} /> : <Package size={18} />}
              </div>
              {operations.products.lowStockCount > 0 && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-extrabold text-red-600">
                  {operations.products.lowStockCount} stock bajo
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="font-display text-2xl font-extrabold text-fg">
                {operations.products.total}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                Productos en catálogo
              </p>
              <p className="mt-1 text-[11px] text-fg-muted">
                Alertas (≤3): <strong className="text-fg">{operations.products.lowStockCount}</strong>
              </p>
            </div>
          </Link>

          {/* Pedidos Web */}
          <Link
            href="/taller-control/pedidos"
            className="group admin-glass flex flex-col justify-between rounded-[var(--radius-lg)] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <ShoppingBag size={18} />
              </div>
              <TrendingUp size={16} className="text-emerald-500" />
            </div>
            <div className="mt-3">
              <p className="font-display text-2xl font-extrabold text-fg">
                {operations.orders.total}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                Pedidos web
              </p>
              <p className="mt-1 text-[11px] text-fg-muted">
                Total: <strong className="text-fg">{money(operations.orders.revenue)}</strong>
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* ── 6. ÚLTIMOS PEDIDOS WEB ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight text-fg flex items-center gap-2">
            <Layers size={18} className="text-accent" />
            <span>Últimos pedidos web</span>
          </h2>
          <Link href="/taller-control/pedidos" className="text-xs font-bold uppercase tracking-wide text-accent hover:underline">
            Ver todos
          </Link>
        </div>

        <div className="mt-3 space-y-2.5">
          {operations.orders.recent.map((order) => (
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
              <p className="shrink-0 text-sm font-bold text-accent">{money(order.total)}</p>
            </div>
          ))}
          {operations.orders.recent.length === 0 && (
            <p className="admin-glass rounded-xl px-5 py-8 text-center text-sm text-fg-muted">
              Todavía no hay pedidos registrados.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
