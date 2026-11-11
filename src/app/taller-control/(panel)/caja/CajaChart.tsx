"use client";

import { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import { Activity, Sparkles, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { AdminTransaction } from "./actions";
import type { PaymentMethodType } from "./constants";
import { AnimatedMoney } from "@/components/ui/AnimatedMoney";

export type ChartFilterMode = "ALL" | "COMPARE" | PaymentMethodType;

interface CajaChartProps {
  transactions: AdminTransaction[];
  activeFilter?: ChartFilterMode;
  onFilterChange?: (mode: ChartFilterMode) => void;
  replayKey?: number | string;
}

const LINE_COLORS: Record<string, string> = {
  ALL: "#0a5fdb",
  EFECTIVO: "#10b981",
  "YAPE 1": "#742284",
  "YAPE 2": "#d946ef",
};

interface ChartPoint {
  index: number;
  date: string;
  fullDate: string;
  method: string;
  type: "ORIGIN" | "INCOME" | "EXPENSE";
  amount: number;
  balance: number;
  EFECTIVO: number;
  "YAPE 1": number;
  "YAPE 2": number;
  value: number;
  desc: string;
}

export function CajaChart({
  transactions,
  activeFilter,
  onFilterChange,
  replayKey = 0,
}: CajaChartProps) {
  const [internalMode, setInternalMode] = useState<ChartFilterMode>("ALL");
  const mode = activeFilter ?? internalMode;

  const handleMode = (next: ChartFilterMode) => {
    setInternalMode(next);
    onFilterChange?.(next);
  };

  const points = useMemo<ChartPoint[]>(() => {
    let totalBal = 0;
    let cashBal = 0;
    let yape1Bal = 0;
    let yape2Bal = 0;

    const originPoint: ChartPoint = {
      index: 0,
      date: "Inicio",
      fullDate: "Apertura del periodo",
      method: "APERTURA",
      type: "ORIGIN",
      amount: 0,
      balance: 0,
      EFECTIVO: 0,
      "YAPE 1": 0,
      "YAPE 2": 0,
      value: 0,
      desc: "Inicia desde S/. 0.00",
    };

    const txPoints = transactions.map((t, idx) => {
      const delta = t.type === "INCOME" ? t.amount : -t.amount;
      totalBal += delta;
      if (t.paymentMethod === "EFECTIVO") cashBal += delta;
      else if (t.paymentMethod === "YAPE 1") yape1Bal += delta;
      else if (t.paymentMethod === "YAPE 2") yape2Bal += delta;

      const d = new Date(t.date);
      return {
        index: idx + 1,
        date: d.toLocaleDateString("es-PE", {
          day: "2-digit",
          month: "short",
          timeZone: "UTC",
        }),
        fullDate: d.toLocaleDateString("es-PE", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
        method: t.paymentMethod,
        type: t.type,
        amount: t.amount,
        balance: Number(totalBal.toFixed(2)),
        EFECTIVO: Number(cashBal.toFixed(2)),
        "YAPE 1": Number(yape1Bal.toFixed(2)),
        "YAPE 2": Number(yape2Bal.toFixed(2)),
        value: Number(totalBal.toFixed(2)),
        desc: t.description,
      };
    });

    return [originPoint, ...txPoints];
  }, [transactions]);

  const singleMethodPoints = useMemo<ChartPoint[]>(() => {
    if (mode !== "EFECTIVO" && mode !== "YAPE 1" && mode !== "YAPE 2") return points;
    let running = 0;

    const originPoint: ChartPoint = {
      index: 0,
      date: "Inicio",
      fullDate: `Apertura ${mode}`,
      method: mode,
      type: "ORIGIN",
      amount: 0,
      balance: 0,
      EFECTIVO: 0,
      "YAPE 1": 0,
      "YAPE 2": 0,
      value: 0,
      desc: `${mode} inicia en S/. 0.00`,
    };

    const filtered = transactions
      .filter((t) => t.paymentMethod === mode)
      .map((t, idx) => {
        running += t.type === "INCOME" ? t.amount : -t.amount;
        const val = Number(running.toFixed(2));
        const d = new Date(t.date);
        return {
          index: idx + 1,
          date: d.toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "short",
            timeZone: "UTC",
          }),
          fullDate: d.toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          }),
          method: t.paymentMethod,
          type: t.type,
          amount: t.amount,
          balance: val,
          EFECTIVO: mode === "EFECTIVO" ? val : 0,
          "YAPE 1": mode === "YAPE 1" ? val : 0,
          "YAPE 2": mode === "YAPE 2" ? val : 0,
          value: val,
          desc: t.description,
        };
      });

    return [originPoint, ...filtered];
  }, [transactions, mode, points]);

  const filterButtons: { id: ChartFilterMode; label: string; dotColor?: string; badge?: string }[] = [
    { id: "ALL", label: "Saldo General", dotColor: "#0a5fdb" },
    { id: "COMPARE", label: "Comparar las 3 cuentas", badge: "3 líneas" },
    { id: "EFECTIVO", label: "Efectivo", dotColor: "#10b981" },
    { id: "YAPE 1", label: "Yape 1 (Edgar)", dotColor: "#742284" },
    { id: "YAPE 2", label: "Yape 2 (Caja)", dotColor: "#d946ef" },
  ];

  const isSingleAccount = mode === "EFECTIVO" || mode === "YAPE 1" || mode === "YAPE 2";
  const activeDataset = isSingleAccount ? singleMethodPoints : points;

  const chartStats = useMemo(() => {
    if (activeDataset.length <= 1) {
      return { max: 0, min: 0, current: 0, count: 0 };
    }
    const vals = activeDataset.map((p) => (isSingleAccount ? p.value : p.balance));
    return {
      max: Math.max(...vals),
      min: Math.min(...vals),
      current: vals[vals.length - 1] ?? 0,
      count: activeDataset.length - 1,
    };
  }, [activeDataset, isSingleAccount]);

  const activeColor = isSingleAccount ? LINE_COLORS[mode] : LINE_COLORS.ALL;

  return (
    <div>
      {/* Barra interactiva de modos y KPIs de curva */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterButtons.map((btn) => {
            const active = mode === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleMode(btn.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-[#0a5fdb] to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]"
                    : "border border-border bg-bg-alt/80 text-fg-muted hover:border-accent/50 hover:text-fg"
                }`}
              >
                {btn.dotColor ? (
                  <span
                    className="h-2.5 w-2.5 rounded-full shadow-xs"
                    style={{ backgroundColor: active ? "#ffffff" : btn.dotColor }}
                  />
                ) : (
                  <TrendingUp size={12} className={active ? "text-white" : "text-accent"} />
                )}
                <span>{btn.label}</span>
                {btn.badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9px] font-black uppercase ${
                      active ? "bg-white/20 text-white" : "bg-accent/10 text-accent"
                    }`}
                  >
                    {btn.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mini indicadores rápidos desde S/. 0.00 */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-2.5 py-1">
            <Sparkles size={12} className="text-emerald-500" />
            <span className="text-[10px] font-bold uppercase text-fg-muted">Base:</span>
            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
              S/. 0.00
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-bg-alt/60 px-2.5 py-1">
            <span className="text-[10px] font-bold uppercase text-fg-muted">Pico máx:</span>
            <AnimatedMoney
              value={chartStats.max}
              replayKey={replayKey}
              className="font-mono font-black text-fg"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/[0.08] px-2.5 py-1">
            <Activity size={12} className="text-accent" />
            <span className="text-[10px] font-bold uppercase text-accent">Cierre actual:</span>
            <AnimatedMoney
              value={chartStats.current}
              replayKey={replayKey}
              className="font-mono font-black text-accent"
            />
          </div>
        </div>
      </div>

      {activeDataset.length <= 1 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-bg-alt/30 text-sm text-fg-muted">
          <p className="font-bold text-fg">Punto de partida listo en S/. 0.00</p>
          <p className="mt-1 text-xs text-fg-muted">
            {isSingleAccount
              ? `No hay movimientos registrados en ${mode} para este período.`
              : "Registra movimientos para ver la evolución del saldo."}
          </p>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              key={`${mode}-${replayKey}`}
              data={activeDataset}
              margin={{ top: 12, right: 16, left: 4, bottom: 4 }}
            >
              <defs>
                <linearGradient id="gradAll" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0a5fdb" stopOpacity={0.38} />
                  <stop offset="65%" stopColor="#0a5fdb" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#0a5fdb" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.38} />
                  <stop offset="70%" stopColor="#10b981" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradYape1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#742284" stopOpacity={0.38} />
                  <stop offset="70%" stopColor="#742284" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#742284" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradYape2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d946ef" stopOpacity={0.38} />
                  <stop offset="70%" stopColor="#d946ef" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#d946ef" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(148, 163, 184, 0.16)"
              />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={66}
                tickFormatter={(val) => `S/.${val}`}
              />
              <ReferenceLine
                y={0}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{
                  value: "S/. 0.00",
                  position: "insideBottomLeft",
                  fill: "#64748b",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const point = payload[0]?.payload as ChartPoint | undefined;
                  if (!point) return null;

                  return (
                    <div className="rounded-2xl border border-border bg-bg/95 p-3.5 shadow-2xl backdrop-blur-md min-w-[230px]">
                      <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-fg-muted">
                          {point.type === "ORIGIN" ? "Punto Inicial" : `Mov. #${point.index} · ${point.fullDate}`}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                            point.type === "ORIGIN"
                              ? "bg-blue-500/15 text-blue-600"
                              : point.type === "INCOME"
                              ? "bg-emerald-500/15 text-emerald-600"
                              : "bg-red-500/15 text-red-600"
                          }`}
                        >
                          {point.method}
                        </span>
                      </div>

                      <p className="mt-2 text-xs font-extrabold text-fg line-clamp-2">
                        {point.desc}
                      </p>

                      {point.type !== "ORIGIN" && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs font-bold">
                          {point.type === "INCOME" ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600">
                              <ArrowUpRight size={13} /> + S/. {point.amount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-red-600">
                              <ArrowDownRight size={13} /> - S/. {point.amount.toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-2.5 space-y-1 border-t border-border/70 pt-2 text-xs">
                        {mode === "COMPARE" ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-600">● Efectivo:</span>
                              <span className="font-mono font-black text-fg">
                                S/. {point.EFECTIVO.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#742284] dark:text-purple-300">
                                ● Yape 1 (Edgar):
                              </span>
                              <span className="font-mono font-black text-fg">
                                S/. {point["YAPE 1"].toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-fuchsia-600 dark:text-fuchsia-300">
                                ● Yape 2 (Caja):
                              </span>
                              <span className="font-mono font-black text-fg">
                                S/. {point["YAPE 2"].toFixed(2)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-fg-muted">
                              {isSingleAccount ? `Saldo ${mode}:` : "Saldo Acumulado:"}
                            </span>
                            <span
                              className="font-mono text-sm font-black"
                              style={{ color: activeColor }}
                            >
                              S/. {(isSingleAccount ? point.value : point.balance).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />

              {mode === "COMPARE" && (
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                  formatter={(value) => (
                    <span className="font-extrabold text-fg">
                      {value === "EFECTIVO"
                        ? "Efectivo (Caja Física)"
                        : value === "YAPE 1"
                        ? "Yape 1 (Edgar Caballero)"
                        : "Yape 2 (Yape Caja)"}
                    </span>
                  )}
                />
              )}

              {mode === "ALL" && (
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke={LINE_COLORS.ALL}
                  strokeWidth={3}
                  fill="url(#gradAll)"
                  isAnimationActive={false}
                  dot={{ r: 2.5, fill: LINE_COLORS.ALL, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: LINE_COLORS.ALL, stroke: "#ffffff", strokeWidth: 2 }}
                />
              )}

              {mode === "COMPARE" && (
                <>
                  <Area
                    type="monotone"
                    dataKey="EFECTIVO"
                    stroke={LINE_COLORS.EFECTIVO}
                    strokeWidth={2.6}
                    fill="url(#gradCash)"
                    isAnimationActive={false}
                    dot={false}
                    activeDot={{ r: 5, fill: LINE_COLORS.EFECTIVO, stroke: "#fff", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="YAPE 1"
                    stroke={LINE_COLORS["YAPE 1"]}
                    strokeWidth={2.6}
                    isAnimationActive={false}
                    dot={false}
                    activeDot={{ r: 5, fill: LINE_COLORS["YAPE 1"], stroke: "#fff", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="YAPE 2"
                    stroke={LINE_COLORS["YAPE 2"]}
                    strokeWidth={2.6}
                    isAnimationActive={false}
                    dot={false}
                    activeDot={{ r: 5, fill: LINE_COLORS["YAPE 2"], stroke: "#fff", strokeWidth: 2 }}
                  />
                </>
              )}

              {isSingleAccount && (
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={LINE_COLORS[mode]}
                  strokeWidth={3}
                  fill={
                    mode === "EFECTIVO"
                      ? "url(#gradCash)"
                      : mode === "YAPE 1"
                      ? "url(#gradYape1)"
                      : "url(#gradYape2)"
                  }
                  isAnimationActive={false}
                  dot={{ r: 3.5, fill: LINE_COLORS[mode], stroke: "#ffffff", strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: LINE_COLORS[mode], stroke: "#ffffff", strokeWidth: 2 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
