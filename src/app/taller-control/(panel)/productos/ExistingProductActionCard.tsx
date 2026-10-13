"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  Plus,
  Minus,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  ExternalLink,
} from "lucide-react";
import type { ProductSummary } from "@/lib/duplicateDetection";
import type { ScanFill } from "./ScannerPanel";
import { adjustProductStock } from "./actions";

interface ExistingProductActionCardProps {
  product: ProductSummary;
  onFill?: (fill: ScanFill) => void;
  onStockUpdated?: (newStock: number) => void;
}

export function ExistingProductActionCard({
  product,
  onFill,
  onStockUpdated,
}: ExistingProductActionCardProps) {
  const [currentStock, setCurrentStock] = useState<number>(product.stock ?? 0);
  const [stockDelta, setStockDelta] = useState<number>(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoadedIntoForm, setIsLoadedIntoForm] = useState(false);

  const priceFormatted =
    product.price !== undefined ? `S/. ${Number(product.price).toFixed(2)}` : "No def.";
  const costFormatted =
    product.costPrice !== undefined && product.costPrice !== null
      ? `S/. ${Number(product.costPrice).toFixed(2)}`
      : "S/. 0.00";

  async function handleAdjust(delta: number) {
    if (delta === 0) return;
    setIsUpdating(true);
    setFeedback(null);
    try {
      const res = await adjustProductStock(product.id, delta);
      if (res.success && res.newStock !== undefined) {
        setCurrentStock(res.newStock);
        onStockUpdated?.(res.newStock);
        setFeedback(
          delta > 0
            ? `+${delta} u. (Nuevo stock: ${res.newStock} u.)`
            : `-${Math.abs(delta)} u. (Nuevo stock: ${res.newStock} u.)`
        );
      } else {
        setFeedback(res.error || "Error al actualizar stock.");
      }
    } catch {
      setFeedback("Error de conexión al actualizar stock.");
    } finally {
      setIsUpdating(false);
    }
  }

  function handleLoadOriginals() {
    if (!onFill) return;
    onFill({
      name: product.name,
      category: product.category ?? undefined,
      description: product.description ?? undefined,
      barcode: product.barcode ?? undefined,
      price: product.price,
      costPrice: product.costPrice ?? 0,
      stock: currentStock,
      image: product.image ?? undefined,
    });
    setIsLoadedIntoForm(true);
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 sm:p-3.5 shadow-xs transition-all animate-in fade-in duration-200">
      {/* Header Compacto */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-amber-500/20 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black">
            <AlertTriangle size={10} strokeWidth={2.5} />
            0 Margen de Error
          </span>
          <span className="truncate text-xs font-bold text-amber-900 dark:text-amber-200">
            El producto ya se encuentra en la tienda. ¿Desea agregar o quitar stock o editar?
          </span>
        </div>

        <Link
          href={`/taller-control/productos/${product.id}`}
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-accent hover:underline"
        >
          <span>Editar ficha</span>
          <ExternalLink size={11} />
        </Link>
      </div>

      {/* Fila Central: Mini Thumbnail + Datos + Chips de Precio y Stock */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {product.image ? (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-white shadow-xs">
              <Image
                src={product.image}
                alt={product.name}
                fill
                unoptimized
                sizes="40px"
                className="object-contain p-0.5"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-bg text-fg-muted">
              <Package size={18} strokeWidth={1.5} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h4 className="truncate text-xs font-bold text-fg leading-tight" title={product.name}>
              {product.name}
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-fg-muted mt-0.5">
              {product.category && <span className="font-medium text-fg/80">{product.category}</span>}
              {product.barcode && (
                <span>
                  Cód: <strong className="font-mono text-fg">{product.barcode}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chips de Precios y Stock compactos */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <div className="rounded-lg border border-border bg-bg/80 px-2.5 py-1 text-center">
            <span className="block text-[9px] uppercase tracking-wider text-fg-muted font-semibold">
              Venta
            </span>
            <span className="text-xs font-black text-accent">{priceFormatted}</span>
          </div>

          <div className="rounded-lg border border-border bg-bg/80 px-2.5 py-1 text-center">
            <span className="block text-[9px] uppercase tracking-wider text-fg-muted font-semibold">
              Costo
            </span>
            <span className="text-xs font-bold text-fg">{costFormatted}</span>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-center">
            <span className="block text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">
              Stock
            </span>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
              {currentStock} u.
            </span>
          </div>
        </div>
      </div>

      {/* Controles de Acción Compactos en 1 Sola Línea */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/20 pt-2">
        {/* Ajustes de stock rápidos */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-fg-muted">Stock:</span>
          {[1, 5, 10].map((num) => (
            <button
              key={`add-${num}`}
              type="button"
              disabled={isUpdating}
              onClick={() => handleAdjust(num)}
              className="inline-flex items-center gap-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 transition-all hover:bg-emerald-500/20 active:scale-95 disabled:opacity-50"
            >
              <Plus size={10} strokeWidth={2.5} />
              <span>{num}</span>
            </button>
          ))}
          {[-1, -5].map((num) => (
            <button
              key={`sub-${num}`}
              type="button"
              disabled={isUpdating || currentStock <= 0}
              onClick={() => handleAdjust(num)}
              className="inline-flex items-center gap-0.5 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-300 transition-all hover:bg-red-500/20 active:scale-95 disabled:opacity-50"
            >
              <Minus size={10} strokeWidth={2.5} />
              <span>{Math.abs(num)}</span>
            </button>
          ))}

          {/* Cantidad personalizada directa */}
          <div className="flex items-center gap-1 pl-1">
            <input
              type="number"
              min={1}
              value={stockDelta}
              onChange={(e) => setStockDelta(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 rounded border border-border bg-bg px-1 py-0.5 text-center text-xs font-bold text-fg outline-none focus:border-accent"
            />
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleAdjust(stockDelta)}
              className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
              title="Sumar cantidad al stock"
            >
              +
            </button>
            <button
              type="button"
              disabled={isUpdating || currentStock <= 0}
              onClick={() => handleAdjust(-stockDelta)}
              className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 transition-all hover:bg-red-500/20 disabled:opacity-50"
              title="Restar cantidad del stock"
            >
              -
            </button>
          </div>
        </div>

        {/* Botones de acción principales */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadOriginals}
            className="inline-flex items-center gap-1 rounded-lg border border-border-strong bg-bg px-2.5 py-1 text-[11px] font-bold text-fg transition-all hover:border-accent hover:text-accent active:scale-95"
          >
            <Download size={11} />
            <span>{isLoadedIntoForm ? "✓ Cargado abajo" : "Cargar datos originales"}</span>
          </button>

          <Link
            href={`/taller-control/productos/${product.id}`}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1 text-[11px] font-bold text-accent-fg shadow-xs transition-all hover:bg-accent-hover active:scale-95"
          >
            <Edit3 size={11} />
            <span>Editar</span>
          </Link>
        </div>
      </div>

      {feedback && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-accent/10 px-2 py-1 text-[11px] font-bold text-accent animate-in fade-in">
          <CheckCircle2 size={12} className="shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
}
