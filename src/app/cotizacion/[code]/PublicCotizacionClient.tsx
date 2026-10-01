"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Download,
  MessageCircle,
  Calendar,
  Building2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronLeft,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import type { QuotationRecord } from "@/app/taller-control/(panel)/cotizaciones/actions";
import { generateQuotationPDF } from "@/lib/quotationPdfGenerator";

export function PublicCotizacionClient({ quotation }: { quotation: QuotationRecord }) {
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

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Hola Infosistel, he revisado la cotización ${quotation.code} por ${currSymbol} ${quotation.total.toFixed(2)} a nombre de ${quotation.clientName} y deseo confirmar el pedido. ¿Cuáles son los siguientes pasos?`
    );
    window.open(`https://wa.me/51964648202?text=${text}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Top Navbar */}
      <header className="border-b border-border bg-bg-alt/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/brand/infosistel-logo-v3.png"
              alt="Infosistel"
              width={1366}
              height={166}
              priority
              className="h-8 w-auto object-contain"
            />
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-fg shadow-sm shadow-accent/25 transition-all hover:opacity-90 active:scale-95"
            >
              <Download size={14} />
              <span>Descargar PDF</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
            >
              <MessageCircle size={14} />
              <span className="hidden sm:inline">Confirmar por WhatsApp</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-accent"
          >
            <ChevronLeft size={14} />
            <span>Volver a Infosistel</span>
          </Link>
        </div>

        {/* Document Card */}
        <div className="admin-glass rounded-3xl border border-border p-6 shadow-xl sm:p-10">
          {/* Header row */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-6">
            <div>
              <Image
                src="/brand/infosistel-logo-v3.png"
                alt="Infosistel"
                width={1366}
                height={166}
                priority
                className="h-9 w-auto object-contain"
              />
              <p className="mt-2 text-xs font-bold text-accent">
                TECNOLOGÍA · VENTA DE EQUIPOS · SERVICIO TÉCNICO · REPUESTOS
              </p>
              <p className="text-xs text-fg-muted mt-0.5">
                RUC: 10444342247 · Huancayo, Junín, Perú
              </p>
              <p className="text-xs text-fg-muted">
                WhatsApp: (+51) 964 648 202 · Web: infosistel.pe
              </p>
            </div>

            <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                Propuesta Comercial
              </span>
              <h2 className="font-display text-xl font-bold text-fg sm:text-2xl">
                {quotation.code}
              </h2>
              <p className="text-xs text-fg-muted mt-1">
                Fecha: {new Date(quotation.issueDate).toLocaleDateString("es-PE")}
              </p>
              <p className="text-xs font-semibold text-accent">
                Válido por {quotation.validDays} días calendario
              </p>
            </div>
          </div>

          {/* Customer info */}
          <div className="mt-6 rounded-2xl bg-bg-alt/50 border border-border p-4 sm:p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-3">
              Datos del Cliente
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-fg-muted">Cliente:</span>{" "}
                <span className="font-bold text-fg">{quotation.clientName}</span>
              </div>
              <div>
                <span className="text-fg-muted">{quotation.clientDocType || "Documento"}:</span>{" "}
                <span className="font-semibold text-fg">{quotation.clientDocNum || "Sin documento"}</span>
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
                <span className="text-fg-muted">Dirección:</span>{" "}
                <span className="font-semibold text-fg">{quotation.clientAddress || "Huancayo"}</span>
              </div>
              <div>
                <span className="text-fg-muted">Correo:</span>{" "}
                <span className="font-semibold text-fg">{quotation.clientEmail || "-"}</span>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-bg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-bg-alt text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                  <th className="px-4 py-3 text-center w-10">#</th>
                  <th className="px-4 py-3 text-center w-14">Cant.</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3 text-right w-28">P. Unitario</th>
                  <th className="px-4 py-3 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {quotation.items.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="px-4 py-3 text-center font-bold text-fg-muted">{idx + 1}</td>
                    <td className="px-4 py-3 text-center font-bold text-fg">{it.quantity}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-fg text-sm">{it.description}</p>
                      {(it.brand || it.model) && (
                        <p className="text-[11px] text-fg-muted">
                          {[it.brand, it.model].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {it.notes && <p className="text-[11px] text-accent/80 mt-0.5">{it.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-fg">
                      {currSymbol} {it.unitPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {currSymbol} {it.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 flex flex-col items-end">
            <div className="w-full max-w-sm space-y-2 rounded-2xl border border-border bg-bg-alt/60 p-5 text-xs">
              <div className="flex items-center justify-between text-fg-muted">
                <span>Subtotal:</span>
                <span className="font-semibold text-fg">
                  {currSymbol} {quotation.subtotal.toFixed(2)}
                </span>
              </div>
              {(quotation.discount || 0) > 0 && (
                <div className="flex items-center justify-between text-rose-600 font-semibold">
                  <span>Descuento aplicado:</span>
                  <span>
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
              <div className="flex items-center justify-between border-t border-border pt-2 text-base font-bold text-fg">
                <span>TOTAL GENERAL:</span>
                <span className="text-lg text-accent">
                  {currSymbol} {quotation.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Terms & Accounts */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div className="rounded-2xl border border-border bg-bg-alt/40 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-accent font-bold uppercase tracking-wider text-[11px]">
                <ShieldCheck size={14} />
                <span>Condiciones de la Oferta</span>
              </div>
              <p className="text-fg-muted">
                • <strong className="text-fg">Tiempo de Entrega:</strong>{" "}
                {quotation.deliveryTime || "Inmediata sujeto a stock"}
              </p>
              <p className="text-fg-muted">
                • <strong className="text-fg">Forma de Pago:</strong>{" "}
                {quotation.paymentMethod || "Contado contra entrega / Transferencia"}
              </p>
              <p className="text-fg-muted">
                • <strong className="text-fg">Garantía:</strong>{" "}
                {quotation.warranty || "12 meses de garantía oficial Infosistel"}
              </p>
              {quotation.notes && (
                <p className="text-fg-muted">
                  • <strong className="text-fg">Observaciones:</strong> {quotation.notes}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-bg-alt/40 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-accent font-bold uppercase tracking-wider text-[11px]">
                <Building2 size={14} />
                <span>Cuentas para Pago</span>
              </div>
              <p className="text-fg-muted">• BCP Soles: 355-98765432-0-12 (CCI: 002-3550098765432012-34)</p>
              <p className="text-fg-muted">• BBVA Soles: 0011-0234-0200987654</p>
              <p className="text-fg-muted">• Interbank Soles: 200-3001234567</p>
              <p className="text-fg-muted">• Yape / Plin: 964 648 202 (Titular: INFOSISTEL)</p>
            </div>
          </div>

          {/* Visítanos en Huancayo */}
          <div className="mt-4 rounded-2xl border border-border bg-bg-alt/40 p-5 text-xs">
            <h4 className="font-display font-bold uppercase tracking-wider text-accent text-[11px] mb-3">
              Visítanos en Huancayo
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-fg font-semibold">
                  <MapPin size={13} className="text-accent" />
                  <span>Dirección / Tiendas:</span>
                </div>
                <p className="text-fg-muted pl-4.5">• Av. Giráldez 274, Semisótano Stand S25, Huancayo</p>
                <p className="text-fg-muted pl-4.5">• Av. Giráldez 274, 1er Nivel Stand B-10, Huancayo</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-fg">
                  <Phone size={13} className="text-emerald-500" />
                  <span className="font-semibold">Teléfono / WhatsApp:</span>
                  <a href="https://wa.me/51964648202" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    +51 964 648 202
                  </a>
                </div>
                <div className="flex items-center gap-1.5 text-fg">
                  <Mail size={13} className="text-accent" />
                  <span className="font-semibold">Correo:</span>
                  <a href="mailto:ecaballero@hotmail.com" className="text-accent hover:underline">
                    ecaballero@hotmail.com
                  </a>
                </div>
                <div className="flex items-center gap-1.5 text-fg">
                  <Clock size={13} className="text-fg-muted" />
                  <span className="font-semibold">Horario:</span>
                  <span className="text-fg-muted">Lun. a sáb., 9:00 am – 7:00 pm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Call to Action */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 rounded-2xl bg-accent/10 border border-accent/30 p-6 text-center">
            <div>
              <p className="font-display text-base font-bold text-fg">
                ¿Deseas confirmar este pedido o necesitas algún cambio?
              </p>
              <p className="text-xs text-fg-muted mt-0.5">
                Comunícate directamente con nuestro equipo de ventas para coordinar la entrega o facturación.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition-all hover:opacity-90 active:scale-95"
              >
                <Download size={15} />
                <span>Descargar Cotización (PDF)</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsApp}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-95"
              >
                <MessageCircle size={15} />
                <span>Aceptar y Pedir por WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
