"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  X,
  Download,
  TrendingUp,
  ListFilter,
  RotateCcw,
  ShieldCheck,
  Wallet,
  Layers,
} from "lucide-react";
import { YapeIcon } from "@/components/icons/YapeIcon";
import { PAYMENT_METHOD_INFO, PAYMENT_METHODS, type PaymentMethodType } from "./constants";
import type { AdminTransaction } from "./actions";
import { CajaChart, type ChartFilterMode } from "./CajaChart";
import { generateCashboxReportPDF } from "@/lib/pdfReportGenerator";
import { AnimatedMoney } from "@/components/ui/AnimatedMoney";

interface CashboxMethodCardsProps {
  totals: Record<PaymentMethodType, number>;
  periodLabel: string;
  monthKey: string;
  transactions: AdminTransaction[];
  selectedAccount?: PaymentMethodType | null;
  onSelectAccount?: (account: PaymentMethodType | null) => void;
}

interface MethodStats {
  income: number;
  expense: number;
  net: number;
  count: number;
}

function formatDateUTC(date: Date | string): string {
  const d = new Date(date);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function CashboxMethodCards({
  totals,
  periodLabel,
  monthKey,
  transactions,
  selectedAccount: controlledAccount,
  onSelectAccount,
}: CashboxMethodCardsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [internalAccount, setInternalAccount] = useState<PaymentMethodType | null>(null);
  const [previewModalAccount, setPreviewModalAccount] = useState<PaymentMethodType | null>(null);
  const [chartMode, setChartMode] = useState<ChartFilterMode>("ALL");

  const selectedAccount = controlledAccount !== undefined ? controlledAccount : internalAccount;
  const updateSelectedAccount = (next: PaymentMethodType | null) => {
    setInternalAccount(next);
    onSelectAccount?.(next);
  };

  const copyNumber = async (id: string, number: string) => {
    try {
      await navigator.clipboard.writeText(number);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  // Compute detailed stats (income, expense, net, count) per payment method
  const statsByMethod = useMemo(() => {
    const map: Record<PaymentMethodType, MethodStats> = {
      EFECTIVO: { income: 0, expense: 0, net: totals["EFECTIVO"] ?? 0, count: 0 },
      "YAPE 1": { income: 0, expense: 0, net: totals["YAPE 1"] ?? 0, count: 0 },
      "YAPE 2": { income: 0, expense: 0, net: totals["YAPE 2"] ?? 0, count: 0 },
    };

    for (const t of transactions) {
      const m = t.paymentMethod as PaymentMethodType;
      if (!map[m]) continue;
      map[m].count += 1;
      if (t.type === "INCOME") map[m].income += t.amount;
      else map[m].expense += t.amount;
    }

    for (const m of PAYMENT_METHODS) {
      map[m].net = map[m].income - map[m].expense;
    }

    return map;
  }, [transactions, totals]);

  const totalGeneral = useMemo(
    () =>
      (statsByMethod["EFECTIVO"]?.net ?? 0) +
      (statsByMethod["YAPE 1"]?.net ?? 0) +
      (statsByMethod["YAPE 2"]?.net ?? 0),
    [statsByMethod]
  );

  const totalIncomeGeneral = useMemo(
    () =>
      (statsByMethod["EFECTIVO"]?.income ?? 0) +
      (statsByMethod["YAPE 1"]?.income ?? 0) +
      (statsByMethod["YAPE 2"]?.income ?? 0),
    [statsByMethod]
  );

  const totalExpenseGeneral = useMemo(
    () =>
      (statsByMethod["EFECTIVO"]?.expense ?? 0) +
      (statsByMethod["YAPE 1"]?.expense ?? 0) +
      (statsByMethod["YAPE 2"]?.expense ?? 0),
    [statsByMethod]
  );

  // Positive weight percentages for visual distribution bar
  const shareByMethod = useMemo(() => {
    const posCash = Math.max(0, statsByMethod["EFECTIVO"].net);
    const posY1 = Math.max(0, statsByMethod["YAPE 1"].net);
    const posY2 = Math.max(0, statsByMethod["YAPE 2"].net);
    const sumPos = posCash + posY1 + posY2;
    if (sumPos <= 0) {
      return { EFECTIVO: 33.3, "YAPE 1": 33.3, "YAPE 2": 33.4 };
    }
    return {
      EFECTIVO: (posCash / sumPos) * 100,
      "YAPE 1": (posY1 / sumPos) * 100,
      "YAPE 2": (posY2 / sumPos) * 100,
    };
  }, [statsByMethod]);

  // Select card to filter chart & show inline account preview
  const handleSelectCard = (method: PaymentMethodType) => {
    if (selectedAccount === method) {
      updateSelectedAccount(null);
      setChartMode("ALL");
    } else {
      updateSelectedAccount(method);
      setChartMode(method);
    }
  };

  // Transactions with independent running balance for the modal or active preview
  const activeAccountForPreview = previewModalAccount ?? selectedAccount;
  const accountLedger = useMemo(() => {
    if (!activeAccountForPreview) return [];
    let running = 0;
    const rows = transactions
      .filter((t) => t.paymentMethod === activeAccountForPreview)
      .map((t) => {
        const isInc = t.type === "INCOME";
        running += isInc ? t.amount : -t.amount;
        return {
          ...t,
          isInc,
          runningAfter: running,
        };
      });
    return rows.reverse();
  }, [transactions, activeAccountForPreview]);

  const handleDownloadAccountPDF = (method: PaymentMethodType) => {
    const info = PAYMENT_METHOD_INFO[method];
    const filtered = transactions.filter((t) => t.paymentMethod === method);
    generateCashboxReportPDF({
      month: `${monthKey}_${method.replace(/\s+/g, "")}`,
      monthLabel: `${periodLabel} — Solo ${info.name} (${info.titular})`,
      responsible: info.titular,
      transactions: filtered,
    });
  };

  const yape1 = PAYMENT_METHOD_INFO["YAPE 1"];
  const yape2 = PAYMENT_METHOD_INFO["YAPE 2"];

  return (
    <div>
      {/* HERO CONSOLIDADO */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-[#070d1f] via-[#0d1836] to-[#171238] p-6 text-white shadow-2xl">
        {/* Luces ambientales decorativas */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-purple-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          {/* Columna Izquierda: Saldo Consolidado */}
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300 shadow-sm">
                <Layers size={12} className="text-emerald-300" />
                3 Cuentas Sincronizadas
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-bold text-cyan-200">
                {transactions.length} operaciones en {periodLabel}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-baseline gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-300">
                  Liquidez Total Consolidada ({periodLabel})
                </p>
                <div className="mt-1 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
                  <AnimatedMoney value={totalGeneral} />
                </div>
              </div>

              {/* Tarjetas de Ingresos y Egresos Globales */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 backdrop-blur-xs">
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    <ArrowUpRight size={13} /> Ingresos Totales
                  </span>
                  <p className="mt-0.5 font-mono text-base font-black text-emerald-200">
                    <AnimatedMoney value={totalIncomeGeneral} prefix="+ S/. " />
                  </p>
                </div>

                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 backdrop-blur-xs">
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-300">
                    <ArrowDownRight size={13} /> Egresos Totales
                  </span>
                  <p className="mt-0.5 font-mono text-base font-black text-rose-200">
                    <AnimatedMoney value={totalExpenseGeneral} prefix="- S/. " />
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Controles de Comparativa */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                updateSelectedAccount(null);
                setChartMode(chartMode === "COMPARE" ? "ALL" : "COMPARE");
              }}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition-colors ${
                chartMode === "COMPARE"
                  ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-fuchsia-600/30"
                  : "border border-white/20 bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <TrendingUp size={14} />
              <span>
                {chartMode === "COMPARE" ? "Viendo las 3 curvas" : "Comparar las 3 en gráfico"}
              </span>
            </button>

            {selectedAccount && (
              <button
                type="button"
                onClick={() => {
                  updateSelectedAccount(null);
                  setChartMode("ALL");
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-400/40 bg-amber-400/20 px-3.5 py-2.5 text-xs font-extrabold text-amber-200 transition-colors hover:bg-amber-400 hover:text-slate-950"
              >
                <RotateCcw size={13} />
                <span>Ver todas</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Distribución de Liquidez por Cuenta (Efectivo | Yape 1 | Yape 2) */}
        <div className="relative z-10 mt-6 border-t border-white/10 pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-extrabold uppercase tracking-wider text-slate-300">
              <Wallet size={13} className="text-emerald-400" />
              Distribución de Liquidez por Cuenta (Clic para filtrar)
            </span>
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => handleSelectCard("EFECTIVO")}
                className="inline-flex items-center gap-1.5 text-emerald-300 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                Efectivo: {shareByMethod.EFECTIVO.toFixed(1)}%
              </button>
              <button
                type="button"
                onClick={() => handleSelectCard("YAPE 1")}
                className="inline-flex items-center gap-1.5 text-purple-300 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-[#a855f7]" />
                Yape 1 (Edgar): {shareByMethod["YAPE 1"].toFixed(1)}%
              </button>
              <button
                type="button"
                onClick={() => handleSelectCard("YAPE 2")}
                className="inline-flex items-center gap-1.5 text-fuchsia-300 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-400" />
                Yape 2 (Caja): {shareByMethod["YAPE 2"].toFixed(1)}%
              </button>
            </div>
          </div>

          <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-900/90 p-0.5 ring-1 ring-white/15">
            <div
              onClick={() => handleSelectCard("EFECTIVO")}
              style={{ width: `${shareByMethod.EFECTIVO}%` }}
              className="h-full cursor-pointer rounded-l-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110"
              title={`Efectivo: S/. ${statsByMethod["EFECTIVO"].net.toFixed(2)} (${shareByMethod.EFECTIVO.toFixed(1)}%)`}
            />
            <div
              onClick={() => handleSelectCard("YAPE 1")}
              style={{ width: `${shareByMethod["YAPE 1"]}%` }}
              className="h-full cursor-pointer bg-gradient-to-r from-[#742284] to-purple-500 hover:brightness-110"
              title={`Yape 1 (Edgar): S/. ${statsByMethod["YAPE 1"].net.toFixed(2)} (${shareByMethod["YAPE 1"].toFixed(1)}%)`}
            />
            <div
              onClick={() => handleSelectCard("YAPE 2")}
              style={{ width: `${shareByMethod["YAPE 2"]}%` }}
              className="h-full cursor-pointer rounded-r-full bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:brightness-110"
              title={`Yape 2 (Caja): S/. ${statsByMethod["YAPE 2"].net.toFixed(2)} (${shareByMethod["YAPE 2"].toFixed(1)}%)`}
            />
          </div>
        </div>
      </div>

      {/* Subtítulo de sección de tarjetas */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-fg">
            Saldos Independientes por Método de Pago
          </span>
          <span className="hidden sm:inline-block text-xs text-fg-muted">
            · Haz clic en cualquier tarjeta para filtrar su curva o inspeccionar su extracto
          </span>
        </div>
      </div>

      {/* Las 3 Tarjetas de Cuenta */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {/* 1. Tarjeta EFECTIVO */}
        <div
          onClick={() => handleSelectCard("EFECTIVO")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleSelectCard("EFECTIVO");
          }}
          className={`group admin-glass relative cursor-pointer overflow-hidden rounded-3xl p-5 transition-colors ${
            selectedAccount === "EFECTIVO"
              ? "ring-2 ring-emerald-500 border-emerald-500 shadow-xl shadow-emerald-500/20 bg-emerald-500/[0.04]"
              : "border-emerald-500/25 hover:border-emerald-500/60 hover:shadow-xl hover:shadow-emerald-500/15"
          }`}
        >
          {/* Barra superior luminosa */}
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="flex items-start justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/35">
                <Banknote size={24} strokeWidth={2.3} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Efectivo
                </p>
                <p className="text-xs font-bold text-fg">Caja física del taller</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                {statsByMethod["EFECTIVO"].count} movs.
              </span>
              <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {shareByMethod.EFECTIVO.toFixed(1)}% del total
              </span>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-fg-muted">
                Saldo disponible
              </span>
              {selectedAccount === "EFECTIVO" && (
                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
                  ● Filtro activo
                </span>
              )}
            </div>
            <p className="mt-1 font-display text-3xl font-black tracking-tight text-fg sm:text-4xl">
              <AnimatedMoney value={statsByMethod["EFECTIVO"].net} />
            </p>
          </div>

          {/* Barra de participación */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/15">
            <div
              style={{ width: `${shareByMethod.EFECTIVO}%` }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
            />
          </div>

          {/* Desglose Ingresos / Egresos de Efectivo */}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-xs">
            <div>
              <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400">
                <ArrowUpRight size={12} /> Ingresos
              </span>
              <p className="mt-0.5 font-mono font-black text-fg">
                <AnimatedMoney value={statsByMethod["EFECTIVO"].income} prefix="+ S/. " />
              </p>
            </div>
            <div className="border-l border-emerald-500/20 pl-2.5">
              <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-red-600 dark:text-red-400">
                <ArrowDownRight size={12} /> Egresos
              </span>
              <p className="mt-0.5 font-mono font-black text-fg">
                <AnimatedMoney value={statsByMethod["EFECTIVO"].expense} prefix="- S/. " />
              </p>
            </div>
          </div>

          {/* Acciones rápidas de la tarjeta */}
          <div className="mt-3.5 flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-medium text-fg-muted truncate">
              Billetes y monedas ({periodLabel})
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewModalAccount("EFECTIVO");
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 transition-all hover:bg-emerald-600 hover:text-white shadow-2xs"
            >
              <Eye size={12} />
              <span>Previsualizar</span>
            </button>
          </div>
        </div>

        {/* 2. Tarjeta YAPE 1 — Edgar Caballero */}
        <div
          onClick={() => handleSelectCard("YAPE 1")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleSelectCard("YAPE 1");
          }}
          className={`group admin-glass relative cursor-pointer overflow-hidden rounded-3xl p-5 transition-colors ${
            selectedAccount === "YAPE 1"
              ? "ring-2 ring-[#742284] border-[#742284] shadow-xl shadow-[#742284]/25 bg-[#742284]/[0.05]"
              : "border-[#742284]/30 dark:border-[#742284]/50 hover:border-[#742284] hover:shadow-xl hover:shadow-[#742284]/20"
          }`}
        >
          {/* Barra superior luminosa */}
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#742284] via-purple-500 to-[#00D4B8]" />
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#742284]/15 blur-2xl" />

          <div className="flex items-start justify-between gap-2 pt-1">
            <div className="flex items-center gap-3">
              <div className="shrink-0 rounded-2xl p-0.5">
                <YapeIcon size={46} className="shadow-lg shadow-[#742284]/30" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-[#742284] dark:text-[#c084fc]">
                    Yape 1
                  </span>
                  <span className="rounded-full bg-[#742284]/15 px-2 py-0.2 text-[10px] font-black text-[#742284] dark:text-[#e9d5ff] tabular-nums">
                    {statsByMethod["YAPE 1"].count} movs.
                  </span>
                </div>
                <p className="text-sm font-extrabold text-fg leading-tight mt-0.5">{yape1.titular}</p>
              </div>
            </div>

            {/* Chip interactivo para copiar número */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                copyNumber("yape1", yape1.phone || "");
              }}
              title="Clic para copiar número"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#742284]/30 bg-[#742284]/10 dark:bg-[#742284]/25 px-2.5 py-1.5 text-xs font-mono font-black text-[#742284] dark:text-[#e9d5ff] transition-colors hover:bg-[#742284] hover:text-white shadow-xs"
            >
              {copiedId === "yape1" ? (
                <>
                  <Check size={13} className="text-emerald-500 dark:text-[#00D4B8]" />
                  <span className="text-emerald-600 dark:text-[#00D4B8] font-bold">¡Copiado!</span>
                </>
              ) : (
                <>
                  <span>{yape1.formattedPhone}</span>
                  <Copy size={11} className="opacity-70 group-hover:opacity-100" />
                </>
              )}
            </button>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-fg-muted">
                Saldo Yape 1
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-[#742284]/30 border border-purple-200 dark:border-[#742284]/50 px-2.5 py-0.5 text-[10px] font-extrabold text-purple-900 dark:text-purple-200">
                {selectedAccount === "YAPE 1"
                  ? "● Filtro activo"
                  : `${shareByMethod["YAPE 1"].toFixed(1)}% · ${yape1.titular}`}
              </span>
            </div>
            <p className="mt-1 font-display text-3xl font-black tracking-tight text-fg sm:text-4xl">
              <AnimatedMoney value={statsByMethod["YAPE 1"].net} />
            </p>
          </div>

          {/* Barra de participación */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#742284]/15">
            <div
              style={{ width: `${shareByMethod["YAPE 1"]}%` }}
              className="h-full rounded-full bg-gradient-to-r from-[#742284] via-purple-500 to-[#00D4B8]"
            />
          </div>

          {/* Desglose Ingresos / Egresos de Yape 1 */}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-[#742284]/20 bg-[#742284]/[0.05] p-3 text-xs">
            <div>
              <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400">
                <ArrowUpRight size={12} /> Ingresos
              </span>
              <p className="mt-0.5 font-mono font-black text-fg">
                <AnimatedMoney value={statsByMethod["YAPE 1"].income} prefix="+ S/. " />
              </p>
            </div>
            <div className="border-l border-[#742284]/20 pl-2.5">
              <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-red-600 dark:text-red-400">
                <ArrowDownRight size={12} /> Egresos
              </span>
              <p className="mt-0.5 font-mono font-black text-fg">
                <AnimatedMoney value={statsByMethod["YAPE 1"].expense} prefix="- S/. " />
              </p>
            </div>
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-medium text-fg-muted truncate">
              {yape1.titular} · Tel. {yape1.formattedPhone}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewModalAccount("YAPE 1");
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#742284]/30 bg-[#742284]/10 px-3 py-1.5 text-[11px] font-extrabold text-[#742284] dark:text-[#e9d5ff] transition-colors hover:bg-[#742284] hover:text-white shadow-2xs"
            >
              <Eye size={12} />
              <span>Previsualizar</span>
            </button>
          </div>
        </div>

        {/* 3. Tarjeta YAPE 2 — Yape Caja */}
        <div
          onClick={() => handleSelectCard("YAPE 2")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleSelectCard("YAPE 2");
          }}
          className={`group admin-glass relative cursor-pointer overflow-hidden rounded-3xl p-5 transition-colors ${
            selectedAccount === "YAPE 2"
              ? "ring-2 ring-fuchsia-600 border-fuchsia-600 shadow-xl shadow-fuchsia-600/25 bg-fuchsia-600/[0.05]"
              : "border-fuchsia-500/30 dark:border-fuchsia-500/50 hover:border-fuchsia-500 hover:shadow-xl hover:shadow-fuchsia-500/20"
          }`}
        >
          {/* Barra superior luminosa */}
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-fuchsia-600 via-pink-500 to-[#00D4B8]" />
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-fuchsia-500/15 blur-2xl" />

          <div className="flex items-start justify-between gap-2 pt-1">
            <div className="flex items-center gap-3">
              <div className="shrink-0 rounded-2xl p-0.5">
                <YapeIcon size={46} className="shadow-lg shadow-fuchsia-600/30" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-fuchsia-700 dark:text-fuchsia-300">
                    Yape 2
                  </span>
                  <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.2 text-[10px] font-black text-fuchsia-700 dark:text-fuchsia-200 tabular-nums">
                    {statsByMethod["YAPE 2"].count} movs.
                  </span>
                </div>
                <p className="text-sm font-extrabold text-fg leading-tight mt-0.5">{yape2.titular}</p>
              </div>
            </div>

            {/* Chip interactivo para copiar número */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                copyNumber("yape2", yape2.phone || "");
              }}
              title="Clic para copiar número"
              className="inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 dark:bg-fuchsia-500/25 px-2.5 py-1.5 text-xs font-mono font-black text-fuchsia-700 dark:text-fuchsia-200 transition-colors hover:bg-fuchsia-600 hover:text-white shadow-xs"
            >
              {copiedId === "yape2" ? (
                <>
                  <Check size={13} className="text-emerald-500 dark:text-[#00D4B8]" />
                  <span className="text-emerald-600 dark:text-[#00D4B8] font-bold">¡Copiado!</span>
                </>
              ) : (
                <>
                  <span>{yape2.formattedPhone}</span>
                  <Copy size={11} className="opacity-70 group-hover:opacity-100" />
                </>
              )}
            </button>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-fg-muted">
                Saldo Yape 2
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-100 dark:bg-fuchsia-500/25 border border-fuchsia-200 dark:border-fuchsia-500/40 px-2.5 py-0.5 text-[10px] font-extrabold text-fuchsia-900 dark:text-fuchsia-200">
                {selectedAccount === "YAPE 2"
                  ? "● Filtro activo"
                  : `${shareByMethod["YAPE 2"].toFixed(1)}% · ${yape2.titular}`}
              </span>
            </div>
            <p className="mt-1 font-display text-3xl font-black tracking-tight text-fg sm:text-4xl">
              <AnimatedMoney value={statsByMethod["YAPE 2"].net} />
            </p>
          </div>

          {/* Barra de participación */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-fuchsia-500/15">
            <div
              style={{ width: `${shareByMethod["YAPE 2"]}%` }}
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-[#00D4B8]"
            />
          </div>

          {/* Desglose Ingresos / Egresos de Yape 2 */}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 text-xs">
            <div>
              <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400">
                <ArrowUpRight size={12} /> Ingresos
              </span>
              <p className="mt-0.5 font-mono font-black text-fg">
                <AnimatedMoney value={statsByMethod["YAPE 2"].income} prefix="+ S/. " />
              </p>
            </div>
            <div className="border-l border-fuchsia-500/20 pl-2.5">
              <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-red-600 dark:text-red-400">
                <ArrowDownRight size={12} /> Egresos
              </span>
              <p className="mt-0.5 font-mono font-black text-fg">
                <AnimatedMoney value={statsByMethod["YAPE 2"].expense} prefix="- S/. " />
              </p>
            </div>
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-medium text-fg-muted truncate">
              {yape2.titular} · Tel. {yape2.formattedPhone}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewModalAccount("YAPE 2");
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-[11px] font-extrabold text-fuchsia-700 dark:text-fuchsia-200 transition-all hover:bg-fuchsia-600 hover:text-white shadow-2xs"
            >
              <Eye size={12} />
              <span>Previsualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Panel Desplegable cuando se selecciona una tarjeta */}
      {selectedAccount && (
        <div className="mt-5 admin-glass rounded-3xl border-2 border-accent/30 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <ListFilter size={18} className="text-accent" />
              <div>
                <h3 className="font-display text-sm font-bold text-fg">
                  Previsualización rápida: {PAYMENT_METHOD_INFO[selectedAccount].name} —{" "}
                  {PAYMENT_METHOD_INFO[selectedAccount].titular}
                </h3>
                <p className="text-xs text-fg-muted">
                  Mostrando los últimos movimientos exclusivos de esta cuenta y su saldo acumulado independiente.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadAccountPDF(selectedAccount)}
                disabled={accountLedger.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-accent-fg shadow-xs transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Download size={13} />
                <span>PDF de {PAYMENT_METHOD_INFO[selectedAccount].name}</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewModalAccount(selectedAccount)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-bg px-3 py-1.5 text-xs font-bold text-fg hover:border-accent hover:text-accent"
              >
                <Eye size={13} />
                <span>Abrir extracto completo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  updateSelectedAccount(null);
                  setChartMode("ALL");
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-alt hover:text-fg"
                title="Cerrar filtro"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {accountLedger.length === 0 ? (
            <p className="py-6 text-center text-xs text-fg-muted">
              No hay movimientos registrados para {PAYMENT_METHOD_INFO[selectedAccount].name} en {periodLabel}.
            </p>
          ) : (
            <div className="mt-3 max-h-80 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    <th className="py-2 px-3">Fecha</th>
                    <th className="py-2 px-3">Concepto</th>
                    <th className="py-2 px-3 text-right">Ingreso (+)</th>
                    <th className="py-2 px-3 text-right">Egreso (-)</th>
                    <th className="py-2 px-3 text-right">Saldo en {PAYMENT_METHOD_INFO[selectedAccount].name}</th>
                  </tr>
                </thead>
                <tbody>
                  {accountLedger.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-fg/[0.02]">
                      <td className="py-2 px-3 whitespace-nowrap text-fg-muted">{formatDateUTC(row.date)}</td>
                      <td className="py-2 px-3 font-semibold text-fg">{row.description}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600">
                        {row.isInc ? `+ S/. ${row.amount.toFixed(2)}` : "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-red-600">
                        {!row.isInc ? `- S/. ${row.amount.toFixed(2)}` : "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-black text-fg">
                        S/. {row.runningAfter.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Gráfico de Evolución del Saldo (Sincronizado con las tarjetas y desde S/. 0.00) */}
      <div className="mt-7 admin-glass rounded-3xl border border-border p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <TrendingUp size={18} />
            </div>
            <div>
              <h2 className="font-display text-lg font-black text-fg">
                Evolución del Saldo — {periodLabel}
              </h2>
              <p className="text-xs text-fg-muted">
                {chartMode === "COMPARE"
                  ? "Comparando Efectivo vs Yape 1 vs Yape 2 partiendo desde S/. 0.00"
                  : chartMode === "ALL"
                  ? `Curva consolidada que inicia en S/. 0.00 y evoluciona movimiento por movimiento`
                  : `Curva exclusiva de ${PAYMENT_METHOD_INFO[chartMode].name} desde S/. 0.00`}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
            ● Punto 0: S/. 0.00
          </span>
        </div>
        <CajaChart
          transactions={transactions}
          activeFilter={chartMode}
          onFilterChange={(m) => {
            setChartMode(m);
            if (m === "EFECTIVO" || m === "YAPE 1" || m === "YAPE 2") {
              updateSelectedAccount(m);
            } else {
              updateSelectedAccount(null);
            }
          }}
        />
      </div>

      {/* Modal Previsualizador Completo de Estado de Cuenta Individual */}
      {previewModalAccount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setPreviewModalAccount(null)}
        >
          <div
            className="admin-glass relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-bg p-6 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Estado de Cuenta */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3.5">
                {previewModalAccount === "EFECTIVO" ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md">
                    <Banknote size={26} />
                  </div>
                ) : (
                  <YapeIcon size={48} className="shadow-md" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-accent">
                      Estado de Cuenta Individual
                    </span>
                    <span className="text-xs font-semibold text-fg-muted">{periodLabel}</span>
                  </div>
                  <h3 className="mt-1 font-display text-xl font-black text-fg">
                    {PAYMENT_METHOD_INFO[previewModalAccount].name} —{" "}
                    {PAYMENT_METHOD_INFO[previewModalAccount].titular}
                  </h3>
                  {PAYMENT_METHOD_INFO[previewModalAccount].formattedPhone && (
                    <p className="text-xs text-fg-muted">
                      Número afiliado: {PAYMENT_METHOD_INFO[previewModalAccount].formattedPhone}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadAccountPDF(previewModalAccount)}
                  disabled={accountLedger.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-fg shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Download size={14} />
                  <span>Descargar PDF de esta cuenta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModalAccount(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-fg-muted hover:bg-bg-alt hover:text-fg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 3 KPIs de la Cuenta */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Total Ingresos ({PAYMENT_METHOD_INFO[previewModalAccount].name})
                </span>
                <p className="mt-1 font-display text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  + S/. {statsByMethod[previewModalAccount].income.toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.05] p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Total Egresos ({PAYMENT_METHOD_INFO[previewModalAccount].name})
                </span>
                <p className="mt-1 font-display text-2xl font-black text-red-600 dark:text-red-400">
                  - S/. {statsByMethod[previewModalAccount].expense.toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl border border-accent/30 bg-accent/[0.06] p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  Saldo Disponible Final
                </span>
                <p className="mt-1 font-display text-2xl font-black text-fg">
                  S/. {statsByMethod[previewModalAccount].net.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Tabla de Movimientos Exclusivos de la Cuenta */}
            <div className="mt-4 flex-1 overflow-y-auto rounded-2xl border border-border">
              {accountLedger.length === 0 ? (
                <div className="py-12 text-center text-sm text-fg-muted">
                  No se registraron movimientos en {PAYMENT_METHOD_INFO[previewModalAccount].name} durante{" "}
                  {periodLabel}.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-bg-alt border-b border-border text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    <tr>
                      <th className="py-2.5 px-4">Fecha</th>
                      <th className="py-2.5 px-4">Concepto / Descripción</th>
                      <th className="py-2.5 px-4 text-right">Ingreso</th>
                      <th className="py-2.5 px-4 text-right">Egreso</th>
                      <th className="py-2.5 px-4 text-right">Saldo en Cuenta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountLedger.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 last:border-0 hover:bg-fg/[0.02]">
                        <td className="py-2.5 px-4 whitespace-nowrap text-fg-muted">
                          {formatDateUTC(row.date)}
                        </td>
                        <td className="py-2.5 px-4">
                          <p className="font-semibold text-fg">{row.description}</p>
                          {row.notes && <p className="text-[11px] text-fg-muted">{row.notes}</p>}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-600">
                          {row.isInc ? `+ S/. ${row.amount.toFixed(2)}` : ""}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-red-600">
                          {!row.isInc ? `- S/. ${row.amount.toFixed(2)}` : ""}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-fg">
                          S/. {row.runningAfter.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
