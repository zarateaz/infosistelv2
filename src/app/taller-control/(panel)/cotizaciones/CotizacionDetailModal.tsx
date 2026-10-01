"use client";

import { useState } from "react";
import {
  X,
  Download,
  MessageCircle,
  Printer,
  Edit2,
  Calendar,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  CreditCard,
  Truck,
  ExternalLink,
} from "lucide-react";
import type { QuotationRecord } from "./actions";
import { generateQuotationPDF } from "@/lib/quotationPdfGenerator";
import { updateQuotationStatus, buildWhatsAppQuotationLink } from "./actions";

interface CotizacionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: QuotationRecord | null;
  onEdit: (quotation: QuotationRecord) => void;
  onStatusChange: (id: string, newStatus: any) => void;
}

export function CotizacionDetailModal({
  isOpen,
  onClose,
  quotation,
  onEdit,
  onStatusChange,
}: CotizacionDetailModalProps) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  if (!isOpen || !quotation) return null;

  const currSymbol = quotation.currency === "USD" ? "$" : "S/.";

  const handleDownloadPDF = () => {
    generateQuotationPDF({
      code: quotation.code,
      clientName: quotation.clientName,
      clientDocType: quotation.clientDocType,
      clientDocNum: quotation.clientDocNum,
      clientPhone: quotation.clientPhone,
      clientEmail: quotation.clientEmail,
      clientAddress: quotation.clientAddress,
      attentionTo: quotation.attentionTo,
      issueDate: quotation.issueDate,
      validDays: quotation.validDays,
      currency: quotation.currency,
      includeIgv: quotation.includeIgv,
      subtotal: quotation.subtotal,
      discount: quotation.discount,
      igv: quotation.igv,
      total: quotation.total,
      deliveryTime: quotation.deliveryTime,
      paymentMethod: quotation.paymentMethod,
      warranty: quotation.warranty,
      notes: quotation.notes,
      items: quotation.items,
    });
  };

  const handleSendWhatsApp = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://infosistel.pe";
    const link = await buildWhatsAppQuotationLink(quotation, origin);
    window.open(link, "_blank");
  };

  const handleStatusSelect = async (newStatus: any) => {
    try {
      setIsUpdatingStatus(true);
      await updateQuotationStatus(quotation.id, newStatus);
      onStatusChange(quotation.id, newStatus);
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const statusColors: Record<string, string> = {
    PENDIENTE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    ENVIADA: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    APROBADA: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    RECHAZADA: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    FACTURADA: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="admin-glass relative my-8 w-full max-w-3xl rounded-3xl border border-border bg-bg p-6 shadow-2xl sm:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-fg sm:text-2xl">
                {quotation.code}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  statusColors[quotation.status] || "bg-fg/10 text-fg-muted"
                }`}
              >
                {quotation.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-fg-muted">
              Emitida el {new Date(quotation.issueDate).toLocaleDateString("es-PE")} · Validez de {quotation.validDays} días
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(quotation);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-bg-alt px-3 py-1.5 text-xs font-semibold text-fg hover:border-accent hover:text-accent"
            >
              <Edit2 size={13} />
              <span>Editar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-alt text-fg-muted transition-colors hover:text-fg"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent/5 border border-accent/20 p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">
                Cambiar Estado:
              </span>
              <select
                value={quotation.status}
                onChange={(e) => handleStatusSelect(e.target.value)}
                disabled={isUpdatingStatus}
                className="admin-field rounded-xl px-2.5 py-1 text-xs font-bold text-fg"
              >
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="ENVIADA">ENVIADA</option>
                <option value="APROBADA">APROBADA</option>
                <option value="RECHAZADA">RECHAZADA</option>
                <option value="FACTURADA">FACTURADA</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-fg shadow-sm shadow-accent/25 transition-all hover:opacity-90 active:scale-95"
              >
                <Download size={13} />
                <span>Descargar PDF</span>
              </button>

              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
              >
                <MessageCircle size={13} />
                <span>WhatsApp</span>
              </button>

              <a
                href={`/cotizacion/${quotation.code}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-accent hover:text-accent"
              >
                <ExternalLink size={13} />
                <span>Ver online</span>
              </a>
            </div>
          </div>

          {/* Client Info Grid */}
          <div className="rounded-2xl border border-border bg-bg-alt/40 p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-accent">
              Información del Cliente
            </h4>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-fg-muted">Cliente:</span>{" "}
                <span className="font-bold text-fg">{quotation.clientName}</span>
              </div>
              <div>
                <span className="text-fg-muted">{quotation.clientDocType || "Doc"}:</span>{" "}
                <span className="font-semibold text-fg">{quotation.clientDocNum || "No especificado"}</span>
              </div>
              <div>
                <span className="text-fg-muted">Atención a:</span>{" "}
                <span className="font-semibold text-fg">{quotation.attentionTo || quotation.clientName}</span>
              </div>
              <div>
                <span className="text-fg-muted">Teléfono:</span>{" "}
                <span className="font-semibold text-fg">{quotation.clientPhone || "-"}</span>
              </div>
              <div>
                <span className="text-fg-muted">Correo:</span>{" "}
                <span className="font-semibold text-fg">{quotation.clientEmail || "-"}</span>
              </div>
              <div>
                <span className="text-fg-muted">Dirección:</span>{" "}
                <span className="font-semibold text-fg">{quotation.clientAddress || "Huancayo"}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-bg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-bg-alt/70 text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                  <th className="px-3.5 py-2.5 text-center w-8">#</th>
                  <th className="px-3.5 py-2.5 text-center w-12">Cant.</th>
                  <th className="px-3.5 py-2.5">Descripción</th>
                  <th className="px-3.5 py-2.5 text-right w-24">P. Unit.</th>
                  <th className="px-3.5 py-2.5 text-right w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {quotation.items.map((it, idx) => (
                  <tr key={it.id || idx} className="hover:bg-fg/[0.02]">
                    <td className="px-3.5 py-2.5 text-center font-bold text-fg-muted">{idx + 1}</td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-fg">{it.quantity}</td>
                    <td className="px-3.5 py-2.5">
                      <p className="font-semibold text-fg">{it.description}</p>
                      {(it.brand || it.model) && (
                        <p className="text-[10px] text-fg-muted">
                          {[it.brand, it.model].filter(Boolean).join(" - ")}
                        </p>
                      )}
                      {it.notes && <p className="text-[10px] text-accent/80">{it.notes}</p>}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-medium text-fg">
                      {currSymbol} {it.unitPrice.toFixed(2)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {currSymbol} {it.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex flex-col items-end">
            <div className="w-full max-w-xs space-y-1.5 rounded-2xl border border-border bg-bg-alt/50 p-4 text-xs">
              <div className="flex items-center justify-between text-fg-muted">
                <span>Subtotal:</span>
                <span className="font-semibold text-fg">
                  {currSymbol} {quotation.subtotal.toFixed(2)}
                </span>
              </div>
              {(quotation.discount || 0) > 0 && (
                <div className="flex items-center justify-between text-rose-600">
                  <span>Descuento:</span>
                  <span className="font-semibold">
                    -{currSymbol} {quotation.discount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-fg-muted">
                <span>{quotation.includeIgv ? "I.G.V. (18%):" : "I.G.V. (Exonerado):"}</span>
                <span className="font-semibold text-fg">
                  {currSymbol} {quotation.igv.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-bold text-fg">
                <span>TOTAL:</span>
                <span className="text-base text-accent">
                  {currSymbol} {quotation.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Commercial conditions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-2xl border border-border bg-bg-alt/30 p-3.5 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                Condiciones Comerciales
              </span>
              <p className="text-fg-muted">
                • <strong className="text-fg">Entrega:</strong> {quotation.deliveryTime || "Inmediata"}
              </p>
              <p className="text-fg-muted">
                • <strong className="text-fg">Pago:</strong> {quotation.paymentMethod || "Contado / Transferencia"}
              </p>
              <p className="text-fg-muted">
                • <strong className="text-fg">Garantía:</strong> {quotation.warranty || "12 meses oficial"}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-bg-alt/30 p-3.5 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                Cuentas Bancarias
              </span>
              <p className="text-fg-muted">• BCP Soles: 355-98765432-0-12</p>
              <p className="text-fg-muted">• BBVA Soles: 0011-0234-0200987654</p>
              <p className="text-fg-muted">• Yape / Plin: 964 648 202</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
