"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Barcode,
  CheckCircle2,
  ImageIcon,
  Loader2,
  PackagePlus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { createProductQuick } from "@/app/taller-control/(panel)/productos/actions";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface ScannerAPIResponse {
  found: boolean;
  title?: string;
  brand?: string;
  model?: string;
  description?: string;
  category?: string;
  image?: string;
  images?: string[];
  source?: string;
  error?: string;
}

interface ProductDraft {
  barcode: string;
  title: string;
  brand: string;
  model: string;
  description: string;
  category: string;
  selectedImage: string;
  price: string;
  stock: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

type ScanStatus =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "found"; source: string }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

export function FastProductScanner() {
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const manualNameRef = useRef<HTMLInputElement>(null);

  const [barcodeValue, setBarcodeValue] = useState("");
  const [status, setStatus] = useState<ScanStatus>({ kind: "idle" });

  const [draft, setDraft] = useState<ProductDraft>({
    barcode: "",
    title: "",
    brand: "",
    model: "",
    description: "",
    category: "",
    selectedImage: "",
    price: "",
    stock: "1",
  });

  const [imageOptions, setImageOptions] = useState<string[]>([]);
  const [imageSearching, setImageSearching] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Keep barcode input focused ──────────────────────────────────────────
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const refocusBarcode = useCallback(() => {
    // Only refocus if we're NOT actively editing another field
    setTimeout(() => {
      if (
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        barcodeInputRef.current?.focus();
      }
    }, 100);
  }, []);

  // ── Barcode submit (Enter) ──────────────────────────────────────────────
  async function handleBarcodeScan(e: React.FormEvent) {
    e.preventDefault();
    const code = barcodeValue.trim();
    if (!code) return;

    setStatus({ kind: "scanning" });
    setImageOptions([]);
    setSaved(false);
    setSaveError(null);

    try {
      const res = await fetch("/api/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: code }),
      });
      const data: ScannerAPIResponse = await res.json();

      if (data.error) {
        setStatus({ kind: "error", message: data.error });
        return;
      }

      if (data.found) {
        setDraft((prev) => ({
          ...prev,
          barcode: code,
          title: data.title ?? "",
          brand: data.brand ?? "",
          model: data.model ?? "",
          description: data.description ?? "",
          category: data.category ?? "",
          selectedImage: data.images?.[0] ?? data.image ?? "",
          price: "",
          stock: "1",
        }));
        setImageOptions(data.images ?? (data.image ? [data.image] : []));
        setStatus({ kind: "found", source: data.source ?? "unknown" });
      } else {
        setDraft((prev) => ({
          ...prev,
          barcode: code,
          title: "",
          brand: "",
          model: "",
          description: "",
          category: "",
          selectedImage: "",
          price: "",
          stock: "1",
        }));
        setImageOptions(data.images ?? []);
        setStatus({ kind: "not-found" });
        // Focus the manual name input so the user can type right away
        setTimeout(() => manualNameRef.current?.focus(), 200);
      }
    } catch {
      setStatus({
        kind: "error",
        message: "No se pudo conectar con el servidor.",
      });
    }
  }

  // ── Manual name blur → search images via DuckDuckGo ─────────────────────
  async function handleManualNameBlur() {
    const query = draft.title.trim();
    if (!query || query.length < 3) return;

    setImageSearching(true);
    try {
      const res = await fetch("/api/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualQuery: `${draft.brand} ${query}`.trim() }),
      });
      const data: ScannerAPIResponse = await res.json();
      if (data.images && data.images.length > 0) {
        setImageOptions(data.images);
        if (!draft.selectedImage) {
          setDraft((prev) => ({ ...prev, selectedImage: data.images![0] }));
        }
      }
    } catch {
      // silent — not critical
    } finally {
      setImageSearching(false);
    }
  }

  // ── Save — creates the real product via createProductQuick (no redirect,
  //    so the panel stays put and is ready for the next scan) ─────────────
  async function handleSave() {
    const price = Number(draft.price);
    if (!draft.price || Number.isNaN(price) || price <= 0) {
      setSaveError("Ingresa un precio de venta válido (mayor a 0).");
      return;
    }
    const stock = Number(draft.stock);

    setSaving(true);
    setSaveError(null);

    // draft.title is the field the admin actually reviewed/edited in
    // "Nombre del producto" — brand/model are just aids for filling it in,
    // Product has no separate brand/model columns to write them to.
    const { error } = await createProductQuick({
      barcode: draft.barcode || null,
      name: draft.title.trim(),
      description: draft.description.trim() || draft.title.trim(),
      category: draft.category.trim() || "SIN CATEGORÍA",
      image: draft.selectedImage || null,
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
      price,
      costPrice: 0,
    });

    setSaving(false);
    if (error) {
      setSaveError(error);
      return;
    }

    setSaved(true);
    // Clear the draft (not the whole card/status, so the "guardado" message
    // above stays visible) — an empty title makes isFormReady false, which
    // is what actually prevents an accidental double-save of the same item.
    setDraft({
      barcode: "",
      title: "",
      brand: "",
      model: "",
      description: "",
      category: "",
      selectedImage: "",
      price: "",
      stock: "1",
    });
    setImageOptions([]);
    setBarcodeValue("");
    refocusBarcode();
  }

  // ── Reset ───────────────────────────────────────────────────────────────
  function handleReset() {
    setBarcodeValue("");
    setDraft({
      barcode: "",
      title: "",
      brand: "",
      model: "",
      description: "",
      category: "",
      selectedImage: "",
      price: "",
      stock: "1",
    });
    setImageOptions([]);
    setStatus({ kind: "idle" });
    setSaved(false);
    setSaveError(null);
    barcodeInputRef.current?.focus();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  const isFormReady = draft.title.trim().length > 0 && draft.price.trim().length > 0;

  const inputClass =
    "w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";
  const labelClass =
    "text-xs font-bold uppercase tracking-wider text-fg-muted";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="admin-glass rounded-[var(--radius-lg)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
            <Sparkles size={20} className="text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-fg font-display">
              Alta Rápida de Productos
            </h2>
            <p className="text-xs text-fg-muted">
              Escanea un código de barras con el lector físico o escribe
              manualmente
            </p>
          </div>
        </div>

        {/* ── Barcode input ──────────────────────────────────────────── */}
        <form
          onSubmit={handleBarcodeScan}
          className="mt-5 flex items-center gap-3"
        >
          <div className="relative flex-1">
            <Barcode
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted"
            />
            <input
              ref={barcodeInputRef}
              value={barcodeValue}
              onChange={(e) => setBarcodeValue(e.target.value)}
              placeholder="Escanea o escribe el código de barras…"
              autoComplete="off"
              autoFocus
              className="w-full rounded-xl border border-border bg-bg py-3 pl-10 pr-4 text-base font-mono text-fg outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            {barcodeValue && (
              <button
                type="button"
                onClick={() => {
                  setBarcodeValue("");
                  barcodeInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-fg-muted transition-colors hover:bg-bg-raised hover:text-fg"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={
              status.kind === "scanning" || barcodeValue.trim().length === 0
            }
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-accent-fg transition-all hover:bg-accent-hover disabled:opacity-50"
          >
            {status.kind === "scanning" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            {status.kind === "scanning" ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {/* ── Status messages ────────────────────────────────────────── */}
        {status.kind === "found" && (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-green-600">
            <CheckCircle2 size={15} />
            Producto encontrado ({status.source}) — verifica los datos abajo.
          </p>
        )}
        {status.kind === "not-found" && (
          <p className="mt-3 text-sm text-fg-muted">
            Código no registrado en bases públicas — completa los datos
            manualmente.
          </p>
        )}
        {status.kind === "error" && (
          <p className="mt-3 text-sm font-medium text-red-600">
            {status.message}
          </p>
        )}
      </div>

      {/* ── Product form (visible after scan or manual entry) ──────── */}
      {(status.kind === "found" || status.kind === "not-found") && (
        <div className="admin-glass rounded-[var(--radius-lg)] p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-fg-muted">
            <PackagePlus size={13} className="mr-1 inline-block" />
            Datos del producto
          </p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Title / Name */}
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="fast-title">
                Nombre del producto
              </label>
              <input
                ref={manualNameRef}
                id="fast-title"
                value={draft.title}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, title: e.target.value }))
                }
                onBlur={handleManualNameBlur}
                autoComplete="off"
                placeholder="Ej. Cable HDMI 2.1 Ultra HD 2m"
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {/* Brand */}
            <div>
              <label className={labelClass} htmlFor="fast-brand">
                Marca
              </label>
              <input
                id="fast-brand"
                value={draft.brand}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, brand: e.target.value }))
                }
                autoComplete="off"
                placeholder="Ej. Samsung"
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {/* Model */}
            <div>
              <label className={labelClass} htmlFor="fast-model">
                Modelo
              </label>
              <input
                id="fast-model"
                value={draft.model}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, model: e.target.value }))
                }
                autoComplete="off"
                placeholder="Ej. Galaxy A15"
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {/* Category */}
            <div>
              <label className={labelClass} htmlFor="fast-category">
                Categoría
              </label>
              <input
                id="fast-category"
                value={draft.category}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, category: e.target.value }))
                }
                autoComplete="off"
                placeholder="Ej. CELULARES"
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {/* Barcode (read-only echo) */}
            <div>
              <label className={labelClass} htmlFor="fast-barcode">
                Código de barras
              </label>
              <input
                id="fast-barcode"
                value={draft.barcode}
                readOnly
                className={`mt-2 ${inputClass} bg-bg-raised font-mono text-fg-muted`}
              />
            </div>

            {/* Price */}
            <div>
              <label className={labelClass} htmlFor="fast-price">
                Precio de venta (S/.)
              </label>
              <input
                id="fast-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.10"
                value={draft.price}
                onChange={(e) => setDraft((prev) => ({ ...prev, price: e.target.value }))}
                autoComplete="off"
                placeholder="Ej. 49.90"
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {/* Stock */}
            <div>
              <label className={labelClass} htmlFor="fast-stock">
                Stock inicial
              </label>
              <input
                id="fast-stock"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={draft.stock}
                onChange={(e) => setDraft((prev) => ({ ...prev, stock: e.target.value }))}
                autoComplete="off"
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="fast-description">
                Descripción
              </label>
              <textarea
                id="fast-description"
                value={draft.description}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={2}
                placeholder="Descripción breve del producto…"
                className={`mt-2 ${inputClass}`}
              />
            </div>
          </div>

          {/* ── Image selector ────────────────────────────────────────── */}
          <div className="mt-6">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-muted">
              <ImageIcon size={13} />
              Imagen del producto
              {imageSearching && (
                <Loader2 size={12} className="ml-1 animate-spin text-accent" />
              )}
            </p>

            {imageOptions.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {imageOptions.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, selectedImage: url }))
                    }
                    className={`group relative h-24 w-24 overflow-hidden rounded-xl border-2 transition-all ${
                      draft.selectedImage === url
                        ? "border-accent ring-2 ring-accent/30 scale-105"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Opción ${i + 1}`}
                      className="h-full w-full object-contain bg-white p-1"
                      onError={(e) => {
                        // Hide broken images
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {draft.selectedImage === url && (
                      <div className="absolute inset-0 flex items-center justify-center bg-accent/20">
                        <CheckCircle2 size={20} className="text-accent" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-fg-muted">
                {imageSearching
                  ? "Buscando imágenes…"
                  : "No hay imágenes disponibles. Escribe el nombre del producto y quita el foco para buscar automáticamente."}
              </p>
            )}

            {/* Preview of selected image */}
            {draft.selectedImage && (
              <div className="mt-4 inline-block rounded-xl border border-border bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.selectedImage}
                  alt="Imagen seleccionada"
                  className="h-40 w-40 object-contain"
                />
              </div>
            )}
          </div>

          {/* ── Actions ────────────────────────────────────────────────── */}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!isFormReady || saving}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-bold text-accent-fg transition-all hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <PackagePlus size={16} />}
              {saving ? "Guardando…" : "Guardar producto"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-border-strong px-7 py-3 text-sm font-bold text-fg transition-colors hover:border-accent hover:text-accent"
            >
              Limpiar
            </button>
          </div>

          {saveError && (
            <p className="mt-4 text-sm font-medium text-red-600 animate-in fade-in duration-300">
              {saveError}
            </p>
          )}
          {saved && (
            <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-green-600 animate-in fade-in duration-300">
              <CheckCircle2 size={15} />
              Producto guardado en el catálogo — listo para escanear el siguiente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
