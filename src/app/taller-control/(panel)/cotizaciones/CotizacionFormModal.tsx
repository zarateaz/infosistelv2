"use client";

import { useState, useEffect, useRef, useTransition } from "react";
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
  Camera,
  Sparkles,
  Calculator,
  Percent,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Upload,
} from "lucide-react";
import {
  createQuotation,
  updateQuotation,
  searchCatalogProducts,
  recognizeQuotationItemImage,
  type CreateQuotationInput,
  type QuotationRecord,
  type QuotationItemData,
  type CatalogProductResult,
  type RecognizeQuotationItemResult,
} from "./actions";
import { generateQuotationPDF } from "@/lib/quotationPdfGenerator";
import { getPeruTodayString, toDateInputValue } from "@/lib/quotationDates";
import { QuotationPhotosField } from "./QuotationPhotosField";

/** Optimiza y reduce la foto antes de enviarla al modelo de IA */
async function resizeImageForRecognition(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}

/** Calcula el precio de venta unitario a partir del costo y el porcentaje exacto */
function computePriceFromCost(cost: number, marginPercent: number, mode: "MARKUP" | "MARGIN"): number {
  if (cost <= 0) return 0;
  if (mode === "MARKUP") {
    // Margen sobre costo: Costo * (1 + % / 100)
    return Number((cost * (1 + marginPercent / 100)).toFixed(2));
  } else {
    // Margen comercial sobre venta: Costo / (1 - % / 100)
    if (marginPercent >= 100) return Number(cost.toFixed(2));
    return Number((cost / (1 - marginPercent / 100)).toFixed(2));
  }
}

