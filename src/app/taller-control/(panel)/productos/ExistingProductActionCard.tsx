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
  ArrowRight,
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
    product.price !== undefined ? `S/. ${Number(product.price).toFixed(2)}` : "No definido";
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
            ? `¡Se agregaron +${delta} unidad(es)! Nuevo stock: ${res.newStock} u.`
            : `¡Se descontaron ${Math.abs(delta)} unidad(es)! Nuevo stock: ${res.newStock} u.`
        );
      } else {
        setFeedback(res.error || "Error al actualizar stock.");
      }
    } catch {
      setFeedback("Error de conexión al actualizar el stock.");
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
    <div className="mt-4 overflow-hidden rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-md">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
            <AlertTriangle size={12} strokeWidth={2.5} />
            0 Margen de Error
          </span>
          <span className="text-xs sm:text-sm font-black text-amber-800 dark:text-amber-200">
            El producto ya se encuentra en la tienda. ¿Desea agregar o quitar stock o editar?
          </span>
        </div>

        <Link
          href={`/taller-control/productos/${product.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
        >
          <span>Ir a editar en ficha completa</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* Product Details Header */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        {product.image ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-white shadow-xs">
            <Image
              src={product.image}
              alt={product.name}
              fill
              unoptimized
              sizes="80px"
              className="object-contain p-1"
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-border-strong bg-bg text-fg-muted">
            <Package size={28} strokeWidth={1.5} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h4 className="text-base font-black text-fg leading-snug">{product.name}</h4>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
            {product.category && (
              <span className="rounded-md bg-bg-raised px-2 py-0.5 font-semibold text-fg">
                {product.category}
              </span>
            )}
            {product.barcode && (
              <span>
                Cód: <strong className="font-mono text-fg">{product.barcode}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Precios y Stock Originales */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-bg/70 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            Precio Venta Actual
          </p>
          <p className="mt-1 text-lg font-black text-accent">{priceFormatted}</p>
          <p className="text-[10px] text-fg-muted">Precio original en tienda</p>
        </div>

        <div className="rounded-xl border border-border bg-bg/70 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            Precio de Costo
          </p>
          <p className="mt-1 text-lg font-black text-fg">{costFormatted}</p>
          <p className="text-[10px] text-fg-muted">Costo registrado</p>
        </div>

        <div className="rounded-xl border border-border bg-bg/70 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            Stock en Inventario
          </p>
          <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400">
            {currentStock} <span className="text-xs font-normal">unidades</span>
          </p>
          <p className="text-[10px] text-fg-muted">Disponible ahora</p>
        </div>
      </div>

      {/* Stock Adjustment Controls */}
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-bg/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black text-fg">
            ¿Deseas agregar o quitar stock de este producto?
          </p>
          <span className="text-[11px] text-fg-muted">
            Stock actual: <strong className="text-fg">{currentStock} u.</strong>
          </span>
        </div>

        {/* Quick Delta Buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-fg-muted font-medium">Rápido:</span>
          {[1, 5, 10].map((num) => (
            <button
              key={`add-${num}`}
              type="button"
              disabled={isUpdating}
              onClick={() => handleAdjust(num)}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 transition-all hover:bg-emerald-500/20 active:scale-95 disabled:opacity-50"
            >
              <Plus size={11} strokeWidth={2.5} />
              <span>+{num} u.</span>
            </button>
          ))}
          {[-1, -5].map((num) => (
            <button
              key={`sub-${num}`}
              type="button"
              disabled={isUpdating || currentStock <= 0}
              onClick={() => handleAdjust(num)}
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-700 dark:text-red-300 transition-all hover:bg-red-500/20 active:scale-95 disabled:opacity-50"
            >
              <Minus size={11} strokeWidth={2.5} />
              <span>{num} u.</span>
            </button>
          ))}
        </div>

        {/* Custom Quantity Input & Action Buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <label htmlFor="custom-stock-delta" className="text-xs text-fg-muted font-medium">
              Cantidad:
            </label>
            <input
              id="custom-stock-delta"
              type="number"
              min={1}
              value={stockDelta}
              onChange={(e) => setStockDelta(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 rounded-lg border border-border bg-bg px-2 py-1 text-center text-xs font-bold text-fg outline-none focus:border-accent"
            />
          </div>

          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleAdjust(stockDelta)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
          >
            {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2.5} />}
            <span>Agregar stock</span>
          </button>

          <button
            type="button"
            disabled={isUpdating || currentStock <= 0}
            onClick={() => handleAdjust(-stockDelta)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-500/10 px-3.5 py-1.5 text-xs font-bold text-red-700 dark:text-red-300 transition-all hover:bg-red-500/20 active:scale-95 disabled:opacity-50"
          >
            {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Minus size={12} strokeWidth={2.5} />}
            <span>Quitar stock</span>
          </button>
        </div>

        {feedback && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent animate-in fade-in">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-amber-500/20">
        <button
          type="button"
          onClick={handleLoadOriginals}
          className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-bg px-4 py-2 text-xs font-bold text-fg transition-all hover:border-accent hover:text-accent active:scale-95"
        >
          <Download size={13} />
          <span>{isLoadedIntoForm ? "✓ Precios originales cargados abajo" : "Cargar precios y datos originales al formulario"}</span>
        </button>

        <Link
          href={`/taller-control/productos/${product.id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-xs font-bold text-accent-fg shadow-sm transition-all hover:bg-accent-hover active:scale-95"
        >
          <Edit3 size={13} />
          <span>Editar producto completo</span>
        </Link>
      </div>
    </div>
  );
}
