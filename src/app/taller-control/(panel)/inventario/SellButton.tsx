"use client";

import { useState, useTransition } from "react";
import { ShoppingCart } from "lucide-react";
import { sellOneUnit } from "./actions";

export function SellButton({ productId, productName, stock }: { productId: string; productName: string; stock: number }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sell = () => {
    if (!confirm(`¿Confirmar venta rápida de 1 unidad de "${productName}"?`)) return;
    startTransition(async () => {
      const result = await sellOneUnit(productId);
      setError(result.error ?? null);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={sell}
        disabled={isPending || stock <= 0}
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <ShoppingCart size={13} />
        {isPending ? "Vendiendo..." : "Vender"}
      </button>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
