"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ShoppingCart, X, AlertTriangle, MessageCircle, Plus, Minus } from "lucide-react";
import { sellOneUnit } from "./actions";
import {
  buildWhatsAppLink,
  generateSingleProductStockAlertMessage,
} from "@/lib/whatsappStockReport";

export function SellButton({
  productId,
  productName,
  stock,
}: {
  productId: string;
  productName: string;
  stock: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [docNumber, setDocNumber] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stockNotice, setStockNotice] = useState<{ remaining: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    setQuantity(1);
    setError(null);
    setStockNotice(null);
    setIsOpen(true);
  };

  const confirmSale = () => {
    startTransition(async () => {
      const result = await sellOneUnit({
        productId,
        quantity,
        docNumber: docNumber.trim() || undefined,
        nombre: nombre.trim() || undefined,
        email: email.trim() || undefined,
        telefono: telefono.trim() || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setError(null);
      if (result.lowStockAlert && result.remainingStock != null) {
        // Show low stock notification modal
        setStockNotice({ remaining: result.remainingStock });
      } else {
        setIsOpen(false);
        setDocNumber("");
        setNombre("");
        setEmail("");
        setTelefono("");
      }
    });
  };

  const handleSendWhatsApp = (remaining: number) => {
    const text = generateSingleProductStockAlertMessage(productName, remaining);
    window.open(buildWhatsAppLink(text), "_blank");
    setIsOpen(false);
    setStockNotice(null);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleOpen}
        disabled={isPending || stock <= 0}
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <ShoppingCart size={13} />
        Vender
      </button>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-bg-alt p-6 shadow-2xl border border-border">
              {stockNotice ? (
                <div className="text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                    <AlertTriangle size={32} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-fg">¡Venta registrada con éxito!</h3>
                    <p className="mt-2 text-sm text-fg-muted">
                      El producto <span className="font-semibold text-fg">&quot;{productName}&quot;</span> ha
                      quedado con{" "}
                      <span className="font-bold text-amber-500">
                        {stockNotice.remaining === 1 ? "1 sola unidad" : `${stockNotice.remaining} unidades (agotado)`}
                      </span>{" "}
                      en inventario.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      onClick={() => handleSendWhatsApp(stockNotice.remaining)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
                    >
                      <MessageCircle size={16} />
                      Notificar a WhatsApp
                    </button>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setStockNotice(null);
                      }}
                      className="rounded-xl border border-border bg-bg px-4 py-2 text-xs font-bold text-fg-muted transition-colors hover:text-fg"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-fg">Vender &quot;{productName}&quot;</h3>
                    <button
                      onClick={() => setIsOpen(false)}
                      aria-label="Cancelar"
                      className="rounded-full p-1.5 text-fg-muted transition-colors hover:bg-bg"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">
                    Stock actual: <strong className="text-fg">{stock} unidades</strong>
                  </p>

                  <div className="mt-4 space-y-3">
                    {/* Cantidad */}
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">Cantidad a vender</label>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-bg text-fg hover:border-accent"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={stock}
                          value={quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) setQuantity(Math.min(stock, Math.max(1, val)));
                          }}
                          className="w-20 text-center rounded-xl border border-border bg-bg py-2 text-sm font-bold text-fg outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-bg text-fg hover:border-accent"
                        >
                          <Plus size={14} />
                        </button>
                        <span className="text-xs text-fg-muted">de {stock} disp.</span>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Nombre / razón social (opcional)"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-accent"
                    />
                    <input
                      type="text"
                      placeholder="DNI (8 dígitos) o RUC (11 dígitos)"
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-accent"
                    />
                    <input
                      type="email"
                      placeholder="Correo (para enviar el comprobante)"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-accent"
                    />
                    <input
                      type="tel"
                      placeholder="Celular (para reenviar por WhatsApp)"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-accent"
                    />
                  </div>

                  <button
                    onClick={confirmSale}
                    disabled={isPending}
                    className="mt-4 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {isPending ? "Vendiendo..." : `Confirmar venta (x${quantity})`}
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
