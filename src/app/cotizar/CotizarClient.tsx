"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Trash2,
  Download,
  MessageCircle,
  Loader2,
  CheckCircle2,
  Building2,
  ShieldCheck,
  ChevronLeft,
  Search,
} from "lucide-react";
import {
  createQuotation,
  searchCatalogProducts,
  type CatalogProductResult,
} from "@/app/taller-control/(panel)/cotizaciones/actions";
import { generateQuotationPDF } from "@/lib/quotationPdfGenerator";

interface CotizarClientProps {
  initialProducts: CatalogProductResult[];
}

export function CotizarClient({ initialProducts }: CotizarClientProps) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [clientDocType, setClientDocType] = useState("RUC");
  const [clientDocNum, setClientDocNum] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<
    Array<{
      productId?: string | null;
      description: string;
      brand?: string;
      model?: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>
  >([
    {
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
    },
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogProductResult[]>(initialProducts.slice(0, 10));
  const [isSearching, setIsSearching] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdQuotation, setCreatedQuotation] = useState<any | null>(null);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults(initialProducts.slice(0, 10));
      return;
    }
    setIsSearching(true);
    try {
      const res = await searchCatalogProducts(q);
      setSearchResults(res);
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectItem = (index: number, prod: CatalogProductResult) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        productId: prod.id,
        description: prod.name,
        quantity: next[index].quantity || 1,
        unitPrice: prod.price,
        total: Number(((next[index].quantity || 1) * prod.price).toFixed(2)),
      };
      return next;
    });
    setActiveItemIndex(null);
    setSearchQuery("");
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: val };
      if (field === "quantity" || field === "unitPrice") {
        const qty = field === "quantity" ? Number(val) : target.quantity;
        const price = field === "unitPrice" ? Number(val) : target.unitPrice;
        target.total = Number((qty * price).toFixed(2));
      }
      next[index] = target;
      return next;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        description: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, it) => sum + (it.total || 0), 0);
  const igv = Number((subtotal * 0.18).toFixed(2));
  const total = Number((subtotal + igv).toFixed(2));

  const handleSubmit = () => {
    if (!clientName.trim()) {
      setErrorMessage("Por favor ingresa tu nombre o razón social.");
      return;
    }
    if (!clientPhone.trim()) {
      setErrorMessage("Por favor ingresa tu teléfono o WhatsApp de contacto.");
      return;
    }
    const empty = items.find((it) => !it.description.trim());
    if (empty) {
      setErrorMessage("Por favor describe los productos o servicios que deseas cotizar.");
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      const res = await createQuotation({
        clientName: clientName.trim(),
        clientDocType,
        clientDocNum: clientDocNum.trim() || null,
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || null,
        clientAddress: clientAddress.trim() || null,
        currency: "PEN",
        includeIgv: true,
        discount: 0,
        validDays: 15,
        status: "PENDIENTE",
        deliveryTime: "Inmediata sujeto a stock",
        paymentMethod: "Contado / Transferencia bancaria",
        warranty: "12 meses de garantía oficial Infosistel",
        notes: notes.trim() || null,
        items: items.map((it) => ({
          productId: it.productId || null,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      });

      if (res.error || !res.quotation) {
        setErrorMessage(res.error || "No se pudo generar la cotización.");
        return;
      }

      setCreatedQuotation(res.quotation);

      // Auto download PDF
      generateQuotationPDF({
        code: res.quotation.code,
        clientName: res.quotation.clientName,
        clientDocType: res.quotation.clientDocType,
        clientDocNum: res.quotation.clientDocNum,
        clientPhone: res.quotation.clientPhone,
        clientEmail: res.quotation.clientEmail,
        clientAddress: res.quotation.clientAddress,
        attentionTo: res.quotation.attentionTo,
        issueDate: res.quotation.issueDate,
        validDays: res.quotation.validDays,
        currency: res.quotation.currency,
        includeIgv: res.quotation.includeIgv,
        subtotal: res.quotation.subtotal,
        discount: res.quotation.discount,
        igv: res.quotation.igv,
        total: res.quotation.total,
        deliveryTime: res.quotation.deliveryTime,
        paymentMethod: res.quotation.paymentMethod,
        warranty: res.quotation.warranty,
        notes: res.quotation.notes,
        items: res.quotation.items,
      });
    });
  };

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Top Bar */}
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

          <Link
            href="/tienda"
            className="rounded-xl border border-border bg-bg px-3.5 py-1.5 text-xs font-semibold text-fg hover:border-accent hover:text-accent"
          >
            Ver Tienda Online
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-accent"
          >
            <ChevronLeft size={14} />
            <span>Volver al inicio</span>
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            Solicitar Cotización Oficial
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Completa los datos de tu empresa o proyecto para generar tu propuesta comercial formal con el logo de Infosistel y descargarla en PDF.
          </p>
        </div>

        {/* Success Screen */}
        {createdQuotation ? (
          <div className="admin-glass rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.03] p-8 text-center sm:p-12 shadow-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={36} />
            </div>

            <h2 className="mt-4 font-display text-2xl font-bold text-fg">
              ¡Cotización Generada Exitosamente!
            </h2>
            <p className="mt-1 font-mono text-sm font-bold text-accent">
              Código: {createdQuotation.code}
            </p>
            <p className="mt-2 text-xs text-fg-muted max-w-md mx-auto">
              Tu cotización ha sido registrada en el sistema oficial de Infosistel. Tu PDF se ha descargado automáticamente.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  generateQuotationPDF({
                    code: createdQuotation.code,
                    clientName: createdQuotation.clientName,
                    clientDocType: createdQuotation.clientDocType,
                    clientDocNum: createdQuotation.clientDocNum,
                    clientPhone: createdQuotation.clientPhone,
                    clientEmail: createdQuotation.clientEmail,
                    clientAddress: createdQuotation.clientAddress,
                    attentionTo: createdQuotation.attentionTo,
                    issueDate: createdQuotation.issueDate,
                    validDays: createdQuotation.validDays,
                    currency: createdQuotation.currency,
                    includeIgv: createdQuotation.includeIgv,
                    subtotal: createdQuotation.subtotal,
                    discount: createdQuotation.discount,
                    igv: createdQuotation.igv,
                    total: createdQuotation.total,
                    deliveryTime: createdQuotation.deliveryTime,
                    paymentMethod: createdQuotation.paymentMethod,
                    warranty: createdQuotation.warranty,
                    notes: createdQuotation.notes,
                    items: createdQuotation.items,
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition-all hover:opacity-90 active:scale-95"
              >
                <Download size={15} />
                <span>Volver a Descargar PDF</span>
              </button>

              <a
                href={`https://wa.me/51964648202?text=${encodeURIComponent(
                  `Hola Infosistel, he generado la cotización ${createdQuotation.code} por S/. ${createdQuotation.total.toFixed(2)} a nombre de ${createdQuotation.clientName} y deseo coordinar el pedido.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-95"
              >
                <MessageCircle size={15} />
                <span>Confirmar por WhatsApp</span>
              </a>

              <Link
                href={`/cotizacion/${createdQuotation.code}`}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg px-4 py-2.5 text-xs font-semibold text-fg hover:border-accent hover:text-accent"
              >
                <span>Ver Cotización Online</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="admin-glass rounded-3xl border border-border p-6 shadow-xl sm:p-8 space-y-6">
            {errorMessage && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Step 1: Customer Data */}
            <div className="rounded-2xl border border-border bg-bg-alt/40 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-3">
                1. Datos de Contacto o Empresa
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                    Nombre o Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Tu nombre completo o nombre de la empresa"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="admin-field mt-1 w-full rounded-xl px-3.5 py-2 text-xs font-semibold text-fg"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                    Tipo de Documento / RUC o DNI
                  </label>
                  <div className="mt-1 flex gap-1.5">
                    <select
                      value={clientDocType}
                      onChange={(e) => setClientDocType(e.target.value)}
                      className="admin-field w-24 rounded-xl px-2 py-2 text-xs font-semibold text-fg"
                    >
                      <option value="RUC">RUC</option>
                      <option value="DNI">DNI</option>
                      <option value="OTRO">Otro</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Número de documento"
                      value={clientDocNum}
                      onChange={(e) => setClientDocNum(e.target.value)}
                      className="admin-field w-full rounded-xl px-3 py-2 text-xs text-fg"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                    Teléfono / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="964 648 202"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="admin-field mt-1 w-full rounded-xl px-3.5 py-2 text-xs text-fg"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="tu-correo@empresa.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="admin-field mt-1 w-full rounded-xl px-3.5 py-2 text-xs text-fg"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                    Dirección / Ciudad
                  </label>
                  <input
                    type="text"
                    placeholder="Huancayo, El Tambo, etc."
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    className="admin-field mt-1 w-full rounded-xl px-3.5 py-2 text-xs text-fg"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Items */}
            <div className="rounded-2xl border border-border bg-bg-alt/40 p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-accent">
                  2. Productos o Servicios a Cotizar
                </h3>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="inline-flex items-center gap-1 rounded-xl bg-accent/15 px-3 py-1 text-xs font-bold text-accent hover:bg-accent/25"
                >
                  <Plus size={13} />
                  <span>+ Agregar otro ítem</span>
                </button>
              </div>

              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div key={idx} className="rounded-xl border border-border bg-bg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-fg-muted">Ítem #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length <= 1}
                        className="text-fg-muted hover:text-rose-500 disabled:opacity-30"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                          Descripción
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeItemIndex === idx) {
                              setActiveItemIndex(null);
                            } else {
                              setActiveItemIndex(idx);
                              setSearchQuery("");
                            }
                          }}
                          className="text-[10px] text-accent hover:underline font-semibold"
                        >
                          📦 Seleccionar del catálogo
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Ej. Laptop HP Core i7 o Mantenimiento de Computadoras"
                        value={it.description}
                        onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                        className="admin-field mt-1 w-full rounded-xl px-3 py-2 text-xs font-semibold text-fg"
                      />

                      {/* Search dropdown */}
                      {activeItemIndex === idx && (
                        <div className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-border bg-bg p-2 shadow-xl">
                          <input
                            type="text"
                            placeholder="Buscar en catálogo..."
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full border-b border-border bg-transparent px-2 pb-1.5 text-xs text-fg outline-none"
                          />
                          <div className="mt-1 space-y-1">
                            {searchResults.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectItem(idx, p)}
                                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent/10"
                              >
                                <span className="font-semibold text-fg">{p.name}</span>
                                <span className="font-bold text-accent">S/. {p.price.toFixed(2)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                          Cantidad
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          className="admin-field mt-1 w-full rounded-xl px-2.5 py-1.5 text-center text-xs font-bold text-fg"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                          Precio Unitario (S/.)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.unitPrice}
                          onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                          className="admin-field mt-1 w-full rounded-xl px-2.5 py-1.5 text-right text-xs font-bold text-fg"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-1 text-right">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                          Total
                        </label>
                        <p className="mt-1 flex h-[34px] items-center justify-end font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          S/. {it.total.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Box */}
              <div className="mt-4 flex flex-col items-end">
                <div className="w-full max-w-xs space-y-1.5 text-xs">
                  <div className="flex justify-between text-fg-muted">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-fg">S/. {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-fg-muted">
                    <span>I.G.V. (18%):</span>
                    <span className="font-semibold text-fg">S/. {igv.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5 text-sm font-bold text-fg">
                    <span>TOTAL ESTIMADO:</span>
                    <span className="text-accent">S/. {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Additional Notes */}
            <div className="rounded-2xl border border-border bg-bg-alt/40 p-5">
              <label className="text-xs font-bold uppercase tracking-wider text-accent">
                3. Requerimientos o Notas Adicionales
              </label>
              <textarea
                rows={2}
                placeholder="Especifica detalles de configuración, lugar de entrega o cualquier requerimiento especial..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="admin-field mt-2 w-full rounded-xl px-3.5 py-2 text-xs text-fg"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent px-8 py-3 text-sm font-bold text-accent-fg shadow-lg shadow-accent/25 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Generando Cotización y PDF...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Generar Cotización y Descargar PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
