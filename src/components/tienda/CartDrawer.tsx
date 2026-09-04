"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ShoppingCart, MessageCircle, Loader2 } from "lucide-react";
import { CategoryIcon } from "@/components/tienda/categoryIcons";
import { createOrder } from "@/app/tienda/actions";
import type { Product } from "@/types";

export interface CartLine {
  product: Product;
  quantity: number;
}

const WHATSAPP_NUMBER = "51964648202";

export function CartDrawer({
  isOpen,
  onClose,
  cart,
  onRemove,
  onOrderPlaced,
}: {
  isOpen: boolean;
  onClose: () => void;
  cart: CartLine[];
  onRemove: (productId: string) => void;
  onOrderPlaced: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceNotice, setInvoiceNotice] = useState<string | null>(null);

  const total = cart.reduce((sum, line) => {
    const unit = line.product.onSale && line.product.salePrice ? line.product.salePrice : line.product.price;
    return sum + unit * line.quantity;
  }, 0);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    setError(null);
    if (!name.trim() || phone.trim().length < 7) {
      setError("Completa tu nombre y un número de celular válido.");
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await createOrder({
        customerName: name,
        customerPhone: phone,
        docNumber: docNumber.trim() || undefined,
        customerEmail: email.trim() || undefined,
        items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      });

      if (order.invoiceStatus === "ACEPTADO" && email.trim()) {
        setInvoiceNotice("Tu boleta/factura fue enviada a tu correo.");
      } else if (order.invoiceStatus && order.invoiceStatus !== "ACEPTADO") {
        setInvoiceNotice("Tu pedido se registró, pero hubo un problema al emitir el comprobante. Te contactaremos.");
      }

      const lines = cart
        .map((line) => {
          const unit = line.product.onSale && line.product.salePrice ? line.product.salePrice : line.product.price;
          return `- ${line.product.name} (x${line.quantity}) - S/. ${(unit * line.quantity).toFixed(2)}`;
        })
        .join("\n");
      const message = `Hola INFOSISTEL! Quisiera hacer un pedido:\n\n*Cliente:* ${name}\n*Celular:* ${phone}\n\n*Productos:*\n${lines}\n\n*Total:* S/. ${total.toFixed(2)}\n\n¿Tienen disponibilidad?`;
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank");
      onOrderPlaced();
      // Si hay algo que contarle sobre el comprobante, no cerramos el
      // drawer todavía — se queda viendo el aviso hasta que lo cierre él.
      if (!order.invoiceStatus) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pedido. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
      <div className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-sm flex-col bg-bg-alt shadow-2xl sm:max-w-md">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <ShoppingCart size={16} />
            </div>
            <div>
              <h2 className="text-lg font-black leading-none text-fg">Tu carrito</h2>
              <p className="text-xs font-medium text-fg-muted">
                {count} producto{count !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-fg-muted transition-colors hover:bg-bg">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {invoiceNotice ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                <MessageCircle size={28} className="text-accent" />
              </div>
              <p className="text-sm font-bold text-fg">{invoiceNotice}</p>
              <button
                onClick={onClose}
                className="rounded-xl bg-bg px-5 py-2.5 text-xs font-bold text-fg transition-colors hover:bg-accent/10"
              >
                Cerrar
              </button>
            </div>
          ) : cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg">
                <ShoppingCart size={28} className="text-fg-muted opacity-40" />
              </div>
              <p className="text-sm font-bold text-fg-muted">Tu carrito está vacío</p>
            </div>
          ) : (
            cart.map((line) => {
              const unit = line.product.onSale && line.product.salePrice ? line.product.salePrice : line.product.price;
              return (
                <div key={line.product.id} className="flex items-center gap-3 rounded-2xl bg-bg p-3">
                  <div className="relative h-14 w-14 shrink-0 rounded-xl bg-bg-alt">
                    {line.product.image ? (
                      <Image src={line.product.image} alt={line.product.name} fill className="object-contain p-1.5" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <CategoryIcon category={line.product.category} size={22} strokeWidth={1.25} className="text-fg-muted opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-bold leading-snug text-fg">{line.product.name}</p>
                    <p className="mt-0.5 text-xs text-fg-muted">Cant: {line.quantity}</p>
                    <p className="text-sm font-black text-accent">S/. {(unit * line.quantity).toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => onRemove(line.product.id)}
                    className="shrink-0 rounded-xl p-1.5 text-fg-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {cart.length > 0 && (
          <div className="space-y-4 border-t border-border p-5">
            <div className="flex items-center justify-between">
              <span className="text-base font-black text-fg">Total</span>
              <span className="text-2xl font-black tracking-tight text-accent">S/. {total.toFixed(2)}</span>
            </div>
            <div className="space-y-2.5">
              <input
                type="text"
                placeholder="Tu nombre completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-bg px-4 py-3 text-sm text-fg outline-none placeholder:text-fg-muted"
              />
              <input
                type="tel"
                placeholder="Número de celular"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl bg-bg px-4 py-3 text-sm text-fg outline-none placeholder:text-fg-muted"
              />
              <input
                type="email"
                placeholder="Correo (opcional, para tu boleta)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-bg px-4 py-3 text-sm text-fg outline-none placeholder:text-fg-muted"
              />
              <input
                type="text"
                placeholder="DNI o RUC (opcional)"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="w-full rounded-xl bg-bg px-4 py-3 text-sm text-fg outline-none placeholder:text-fg-muted"
              />
              <p className="text-[11px] text-fg-muted">
                Con tu correo te enviamos la boleta/factura electrónica directo, sin papel.
              </p>
            </div>
            {error && <p className="text-xs font-bold text-red-400">{error}</p>}
            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-accent py-4 text-sm font-black text-accent-fg transition-transform active:scale-95 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <MessageCircle size={20} />}
              Pedir por WhatsApp
            </button>
          </div>
        )}
      </div>
    </>
  );
}
