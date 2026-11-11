"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "../ConfirmDialog";
import { deleteAdminOrder } from "./actions";

interface DeleteOrderButtonProps {
  orderId: string;
  customerName: string;
  total: number;
}

export function DeleteOrderButton({ orderId, customerName, total }: DeleteOrderButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Eliminar pedido de ${customerName}`}
        className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-600 transition-colors hover:bg-red-600 hover:text-white dark:text-red-400"
      >
        <Trash2 size={13} />
        <span>Borrar</span>
      </button>

      {confirming && (
        <ConfirmDialog
          title="Borrar pedido web"
          message={`¿Seguro que deseas borrar el pedido de "${customerName}" por S/. ${total.toFixed(2)}? Esta acción no se puede deshacer.`}
          danger
          confirmLabel="Sí, borrar"
          pendingLabel="Borrando..."
          pending={isPending}
          onConfirm={() =>
            startTransition(async () => {
              await deleteAdminOrder(orderId);
              setConfirming(false);
            })
          }
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

