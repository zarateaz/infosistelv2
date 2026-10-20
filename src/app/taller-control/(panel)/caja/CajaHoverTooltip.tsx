"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FileText, Calendar, CreditCard, StickyNote } from "lucide-react";

interface CajaHoverTooltipProps {
  children: ReactNode;
  content: string;
  title?: string;
  type?: "INCOME" | "EXPENSE";
  amount?: number;
  paymentMethod?: string;
  date?: string;
  notes?: string | null;
  /** Solo muestra el tooltip flotante si el texto supera este largo (default: 12) */
  minLength?: number;
  className?: string;
}

export function CajaHoverTooltip({
  children,
  content,
  title = "Concepto del Movimiento",
  type,
  amount,
  paymentMethod,
  date,
  notes,
  minLength = 12,
  className = "",
}: CajaHoverTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanContent = content ? content.trim() : "";
  const shouldEnable = cleanContent.length >= minLength;

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 330;
    const placeAbove = rect.top > 150;

    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    // Mantener dentro de los bordes visibles de la ventana
    left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, left));

    const top = placeAbove ? rect.top - 8 : rect.bottom + 8;
    setCoords({ top, left, placeAbove });
  };

  const handleMouseEnter = () => {
    if (!shouldEnable) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Aparición ultra-rápida y fluida (70ms)
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, 70);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 60);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-block w-full ${className}`}
    >
      {children}

      {isOpen &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: coords.placeAbove ? "translateY(-100%)" : "none",
              zIndex: 9999,
            }}
            /* 
              TEMA BLANCO: Fondo blanco puro, texto grafito-marino, borde suave gris/azul, sombra elegante.
              TEMA AZUL / OSCURO: Fondo azul medianoche profundo (#0c1527), borde azul neón (#3b82f6), texto blanco puro.
            */
            className="pointer-events-none w-[330px] max-w-[92vw] rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 transition-colors
              bg-white/98 text-slate-900 border border-slate-200/90 shadow-blue-500/10 ring-1 ring-slate-900/5
              dark:bg-[#0c1527]/98 dark:text-white dark:border-blue-500/50 dark:shadow-blue-950/90 dark:ring-1 dark:ring-blue-400/25"
          >
            {/* Cabecera del Tooltip */}
            <div className="flex items-center justify-between border-b pb-2.5 mb-2.5 border-slate-100 dark:border-blue-900/50">
              <div className="flex items-center gap-1.5 font-black text-[11px] uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <FileText size={14} className="shrink-0" />
                <span>{title}</span>
              </div>

              {type && amount !== undefined && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    type === "INCOME"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40"
                      : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40"
                  }`}
                >
                  {type === "INCOME" ? "Ingreso" : "Gasto"} S/. {amount.toFixed(2)}
                </span>
              )}
            </div>

            {/* Texto Completo Sin Recortes */}
            <div className="text-xs sm:text-sm font-bold leading-relaxed break-words text-slate-900 dark:text-white">
              {cleanContent}
            </div>

            {/* Metadatos secundarios (método de pago, fecha, notas) */}
            {(paymentMethod || date || notes) && (
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-blue-900/50 flex flex-wrap items-center gap-2 text-[10px]">
                {date && (
                  <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-800/50">
                    <Calendar size={11} className="text-slate-500 dark:text-blue-400" />
                    <span>{date}</span>
                  </span>
                )}
                {paymentMethod && (
                  <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-black bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40">
                    <CreditCard size={11} />
                    <span>{paymentMethod}</span>
                  </span>
                )}
                {notes && notes.trim() && (
                  <div className="w-full mt-1.5 rounded-xl p-2 text-[11px] leading-relaxed break-words bg-slate-50 border border-slate-200 text-slate-800 dark:bg-blue-950/40 dark:border-blue-850/60 dark:text-blue-100">
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-0.5">
                      <StickyNote size={11} />
                      <span>Nota adicional:</span>
                    </div>
                    <span>{notes.trim()}</span>
                  </div>
                )}
              </div>
            )}

            {/* Pequeña flecha visual adaptativa */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 h-2.5 w-2.5 rotate-45 border
                bg-white border-slate-200 dark:bg-[#0c1527] dark:border-blue-500/50 ${
                coords.placeAbove ? "-bottom-1.5 border-t-0 border-l-0" : "-top-1.5 border-b-0 border-r-0"
              }`}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
