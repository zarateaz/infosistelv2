"use client";

import { useState, useEffect, useTransition } from "react";
import {
  X,
  Plus,
  Trash2,
  Search,
  Download,
  Save,
  Loader2,
  Building2,
  User,
  Calendar,
  DollarSign,
  ShieldCheck,
  Truck,
  CreditCard,
  Package,
} from "lucide-react";
import {
  createQuotation,
  updateQuotation,
  searchCatalogProducts,
  type CreateQuotationInput,
  type QuotationRecord,
  type QuotationItemData,
  type CatalogProductResult,
} from "./actions";
import { generateQuotationPDF } from "@/lib/quotationPdfGenerator";

interface CotizacionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotationToEdit?: QuotationRecord | null;
  onSuccess: (quotation: QuotationRecord) => void;
}

export function CotizacionFormModal({
  isOpen,
  onClose,
  quotationToEdit,
  onSuccess,
}: CotizacionFormModalProps) {
  const [clientName, setClientName] = useState("");
  const [clientDocType, setClientDocType] = useState("RUC");
  const [clientDocNum, setClientDocNum] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [attentionTo, setAttentionTo] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validDays, setValidDays] = useState(15);
  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN");
  const [includeIgv, setIncludeIgv] = useState(true);
  const [discount, setDiscount] = useState<number>(0);
  const [status, setStatus] = useState<"PENDIENTE" | "ENVIADA" | "APROBADA" | "RECHAZADA" | "FACTURADA">("PENDIENTE");
  const [deliveryTime, setDeliveryTime] = useState("Inmediata sujeto a stock");
  const [paymentMethod, setPaymentMethod] = useState("Contado contra entrega / Transferencia");
  const [warranty, setWarranty] = useState("12 meses de garantía oficial Infosistel");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<QuotationItemData[]>([
    {
      description: "",
      brand: "",
      model: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
      notes: "",
    },
  ]);

  // Catalog search state for auto-completing items
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogProductResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form when opening or editing
  useEffect(() => {
    if (quotationToEdit) {
      setClientName(quotationToEdit.clientName || "");
      setClientDocType(quotationToEdit.clientDocType || "RUC");
      setClientDocNum(quotationToEdit.clientDocNum || "");
      setClientPhone(quotationToEdit.clientPhone || "");
      setClientEmail(quotationToEdit.clientEmail || "");
      setClientAddress(quotationToEdit.clientAddress || "");
      setAttentionTo(quotationToEdit.attentionTo || "");
      setIssueDate(new Date(quotationToEdit.issueDate).toISOString().slice(0, 10));
      setValidDays(quotationToEdit.validDays || 15);
      setCurrency((quotationToEdit.currency as "PEN" | "USD") || "PEN");
      setIncludeIgv(quotationToEdit.includeIgv ?? true);
      setDiscount(quotationToEdit.discount || 0);
      setStatus(
        (quotationToEdit.status as "PENDIENTE" | "ENVIADA" | "APROBADA" | "RECHAZADA" | "FACTURADA") ||
          "PENDIENTE"
      );
      setDeliveryTime(quotationToEdit.deliveryTime || "Inmediata sujeto a stock");
      setPaymentMethod(quotationToEdit.paymentMethod || "Contado contra entrega / Transferencia");
      setWarranty(quotationToEdit.warranty || "12 meses de garantía oficial Infosistel");
      setNotes(quotationToEdit.notes || "");
      setItems(
        quotationToEdit.items.length > 0
          ? quotationToEdit.items
          : [
              {
                description: "",
                brand: "",
                model: "",
                quantity: 1,
                unitPrice: 0,
                total: 0,
                notes: "",
              },
            ]
      );
    } else {
      // Defaults for fresh quotation
      setClientName("");
      setClientDocType("RUC");
      setClientDocNum("");
      setClientPhone("");
      setClientEmail("");
      setClientAddress("");
      setAttentionTo("");
      setIssueDate(new Date().toISOString().slice(0, 10));
      setValidDays(15);
      setCurrency("PEN");
      setIncludeIgv(true);
      setDiscount(0);
      setStatus("PENDIENTE");
      setDeliveryTime("Inmediata sujeto a stock");
      setPaymentMethod("Contado contra entrega / Transferencia");
      setWarranty("12 meses de garantía oficial Infosistel");
      setNotes("");
      setItems([
        {
          description: "",
          brand: "",
          model: "",
          quantity: 1,
          unitPrice: 0,
          total: 0,
          notes: "",
        },
      ]);
    }
    setErrorMessage(null);
  }, [quotationToEdit, isOpen]);

  // Catalog product search with debounce
  useEffect(() => {
    if (!searchQuery.trim() || activeItemIndex === null) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchCatalogProducts(searchQuery);
        setSearchResults(res);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, activeItemIndex]);

  // Update item field
  const handleItemChange = (index: number, field: keyof QuotationItemData, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        const qty = field === "quantity" ? Number(value) : target.quantity;
        const price = field === "unitPrice" ? Number(value) : target.unitPrice;
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
        brand: "",
        model: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
        notes: "",
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (activeItemIndex === index) {
      setActiveItemIndex(null);
      setSearchQuery("");
    }
  };

  const handleSelectProduct = (index: number, product: CatalogProductResult) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: product.id,
        description: product.name,
        unitPrice: product.price,
        total: Number((next[index].quantity * product.price).toFixed(2)),
      };
      return next;
    });
    setActiveItemIndex(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Computations
  const subtotal = items.reduce((sum, it) => sum + (it.total || 0), 0);
  const taxableBase = Math.max(0, subtotal - (discount || 0));
  const igv = includeIgv ? Number((taxableBase * 0.18).toFixed(2)) : 0;
  const total = Number((taxableBase + igv).toFixed(2));

  const currSymbol = currency === "USD" ? "$" : "S/.";

  const handleSubmit = (andDownloadPdf: boolean = false) => {
    if (!clientName.trim()) {
      setErrorMessage("Por favor ingresa el nombre o razón social del cliente.");
      return;
    }

    const invalidItem = items.find((it) => !it.description.trim() || it.quantity <= 0);
    if (invalidItem) {
      setErrorMessage("Verifica que todos los ítems tengan descripción y cantidad mayor a cero.");
      return;
    }

    const payload: CreateQuotationInput = {
      clientName: clientName.trim(),
      clientDocType: clientDocType || null,
      clientDocNum: clientDocNum.trim() || null,
      clientPhone: clientPhone.trim() || null,
      clientEmail: clientEmail.trim() || null,
      clientAddress: clientAddress.trim() || null,
      attentionTo: attentionTo.trim() || null,
      issueDate,
      validDays: Number(validDays) || 15,
      currency,
      includeIgv,
      discount: Number(discount) || 0,
      status,
      deliveryTime: deliveryTime.trim() || null,
      paymentMethod: paymentMethod.trim() || null,
      warranty: warranty.trim() || null,
      notes: notes.trim() || null,
      items: items.map((it) => ({
        productId: it.productId || null,
        description: it.description.trim(),
        brand: it.brand?.trim() || null,
        model: it.model?.trim() || null,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        notes: it.notes?.trim() || null,
      })),
    };

    setErrorMessage(null);

    startTransition(async () => {
      let res;
      if (quotationToEdit) {
        res = await updateQuotation(quotationToEdit.id, payload);
      } else {
        res = await createQuotation(payload);
      }

      if (res.error || !res.quotation) {
        setErrorMessage(res.error || "Ocurrió un error al guardar.");
        return;
      }

      if (andDownloadPdf) {
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
      }

      onSuccess(res.quotation);
      onClose();
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="admin-glass relative my-8 w-full max-w-4xl rounded-3xl border border-border bg-bg p-6 shadow-2xl sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-fg sm:text-2xl">
              {quotationToEdit ? `Editar Cotización — ${quotationToEdit.code}` : "Nueva Cotización Comercial"}
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              Crea propuestas comerciales personalizadas con desglose de precios y exportación oficial en PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-alt text-fg-muted transition-colors hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Form Body */}
        <div className="mt-6 space-y-6 max-h-[72vh] overflow-y-auto pr-1">
          {/* Section 1: Customer Details */}
          <div className="rounded-2xl border border-border bg-bg-alt/50 p-4">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
              <User size={14} />
              Datos del Cliente
            </h3>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                  Cliente / Razón Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Constructora Los Andes S.A.C. o Juan Pérez"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="admin-field mt-1 w-full rounded-xl px-3.5 py-2 text-xs font-semibold text-fg"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                  Tipo Doc. / Número
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
                    placeholder="20601234567"
                    value={clientDocNum}
                    onChange={(e) => setClientDocNum(e.target.value)}
                    className="admin-field w-full rounded-xl px-3 py-2 text-xs text-fg"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                  Teléfono / Celular
                </label>
                <input
                  type="tel"
                  placeholder="964648202"
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
                  placeholder="contacto@empresa.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="admin-field mt-1 w-full rounded-xl px-3.5 py-2 text-xs text-fg"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                  Atención a (Contacto)
                </label>
                <input
                  type="text"
                  placeholder="Ing. Carlos Pérez"
                  value={attentionTo}
                  onChange={(e) => setAttentionTo(e.target.value)}
                  className="admin-field mt-1 w-full rounded-xl px-3.5 py-2 text-xs text-fg"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                  Dirección
                </label>
                <input
                  type="text"
                  placeholder="Av. Ferrocarril 123, Huancayo"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="admin-field mt-1 w-full rounded-xl px-3.5 py-2 text-xs text-fg"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Quotation Settings & Currency */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-bg-alt/50 p-4 sm:grid-cols-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                Fecha Emisión
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="admin-field mt-1 w-full rounded-xl px-3 py-2 text-xs text-fg"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                Validez (días)
              </label>
              <input
                type="number"
                min="1"
                max="180"
                value={validDays}
                onChange={(e) => setValidDays(Number(e.target.value))}
                className="admin-field mt-1 w-full rounded-xl px-3 py-2 text-xs text-fg font-semibold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                Moneda
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "PEN" | "USD")}
                className="admin-field mt-1 w-full rounded-xl px-3 py-2 text-xs text-fg font-bold"
              >
                <option value="PEN">Soles (PEN S/.)</option>
                <option value="USD">Dólares (USD $)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="admin-field mt-1 w-full rounded-xl px-3 py-2 text-xs text-fg font-bold"
              >
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="ENVIADA">ENVIADA</option>
                <option value="APROBADA">APROBADA</option>
                <option value="RECHAZADA">RECHAZADA</option>
                <option value="FACTURADA">FACTURADA</option>
              </select>
            </div>
          </div>

          {/* Section 3: Items Table */}
          <div className="rounded-2xl border border-border bg-bg-alt/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
                <Package size={14} />
                Productos y Servicios Cotizados ({items.length})
              </h3>

              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent transition-colors hover:bg-accent/25"
              >
                <Plus size={13} />
                <span>+ Agregar Ítem</span>
              </button>
            </div>

            {/* Items list */}
            <div className="mt-4 space-y-3">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="relative rounded-xl border border-border/80 bg-bg p-3.5 shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                    <span className="text-xs font-bold text-fg-muted">Ítem #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      disabled={items.length <= 1}
                      className="text-fg-muted hover:text-rose-500 disabled:opacity-30"
                      title="Eliminar ítem"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                    {/* Description & Search */}
                    <div className="relative sm:col-span-6">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                          Descripción del producto o servicio *
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeItemIndex === idx) {
                              setActiveItemIndex(null);
                              setSearchQuery("");
                            } else {
                              setActiveItemIndex(idx);
                              setSearchQuery("");
                            }
                          }}
                          className="text-[10px] font-semibold text-accent hover:underline"
                        >
                          🔍 Buscar en inventario
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Ej. Laptop HP Core i7 16GB RAM o Mantenimiento General"
                        value={it.description}
                        onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                        className="admin-field mt-1 w-full rounded-xl px-3 py-2 text-xs font-medium text-fg"
                      />

                      {/* Dropdown for catalog search */}
                      {activeItemIndex === idx && (
                        <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-border bg-bg p-2 shadow-xl">
                          <div className="flex items-center gap-2 border-b border-border px-2 pb-2">
                            <Search size={14} className="text-fg-muted" />
                            <input
                              type="text"
                              autoFocus
                              placeholder="Escribe nombre o marca del producto..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full bg-transparent text-xs text-fg outline-none"
                            />
                            {isSearching && <Loader2 size={13} className="animate-spin text-accent" />}
                          </div>

                          <div className="mt-1 space-y-1">
                            {searchResults.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectProduct(idx, p)}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs hover:bg-accent/10"
                              >
                                <div>
                                  <p className="font-semibold text-fg">{p.name}</p>
                                  <p className="text-[10px] text-fg-muted">
                                    Cat: {p.category || "General"} · Stock: {p.stock} u.
                                  </p>
                                </div>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {currSymbol} {p.price.toFixed(2)}
                                </span>
                              </button>
                            ))}
                            {searchQuery.trim() && searchResults.length === 0 && !isSearching && (
                              <p className="p-3 text-center text-xs text-fg-muted">
                                No se encontraron productos. Puedes escribir el ítem manualmente.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Brand / Model */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                        Marca / Modelo
                      </label>
                      <input
                        type="text"
                        placeholder="HP / Pavilion"
                        value={it.brand || ""}
                        onChange={(e) => handleItemChange(idx, "brand", e.target.value)}
                        className="admin-field mt-1 w-full rounded-xl px-3 py-2 text-xs text-fg"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="sm:col-span-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                        Cant.
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        className="admin-field mt-1 w-full rounded-xl px-2.5 py-2 text-center text-xs font-bold text-fg"
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="sm:col-span-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                        P. Unit ({currSymbol})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                        className="admin-field mt-1 w-full rounded-xl px-2.5 py-2 text-right text-xs font-bold text-fg"
                      />
                    </div>

                    {/* Row Total */}
                    <div className="sm:col-span-1.5 text-right">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                        Importe
                      </label>
                      <div className="mt-1 flex h-[34px] items-center justify-end px-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {currSymbol} {it.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Breakdown */}
            <div className="mt-4 flex flex-col items-end gap-2 border-t border-border pt-4">
              <div className="w-full max-w-xs space-y-2 text-xs">
                <div className="flex items-center justify-between text-fg-muted">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-fg">
                    {currSymbol} {subtotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-fg-muted">
                  <span>Descuento:</span>
                  <div className="flex items-center gap-1">
                    <span>- {currSymbol}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="admin-field w-20 rounded-lg px-2 py-0.5 text-right font-semibold text-fg"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-fg-muted">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeIgv}
                      onChange={(e) => setIncludeIgv(e.target.checked)}
                      className="h-3.5 w-3.5 rounded text-accent"
                    />
                    <span>Incluir I.G.V. (18%)</span>
                  </label>
                  <span className="font-semibold text-fg">
                    {currSymbol} {igv.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-bold text-fg">
                  <span>TOTAL COTIZACIÓN:</span>
                  <span className="text-base text-accent">
                    {currSymbol} {total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Terms & Banking */}
          <div className="rounded-2xl border border-border bg-bg-alt/50 p-4">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
              <ShieldCheck size={14} />
              Condiciones Comerciales
            </h3>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                  Tiempo de Entrega
                </label>
                <input
                  type="text"
                  placeholder="Inmediata sujeto a stock"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  className="admin-field mt-1 w-full rounded-xl px-3.5 py-2 text-xs text-fg"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                  Forma de Pago
                </label>
                <input
                  type="text"
                  placeholder="Contado contra entrega / Transferencia"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="admin-field mt-1 w-full rounded-xl px-3.5 py-2 text-xs text-fg"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                  Garantía
                </label>
                <input
                  type="text"
                  placeholder="12 meses de garantía oficial"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  className="admin-field mt-1 w-full rounded-xl px-3.5 py-2 text-xs text-fg"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                  Notas / Observaciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Incluye configuración de Windows y drivers. Precios sujetos a stock."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="admin-field mt-1 w-full rounded-xl px-3.5 py-2 text-xs text-fg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-fg-muted hover:text-fg"
          >
            Cancelar
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-accent bg-accent/10 px-4 py-2.5 text-xs font-bold text-accent transition-colors hover:bg-accent/20 active:scale-95 disabled:opacity-50"
              title="Guardar y generar el PDF oficial con logo"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>Guardar y Descargar PDF</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{quotationToEdit ? "Actualizar Cotización" : "Crear Cotización"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