/** Calcula el porcentaje exacto de ganancia a partir del costo y el precio de venta */
function computeMarginFromPrice(cost: number, unitPrice: number, mode: "MARKUP" | "MARGIN"): number {
  if (cost <= 0) return 0;
  if (mode === "MARKUP") {
    return Number((((unitPrice - cost) / cost) * 100).toFixed(2));
  } else {
    return unitPrice > 0 ? Number((((unitPrice - cost) / unitPrice) * 100).toFixed(2)) : 0;
  }
}

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
  const [issueDate, setIssueDate] = useState(() => getPeruTodayString());
  const [validDays, setValidDays] = useState(15);
  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN");
  const [includeIgv, setIncludeIgv] = useState(true);
  const [discount, setDiscount] = useState<number>(0);
  const [status, setStatus] = useState<"PENDIENTE" | "ENVIADA" | "APROBADA" | "RECHAZADA" | "FACTURADA">("PENDIENTE");
  const [deliveryTime, setDeliveryTime] = useState("Inmediata sujeto a stock");
  const [paymentMethod, setPaymentMethod] = useState("Contado contra entrega / Transferencia");
  const [warranty, setWarranty] = useState("12 meses de garantía oficial Infosistel");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);

  // Sistema de cotización: Modo de cálculo de margen (MARKUP sobre costo vs MARGIN sobre venta)
  const [marginMode, setMarginMode] = useState<"MARKUP" | "MARGIN">("MARKUP");
  const [showMarginDetails, setShowMarginDetails] = useState<Record<number, boolean>>({});
  const [showProfitSummary, setShowProfitSummary] = useState(true);

  // Reconocimiento con IA (Vision Model)
  const [showAiScanner, setShowAiScanner] = useState(false);
  const [aiScannerExpanded, setAiScannerExpanded] = useState(true);
  const [isRecognizingAi, setIsRecognizingAi] = useState(false);
  const [aiRecognizeProgress, setAiRecognizeProgress] = useState(0);
  const [aiRecognizeStage, setAiRecognizeStage] = useState("");
  const [aiResult, setAiResult] = useState<RecognizeQuotationItemResult | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiIsDragging, setAiIsDragging] = useState(false);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<QuotationItemData[]>([
    {
      description: "",
      brand: "",
      model: "",
      quantity: 1,
      unitPrice: 0,
      costPrice: 0,
      marginPercent: 0,
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
      setIssueDate(toDateInputValue(quotationToEdit.issueDate));
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
      if (quotationToEdit.images) {
        try {
          const parsed = JSON.parse(quotationToEdit.images);
          setImages(Array.isArray(parsed) ? parsed : []);
        } catch {
          setImages([]);
        }
      } else {
        setImages([]);
      }
      setItems(
        quotationToEdit.items.length > 0
          ? quotationToEdit.items.map((it) => {
              const cost = it.costPrice ?? 0;
              const margin =
                it.marginPercent ??
                (cost > 0 && it.unitPrice > 0
                  ? computeMarginFromPrice(cost, it.unitPrice, "MARKUP")
                  : 0);
              return {
                ...it,
                costPrice: cost,
                marginPercent: margin,
              };
            })
          : [
              {
                description: "",
                brand: "",
                model: "",
                quantity: 1,
                unitPrice: 0,
                costPrice: 0,
                marginPercent: 0,
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
      setIssueDate(getPeruTodayString());
      setValidDays(15);
      setCurrency("PEN");
      setIncludeIgv(true);
      setDiscount(0);
      setStatus("PENDIENTE");
      setDeliveryTime("Inmediata sujeto a stock");
      setPaymentMethod("Contado contra entrega / Transferencia");
      setWarranty("12 meses de garantía oficial Infosistel");
      setNotes("");
      setImages([]);
      setItems([
        {
          description: "",
          brand: "",
          model: "",
          quantity: 1,
          unitPrice: 0,
          costPrice: 0,
          marginPercent: 0,
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

  // Update item field with bidirectional exact margin calculation
  const handleItemChange = (index: number, field: keyof QuotationItemData, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };

      if (field === "quantity") {
        const qty = Number(value) || 1;
        target.quantity = qty;
        target.total = Number((qty * target.unitPrice).toFixed(2));
      } else if (field === "costPrice") {
        const cost = Number(value) || 0;
        target.costPrice = cost;
        // Si ya hay un porcentaje de margen establecido, recalcular el precio de venta unitario
        if (target.marginPercent && target.marginPercent > 0 && cost > 0) {
          target.unitPrice = computePriceFromCost(cost, target.marginPercent, marginMode);
          target.total = Number((target.quantity * target.unitPrice).toFixed(2));
        } else if (target.unitPrice > 0 && cost > 0) {
          target.marginPercent = computeMarginFromPrice(cost, target.unitPrice, marginMode);
        }
      } else if (field === "marginPercent") {
        const margin = Number(value) || 0;
        target.marginPercent = margin;
        if (target.costPrice && target.costPrice > 0) {
          target.unitPrice = computePriceFromCost(target.costPrice, margin, marginMode);
          target.total = Number((target.quantity * target.unitPrice).toFixed(2));
        }
      } else if (field === "unitPrice") {
        const price = Number(value) || 0;
        target.unitPrice = price;
        target.total = Number((target.quantity * price).toFixed(2));
        if (target.costPrice && target.costPrice > 0) {
          target.marginPercent = computeMarginFromPrice(target.costPrice, price, marginMode);
        }
      }

      next[index] = target;
      return next;
    });
  };

  const applyPresetMargin = (index: number, percent: number) => {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[index] };
      target.marginPercent = percent;
      if (target.costPrice && target.costPrice > 0) {
        target.unitPrice = computePriceFromCost(target.costPrice, percent, marginMode);
        target.total = Number((target.quantity * target.unitPrice).toFixed(2));
      }
      next[index] = target;
      return next;
    });
  };

  const toggleMarginDetails = (index: number) => {
    setShowMarginDetails((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
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
        costPrice: 0,
        marginPercent: 0,
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
    const cost = product.costPrice ?? 0;
    const price = product.price;
    const margin = cost > 0 ? computeMarginFromPrice(cost, price, marginMode) : 0;

    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: product.id,
        description: product.name,
        unitPrice: price,
        costPrice: cost,
        marginPercent: margin,
        total: Number((next[index].quantity * price).toFixed(2)),
      };
      return next;
    });
    setActiveItemIndex(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Efecto visual de simulación de progreso para reconocimiento IA
  const AI_STAGES = [
    { at: 0, label: "Leyendo la imagen con visión artificial…" },
    { at: 25, label: "Identificando marca, modelo y características…" },
    { at: 55, label: "Redactando especificaciones técnicas de cotización…" },
    { at: 80, label: "Buscando coincidencias en el inventario local…" },
  ];

  useEffect(() => {
    if (isRecognizingAi) {
      setAiRecognizeProgress(0);
      const start = performance.now();
      let raf: number;
      const tick = (now: number) => {
        const elapsedSec = (now - start) / 1000;
        const p = 92 * (1 - Math.exp(-elapsedSec / 2.8));
        setAiRecognizeProgress(p);
        const stage = AI_STAGES.reduce((lbl, s) => (p >= s.at ? s.label : lbl), AI_STAGES[0].label);
        setAiRecognizeStage(stage);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
  }, [isRecognizingAi]);

  async function handleAiImageProcess(file: File) {
    if (!file || !file.type.startsWith("image/")) {
      setAiError("Por favor selecciona un archivo de imagen válido (JPEG, PNG o WebP).");
      return;
    }
    setIsRecognizingAi(true);
    setAiError(null);
    setAiResult(null);

    try {
      const dataUrl = await resizeImageForRecognition(file);
      setAiImagePreview(dataUrl);

      const res = await recognizeQuotationItemImage(dataUrl);
      if (res.error) {
        setAiError(res.error);
        setIsRecognizingAi(false);
        return;
      }

      setAiResult(res);
      setAiRecognizeProgress(100);
      setAiRecognizeStage("¡Reconocimiento completado!");
    } catch {
      setAiError("No se pudo procesar la imagen. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setIsRecognizingAi(false);
      if (aiFileInputRef.current) aiFileInputRef.current.value = "";
    }
  }

  // Soporte directo para Ctrl + V (Pegar captura o foto desde portapapeles)
  useEffect(() => {
    if (!isOpen) return;

    function handlePaste(e: ClipboardEvent) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        if (!e.clipboardData?.files || e.clipboardData.files.length === 0) return;
      }

      const pasteItems = e.clipboardData?.items;
      if (!pasteItems) return;

      for (let i = 0; i < pasteItems.length; i++) {
        if (pasteItems[i].type.startsWith("image/")) {
          const file = pasteItems[i].getAsFile();
          if (file) {
            e.preventDefault();
            setShowAiScanner(true);
            setAiScannerExpanded(true);
            handleAiImageProcess(file);
            break;
          }
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen]);

  const applyAiResultAsNewItem = () => {
    if (!aiResult) return;
    const detectedCost = aiResult.detectedCost || 0;
    const detectedPrice =
      aiResult.detectedPrice ||
      (aiResult.matchedProduct ? aiResult.matchedProduct.price : 0);
    const cost =
      detectedCost ||
      (aiResult.matchedProduct?.costPrice ? aiResult.matchedProduct.costPrice : 0);
    const margin =
      cost > 0 && detectedPrice > 0
        ? computeMarginFromPrice(cost, detectedPrice, marginMode)
        : 0;

    setItems((prev) => [
      ...prev,
      {
        description: aiResult.description || "",
        brand: aiResult.brand || "",
        model: aiResult.model || "",
        quantity: aiResult.quantity || 1,
        unitPrice: detectedPrice,
        costPrice: cost,
        marginPercent: margin,
        total: Number(((aiResult.quantity || 1) * detectedPrice).toFixed(2)),
        notes: aiResult.notes || "",
        productId: aiResult.matchedProduct?.id || null,
      },
    ]);
    setAiResult(null);
    setAiImagePreview(null);
  };

  const applyAiResultToActiveItem = (index: number) => {
    if (!aiResult) return;
    const detectedCost = aiResult.detectedCost || 0;
    const detectedPrice =
      aiResult.detectedPrice ||
      (aiResult.matchedProduct ? aiResult.matchedProduct.price : 0);
    const cost =
      detectedCost ||
      (aiResult.matchedProduct?.costPrice ? aiResult.matchedProduct.costPrice : 0);
    const margin =
      cost > 0 && detectedPrice > 0
        ? computeMarginFromPrice(cost, detectedPrice, marginMode)
        : 0;

    setItems((prev) => {
      const next = [...prev];
      const qty = aiResult.quantity || next[index]?.quantity || 1;
      next[index] = {
        ...next[index],
        description: aiResult.description || next[index]?.description || "",
        brand: aiResult.brand || next[index]?.brand || "",
        model: aiResult.model || next[index]?.model || "",
        quantity: qty,
        unitPrice: detectedPrice || next[index]?.unitPrice || 0,
        costPrice: cost || next[index]?.costPrice || 0,
        marginPercent: margin || next[index]?.marginPercent || 0,
        total: Number((qty * (detectedPrice || next[index]?.unitPrice || 0)).toFixed(2)),
        notes: aiResult.notes || next[index]?.notes || "",
        productId: aiResult.matchedProduct?.id || next[index]?.productId || null,
      };
      return next;
    });
    setAiResult(null);
    setAiImagePreview(null);
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
      images: images.length > 0 ? images : undefined,
      items: items.map((it) => ({
        productId: it.productId || null,
        description: it.description.trim(),
        brand: it.brand?.trim() || null,
        model: it.model?.trim() || null,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        costPrice: it.costPrice !== undefined && it.costPrice !== null ? Number(it.costPrice) : 0,
        marginPercent: it.marginPercent !== undefined && it.marginPercent !== null ? Number(it.marginPercent) : 0,
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
        let pdfImages: string[] = images;
        if (res.quotation.images) {
          try {
            const parsed = JSON.parse(res.quotation.images);
            if (Array.isArray(parsed)) pdfImages = parsed;
          } catch {
            // keep images
          }
        }

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
          images: pdfImages,
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

          {/* Section 3: Items Table & AI Scanner */}
          <div className="rounded-2xl border border-border bg-bg-alt/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
                <Package size={14} />
                Productos y Servicios Cotizados ({items.length})
              </h3>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAiScanner((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all shadow-xs ${
                    showAiScanner
                      ? "border-purple-500 bg-purple-500/20 text-purple-600 dark:text-purple-300 ring-2 ring-purple-500/30"
                      : "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 hover:scale-[1.02]"
                  }`}
                  title="Reconoce productos desde fotos de cajas, etiquetas o proformas con IA"
                >
                  <Camera size={13} />
                  <Sparkles size={13} className="text-purple-500 animate-pulse" />
                  <span>Reconocer con IA</span>
                </button>

                <button
                  type="button"
                  onClick={addItemRow}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent transition-colors hover:bg-accent/25"
                >
                  <Plus size={13} />
                  <span>Agregar Ítem</span>
                </button>
              </div>
            </div>

            {/* Apartado de Reconocimiento Inteligente con IA (DeepSeek Vision) */}
            {showAiScanner && (
              <div className="mt-3 rounded-2xl border-2 border-purple-500/30 bg-purple-500/5 p-4 shadow-sm transition-all animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-300 shadow-xs">
                      <Sparkles size={17} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
                        Reconocimiento con IA de Productos y Cotizaciones
                        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold text-purple-600 dark:text-purple-300 uppercase tracking-wider">
                          IA Visión
                        </span>
                      </h4>
                      <p className="text-[11px] text-fg-muted">
                        Sube una foto de la caja, etiqueta técnica o proforma, o pega directamente con{" "}
                        <kbd className="rounded bg-bg-raised px-1 py-0.5 text-[10px] font-mono border border-border">
                          Ctrl + V
                        </kbd>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAiScannerExpanded(!aiScannerExpanded)}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-bg px-2.5 py-1 text-xs font-semibold text-fg-muted hover:text-fg transition-colors"
                      title={aiScannerExpanded ? "Recoger apartado para ocupar menos espacio" : "Agrandar apartado"}
                    >
                      {aiScannerExpanded ? (
                        <>
                          <Minimize2 size={12} />
                          <span>Recoger</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 size={12} />
                          <span>Agrandar</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAiScanner(false)}
                      className="rounded-xl p-1 text-fg-muted hover:text-fg transition-colors"
                      title="Cerrar panel de IA"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Contenido expandible / recogible */}
                {aiScannerExpanded ? (
                  <div className="mt-3 space-y-3">
                    {/* Input oculto de foto */}
                    <input
                      ref={aiFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAiImageProcess(file);
                      }}
                      className="hidden"
                    />

                    {/* Dropzone interactiva */}
                    {!isRecognizingAi && !aiResult && (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setAiIsDragging(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setAiIsDragging(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setAiIsDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleAiImageProcess(file);
                        }}
                        onClick={() => aiFileInputRef.current?.click()}
                        className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
                          aiIsDragging
                            ? "border-purple-500 bg-purple-500/15 scale-[1.01]"
                            : "border-purple-500/30 hover:border-purple-500/60 bg-bg/40 hover:bg-bg/60"
                        }`}
                      >
                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300">
                          <Camera size={20} />
                        </div>
                        <p className="text-xs font-bold text-fg">
                          Haz clic para subir foto o arrastra la imagen aquí
                        </p>
                        <p className="mt-1 text-[11px] text-fg-muted">
                          También puedes hacer una captura de pantalla y presionar{" "}
                          <span className="font-bold text-purple-600 dark:text-purple-300 underline">
                            Ctrl + V
                          </span>{" "}
                          para pegarla directamente.
                        </p>
                      </div>
                    )}

                    {/* Estado: Procesando con IA */}
                    {isRecognizingAi && (
                      <div className="rounded-2xl border border-purple-500/30 bg-bg p-4 shadow-sm">
                        <div className="mb-2 flex items-center justify-between text-xs font-bold text-fg-muted">
                          <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-300">
                            <Sparkles size={14} className="animate-spin text-purple-500" />
                            {aiRecognizeStage || "Analizando con visión artificial…"}
                          </span>
                          <span className="tabular-nums font-mono text-purple-600 dark:text-purple-300">
                            {Math.round(aiRecognizeProgress)}%
                          </span>
                        </div>
                        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-bg-raised">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 transition-[width] duration-200"
                            style={{ width: `${aiRecognizeProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Error si ocurre */}
                    {aiError && (
                      <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                        <AlertTriangle size={15} className="shrink-0 text-rose-500" />
                        <span>{aiError}</span>
                      </div>
                    )}

                    {/* Resultado reconocido por IA */}
                    {aiResult && (
                      <div className="rounded-2xl border border-purple-500/40 bg-bg p-4 shadow-md animate-in zoom-in-95 duration-200">
                        <div className="flex flex-wrap items-start gap-4">
                          {aiImagePreview && (
                            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-white shadow-xs">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={aiImagePreview}
                                alt="Foto leída"
                                className="h-full w-full object-contain p-1"
                              />
                            </div>
                          )}

                          <div className="flex-1 min-w-[220px] space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-300">
                                {aiResult.brand || "MARCA DETECTADA"}
                              </span>
                              {aiResult.model && (
                                <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                                  {aiResult.model}
                                </span>
                              )}
                              <span className="text-[10px] text-fg-muted font-medium">
                                Cantidad: {aiResult.quantity || 1}
                              </span>
                            </div>

                            <p className="text-xs font-semibold text-fg">
                              {aiResult.description}
                            </p>

                            {/* Alerta de coincidencia con catálogo */}
                            {aiResult.matchedProduct && (
                              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                                <span className="flex items-center gap-1 font-semibold">
                                  <CheckCircle2 size={13} className="text-emerald-500" />
                                  Coincide con producto en inventario: {aiResult.matchedProduct.name}
                                </span>
                                <span className="font-bold">
                                  Stock: {aiResult.matchedProduct.stock} u. · {currSymbol}{" "}
                                  {aiResult.matchedProduct.price.toFixed(2)}
                                </span>
                              </div>
                            )}

                            {/* Precios detectados */}
                            <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                              {aiResult.detectedCost ? (
                                <span className="text-fg-muted">
                                  Costo detectado:{" "}
                                  <strong className="text-fg">
                                    {currSymbol} {aiResult.detectedCost.toFixed(2)}
                                  </strong>
                                </span>
                              ) : null}
                              {aiResult.detectedPrice ? (
                                <span className="text-fg-muted">
                                  Precio sugerido:{" "}
                                  <strong className="text-emerald-600 dark:text-emerald-400">
                                    {currSymbol} {aiResult.detectedPrice.toFixed(2)}
                                  </strong>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Botones de acción para insertar */}
                        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setAiResult(null);
                              setAiImagePreview(null);
                            }}
                            className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-fg-muted hover:text-fg hover:bg-bg-alt"
                          >
                            Reconocer otra foto
                          </button>

                          {activeItemIndex !== null && items[activeItemIndex] && (
                            <button
                              type="button"
                              onClick={() => applyAiResultToActiveItem(activeItemIndex)}
                              className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/20"
                            >
                              Rellenar Ítem #{activeItemIndex + 1}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={applyAiResultAsNewItem}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
                          >
                            <Sparkles size={13} />
                            <span>Insertar como nuevo ítem</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Modo recogido / compacto */
                  <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
                    <span>
                      Panel de IA listo. Presiona <kbd className="rounded bg-bg px-1 font-mono text-[10px]">Ctrl+V</kbd> para pegar o haz clic en Agrandar.
                    </span>
                    <button
                      type="button"
                      onClick={() => setAiScannerExpanded(true)}
                      className="text-purple-600 dark:text-purple-300 font-bold hover:underline"
                    >
                      Agrandar apartado →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Items list */}
            <div className="mt-4 space-y-3">
              {items.map((it, idx) => {
                const cost = Number(it.costPrice) || 0;
                const unitPrice = Number(it.unitPrice) || 0;
                const qty = Number(it.quantity) || 1;
                const unitProfit = unitPrice - cost;
                const lineProfit = unitProfit * qty;
                const isProfitable = unitProfit >= 0;

                return (
                  <div
                    key={idx}
                    className="relative rounded-xl border border-border/80 bg-bg p-3.5 shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-fg-muted">Ítem #{idx + 1}</span>
                        {cost > 0 && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              isProfitable
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isProfitable ? "+" : ""}
                            {currSymbol} {lineProfit.toFixed(2)} ({isProfitable ? "+" : ""}
                            {(it.marginPercent || 0).toFixed(1)}%)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveItemIndex(idx);
                            setShowAiScanner(true);
                            setAiScannerExpanded(true);
                          }}
                          className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                          title="Escanear producto para este ítem con IA"
                        >
                          <Camera size={12} />
                          <span className="hidden sm:inline">IA en este ítem</span>
                        </button>

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
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                      {/* Description & Search */}
                      <div className="relative sm:col-span-12 lg:col-span-5">
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

                        <textarea
                          rows={2}
                          placeholder="Ej. PORTATIL LENOVO V15 G5 / I3-1315U / 8GB DDR5 / SSD 512GB (soporta texto multilínea completo)"
                          value={it.description}
                          onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                          className="admin-field mt-1 w-full rounded-xl px-3 py-2 text-xs font-medium text-fg resize-y"
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
                                      {p.costPrice ? ` · Costo: ${currSymbol} ${p.costPrice.toFixed(2)}` : ""}
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

                      {/* Brand & Model */}
                      <div className="grid grid-cols-2 gap-1.5 sm:col-span-6 lg:col-span-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                            Marca
                          </label>
                          <input
                            type="text"
                            placeholder="LENOVO"
                            value={it.brand || ""}
                            onChange={(e) => handleItemChange(idx, "brand", e.target.value)}
                            className="admin-field mt-1 w-full rounded-xl px-2.5 py-2 text-xs text-fg"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                            Modelo
                          </label>
                          <input
                            type="text"
                            placeholder="V15 G5"
                            value={it.model || ""}
                            onChange={(e) => handleItemChange(idx, "model", e.target.value)}
                            className="admin-field mt-1 w-full rounded-xl px-2.5 py-2 text-xs text-fg"
                          />
                        </div>
                      </div>

                      {/* Cantidad */}
                      <div className="sm:col-span-2 lg:col-span-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                          Cant.
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          className="admin-field mt-1 w-full rounded-xl px-2 py-2 text-center text-xs font-bold text-fg"
                        />
                      </div>

                      {/* Precio de Costo Unitario */}
                      <div className="sm:col-span-4 lg:col-span-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                          Costo ({currSymbol})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={it.costPrice || ""}
                          onChange={(e) => handleItemChange(idx, "costPrice", e.target.value)}
                          className="admin-field mt-1 w-full rounded-xl px-2 py-2 text-right text-xs font-semibold text-fg"
                          title="Precio de costo o compra de este producto"
                        />
                      </div>

                      {/* % Margen Exacto */}
                      <div className="sm:col-span-4 lg:col-span-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                          % Margen
                        </label>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={it.marginPercent || ""}
                            onChange={(e) => handleItemChange(idx, "marginPercent", e.target.value)}
                            className="admin-field w-full rounded-xl pl-1.5 pr-4 py-2 text-right text-xs font-bold text-purple-600 dark:text-purple-300"
                            title="Porcentaje exacto de ganancia deseado"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-purple-500">
                            %
                          </span>
                        </div>
                      </div>

                      {/* Unit Price (P. Venta) */}
                      <div className="sm:col-span-4 lg:col-span-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                          P. Unit ({currSymbol})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.unitPrice}
                          onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                          className="admin-field mt-1 w-full rounded-xl px-2 py-2 text-right text-xs font-bold text-fg"
                        />
                      </div>

                      {/* Row Total */}
                      <div className="sm:col-span-12 lg:col-span-1 text-right">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                          Importe
                        </label>
                        <div className="mt-1 flex h-[34px] items-center justify-end px-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {currSymbol} {it.total.toFixed(2)}
                        </div>
                      </div>

                      {/* Barra de Rentabilidad y Presets Rápidos */}
                      <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bg-alt/70 px-3 py-1.5 border border-border/50 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold text-fg-muted flex items-center gap-1">
                            <Calculator size={12} className="text-accent" />
                            Cálculo de Porcentaje:
                          </span>

                          {cost > 0 ? (
                            <>
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                  isProfitable
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                <span>
                                  {isProfitable ? "+" : ""}
                                  {currSymbol} {lineProfit.toFixed(2)} neta
                                </span>
                                <span className="opacity-70">
                                  ({(it.marginPercent || 0).toFixed(2)}%)
                                </span>
                              </span>
                              <span className="text-[10px] text-fg-muted">
                                (Costo unit: {currSymbol} {cost.toFixed(2)} · Ganancia unit: {currSymbol}{" "}
                                {unitProfit.toFixed(2)})
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-fg-muted italic">
                              Ingresa el costo para calcular porcentaje y ganancia exacta
                            </span>
                          )}
                        </div>

                        {/* Botones Presets Rápidos */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted mr-1 hidden sm:inline">
                            Presets:
                          </span>
                          {[10, 15, 20, 25, 30, 40, 50].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => applyPresetMargin(idx, pct)}
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-all ${
                                Math.round(it.marginPercent || 0) === pct
                                  ? "bg-purple-600 text-white shadow-xs"
                                  : "bg-bg hover:bg-purple-500/15 text-fg-muted hover:text-purple-600 border border-border/60"
                              }`}
                              title={`Calcular precio con +${pct}% de margen sobre costo`}
                            >
                              +{pct}%
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => toggleMarginDetails(idx)}
                            className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                            title="Agrandar o recoger detalles del cotizador de margen"
                          >
                            {showMarginDetails[idx] ? (
                              <>
                                <ChevronUp size={12} />
                                <span>Recoger</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown size={12} />
                                <span>Agrandar</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Desglose detallado al Agrandar */}
                      {showMarginDetails[idx] && (
                        <div className="sm:col-span-12 rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 animate-in fade-in duration-200">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-2 mb-2">
                            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Percent size={13} />
                              Calculadora de Margen y Porcentaje Exacto
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-fg-muted">Método de cálculo:</span>
                              <div className="inline-flex rounded-lg border border-border p-0.5 bg-bg text-[10px] font-bold">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMarginMode("MARKUP");
                                    if (it.costPrice && it.costPrice > 0 && it.marginPercent) {
                                      handleItemChange(idx, "marginPercent", it.marginPercent);
                                    }
                                  }}
                                  className={`rounded px-2 py-0.5 transition-colors ${
                                    marginMode === "MARKUP"
                                      ? "bg-purple-600 text-white"
                                      : "text-fg-muted hover:text-fg"
                                  }`}
                                >
                                  Sobre Costo (Markup)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMarginMode("MARGIN");
                                    if (it.costPrice && it.costPrice > 0 && it.marginPercent) {
                                      handleItemChange(idx, "marginPercent", it.marginPercent);
                                    }
                                  }}
                                  className={`rounded px-2 py-0.5 transition-colors ${
                                    marginMode === "MARGIN"
                                      ? "bg-purple-600 text-white"
                                      : "text-fg-muted hover:text-fg"
                                  }`}
                                >
                                  Sobre Venta (Margen Comercial)
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="rounded-lg bg-bg p-2 border border-border/60">
                              <p className="text-[10px] text-fg-muted font-bold uppercase">Costo Total Renglón</p>
                              <p className="font-bold text-fg mt-0.5">
                                {currSymbol} {(cost * qty).toFixed(2)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-bg p-2 border border-border/60">
                              <p className="text-[10px] text-fg-muted font-bold uppercase">Ganancia Unitaria</p>
                              <p
                                className={`font-bold mt-0.5 ${
                                  isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                                }`}
                              >
                                {isProfitable ? "+" : ""}
                                {currSymbol} {unitProfit.toFixed(2)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-bg p-2 border border-border/60">
                              <p className="text-[10px] text-fg-muted font-bold uppercase">Ganancia Total Renglón</p>
                              <p
                                className={`font-bold mt-0.5 ${
                                  isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                                }`}
                              >
                                {isProfitable ? "+" : ""}
                                {currSymbol} {lineProfit.toFixed(2)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-bg p-2 border border-border/60">
                              <p className="text-[10px] text-fg-muted font-bold uppercase">Porcentaje Exacto</p>
                              <p className="font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                                {(it.marginPercent || 0).toFixed(2)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Item Notes / Specifics */}
                      <div className="sm:col-span-12">
                        <input
                          type="text"
                          placeholder="Detalles / notas adicionales de este ítem (Opcional, se incluye en el PDF)"
                          value={it.notes || ""}
                          onChange={(e) => handleItemChange(idx, "notes", e.target.value)}
                          className="admin-field w-full rounded-xl px-3 py-1.5 text-[11px] text-fg/80"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals Breakdown & Global Profitability */}
            <div className="mt-4 flex flex-col items-end gap-3 border-t border-border pt-4">
              {/* Panel de Rentabilidad Global Interna */}
              {(() => {
                const totalCost = items.reduce(
                  (sum, it) => sum + (Number(it.costPrice) || 0) * (Number(it.quantity) || 1),
                  0
                );
                const totalProfit = taxableBase - totalCost;
                const globalMarginPercent =
                  totalCost > 0 ? Number(((totalProfit / totalCost) * 100).toFixed(2)) : 0;

                return totalCost > 0 ? (
                  <div className="w-full max-w-md rounded-2xl border border-purple-500/30 bg-purple-500/5 p-3.5 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-300">
                        <Calculator size={14} />
                        Rentabilidad Interna de la Cotización
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowProfitSummary(!showProfitSummary)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-fg-muted hover:text-fg transition-colors"
                        title={showProfitSummary ? "Ocultar rentabilidad a clientes" : "Mostrar rentabilidad"}
                      >
                        {showProfitSummary ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{showProfitSummary ? "Ocultar" : "Mostrar"}</span>
                      </button>
                    </div>

                    {showProfitSummary && (
                      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-xl bg-bg p-2 border border-border/60">
                          <p className="text-[10px] text-fg-muted font-bold uppercase">Costo Total</p>
                          <p className="font-bold text-fg mt-0.5">
                            {currSymbol} {totalCost.toFixed(2)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-bg p-2 border border-border/60">
                          <p className="text-[10px] text-fg-muted font-bold uppercase">Ganancia Neta</p>
                          <p
                            className={`font-bold mt-0.5 ${
                              totalProfit >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-500"
                            }`}
                          >
                            {totalProfit >= 0 ? "+" : ""}
                            {currSymbol} {totalProfit.toFixed(2)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-bg p-2 border border-border/60">
                          <p className="text-[10px] text-fg-muted font-bold uppercase">Margen Promedio</p>
                          <p
                            className={`font-bold mt-0.5 ${
                              globalMarginPercent >= 0
                                ? "text-purple-600 dark:text-purple-400"
                                : "text-rose-500"
                            }`}
                          >
                            {globalMarginPercent >= 0 ? "+" : ""}
                            {globalMarginPercent.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    )}
                    <p className="mt-2 text-[10px] text-fg-muted text-right italic">
                      Datos internos para cálculo comercial. No se muestran en el PDF del cliente.
                    </p>
                  </div>
                ) : null;
              })()}

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

          {/* Section 5: Fotos y Anexos Visuales */}
          <QuotationPhotosField images={images} onChange={setImages} />
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
