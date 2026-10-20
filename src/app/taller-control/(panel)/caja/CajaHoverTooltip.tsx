"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FileText, Sparkles, ArrowDownRight, Tag } from "lucide-react";

interface CajaHoverTooltipProps {
  children: ReactNode;
  content: string;
  title?: string;
  type?: "INCOME" | "EXPENSE";
  amount?: number;
  paymentMethod?: string;
  date?: string;
  notes?: string | null;
  /** Solo muestra el tooltip flotante si el texto supera este largo (default: 15) */
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
  minLength = 16,
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
    const tooltipWidth = 320;
    const placeAbove = rect.top > 140;

    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    // Evitar que se desborde fuera de la pantalla
    left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, left));

    const top = placeAbove ? rect.top - 8 : rect.bottom + 8;
    setCoords({ top, left, placeAbove });
  };

  const handleMouseEnter = () => {
    if (!shouldEnable) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Aparición rápida y fluida (80ms)
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, 80);
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
            className="pointer-events-none w-[320px] max-w-[90vw] rounded-2xl border border-accent/40 bg-slate-950/95 dark:bg-slate-900/98 p-3.5 text-white shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ring-1 ring-white/10"
          >
            {/* Cabecera del Tooltip */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
              <div className="flex items-center gap-1.5 text-accent font-bold text-[11px] uppercase tracking-wider">
                <FileText size={13} />
                <span>{title}</span>
              </div>

              {type && amount !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    type === "INCOME"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {type === "INCOME" ? "Ingreso" : "Gasto"} S/. {amount.toFixed(2)}
                </span>
              )}
            </div>

            {/* Texto Completo Sin Recortes */}
            <div className="text-xs sm:text-sm font-semibold text-white/95 leading-snug break-words">
              {cleanContent}
            </div>

            {/* Metadatos secundarios (método, fecha, notas) */}
            {(paymentMethod || date || notes) && (
              <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center gap-1.5 text-[10px] text-white/70">
                {date && (
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-medium">
                    📅 {date}
                  </span>
                )}
                {paymentMethod && (
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-bold text-accent">
                    💳 {paymentMethod}
                  </span>
                )}
                {notes && notes.trim() && (
                  <div className="w-full mt-1 rounded-md bg-white/5 border border-white/10 p-1.5 text-[11px] text-white/80">
                    <span className="text-accent font-bold">Nota: </span>
                    {notes.trim()}
                  </div>
                )}
              </div>
            )}

            {/* Pequeña flecha visual */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 border bg-slate-950 dark:bg-slate-900 border-accent/40 ${
                coords.placeAbove ? "-bottom-1 border-t-0 border-l-0" : "-top-1 border-b-0 border-r-0"
              }`}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
