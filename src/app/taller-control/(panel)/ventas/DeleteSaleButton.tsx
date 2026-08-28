"use client";

import { Trash2 } from "lucide-react";

export function DeleteSaleButton({ productName, action }: { productName: string; action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar la venta de "${productName}"?`)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        aria-label={`Eliminar venta de ${productName}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={15} />
      </button>
    </form>
  );
}
