"use client";

import { useState } from "react";
import { Banknote, Copy, Check } from "lucide-react";
import { YapeIcon } from "@/components/icons/YapeIcon";
import { PAYMENT_METHOD_INFO, type PaymentMethodType } from "./constants";

interface CashboxMethodCardsProps {
  totals: Record<PaymentMethodType, number>;
  periodLabel: string;
}

export function CashboxMethodCards({ totals, periodLabel }: CashboxMethodCardsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyNumber = async (id: string, number: string) => {
    try {
      await navigator.clipboard.writeText(number);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  const yape1 = PAYMENT_METHOD_INFO["YAPE 1"];
  const yape2 = PAYMENT_METHOD_INFO["YAPE 2"];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* 1. Tarjeta EFECTIVO */}
      <div className="group admin-glass relative overflow-hidden rounded-[var(--radius-lg)] p-5 border-emerald-500/20 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-[0_0_24px_-4px_rgba(16,185,129,0.4)] transition-all group-hover:scale-105 group-hover:bg-emerald-500 group-hover:text-white">
              <Banknote size={24} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Efectivo
              </p>
              <p className="text-[11px] font-semibold text-fg-muted">Caja física del taller</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
            Físico
          </span>
        </div>

        <div className="mt-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            Saldo disponible
          </div>
          <p className="mt-0.5 font-display text-3xl font-black tracking-tight text-fg">
            S/. {(totals["EFECTIVO"] ?? 0).toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] text-fg-muted truncate">
            Flujo en billetes y monedas ({periodLabel})
          </p>
        </div>
      </div>

      {/* 2. Tarjeta YAPE 1 — Edgar Caballero */}
      <div className="group admin-glass relative overflow-hidden rounded-[var(--radius-lg)] p-5 border-[#742284]/25 dark:border-[#742284]/50 transition-all duration-300 hover:-translate-y-1 hover:border-[#742284] hover:shadow-xl hover:shadow-[#742284]/15">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-2xl p-0.5 transition-transform duration-300 group-hover:scale-105">
              <YapeIcon size={46} className="shadow-md" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-[#742284] dark:text-[#c084fc]">
                  Yape 1
                </span>
                <span className="h-2 w-2 rounded-full bg-[#00D4B8] shadow-[0_0_8px_#00D4B8] animate-pulse" />
              </div>
              <p className="text-sm font-extrabold text-fg leading-tight mt-0.5">{yape1.titular}</p>
            </div>
          </div>

          {/* Chip interactivo para copiar número */}
          <button
            type="button"
            onClick={() => copyNumber("yape1", yape1.phone || "")}
            title="Clic para copiar número"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#742284]/30 bg-[#742284]/10 dark:bg-[#742284]/25 px-2.5 py-1.5 text-xs font-mono font-black text-[#742284] dark:text-[#e9d5ff] transition-all hover:bg-[#742284] hover:text-white active:scale-95 shadow-xs"
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
            <span className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
              Saldo Yape 1
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-[#742284]/30 border border-purple-200 dark:border-[#742284]/50 px-2 py-0.5 text-[10px] font-extrabold text-purple-900 dark:text-purple-200">
              Titular: {yape1.titular}
            </span>
          </div>
          <p className="mt-0.5 font-display text-3xl font-black tracking-tight text-fg">
            S/. {(totals["YAPE 1"] ?? 0).toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] text-fg-muted truncate">
            {yape1.titular} · Tel. {yape1.formattedPhone}
          </p>
        </div>
      </div>

      {/* 3. Tarjeta YAPE 2 — Yape Caja */}
      <div className="group admin-glass relative overflow-hidden rounded-[var(--radius-lg)] p-5 border-[#742284]/25 dark:border-[#742284]/50 transition-all duration-300 hover:-translate-y-1 hover:border-[#742284] hover:shadow-xl hover:shadow-[#742284]/15">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-2xl p-0.5 transition-transform duration-300 group-hover:scale-105">
              <YapeIcon size={46} className="shadow-md" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-[#742284] dark:text-[#c084fc]">
                  Yape 2
                </span>
                <span className="h-2 w-2 rounded-full bg-[#00D4B8] shadow-[0_0_8px_#00D4B8] animate-pulse" />
              </div>
              <p className="text-sm font-extrabold text-fg leading-tight mt-0.5">{yape2.titular}</p>
            </div>
          </div>

          {/* Chip interactivo para copiar número */}
          <button
            type="button"
            onClick={() => copyNumber("yape2", yape2.phone || "")}
            title="Clic para copiar número"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#742284]/30 bg-[#742284]/10 dark:bg-[#742284]/25 px-2.5 py-1.5 text-xs font-mono font-black text-[#742284] dark:text-[#e9d5ff] transition-all hover:bg-[#742284] hover:text-white active:scale-95 shadow-xs"
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
            <span className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
              Saldo Yape 2
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-[#742284]/30 border border-purple-200 dark:border-[#742284]/50 px-2 py-0.5 text-[10px] font-extrabold text-purple-900 dark:text-purple-200">
              Titular: {yape2.titular}
            </span>
          </div>
          <p className="mt-0.5 font-display text-3xl font-black tracking-tight text-fg">
            S/. {(totals["YAPE 2"] ?? 0).toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] text-fg-muted truncate">
            {yape2.titular} · Tel. {yape2.formattedPhone}
          </p>
        </div>
      </div>
    </div>
  );
}
