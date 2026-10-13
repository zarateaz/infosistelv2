"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Barcode,
  Camera,
  ScanLine,
  Loader2,
  CheckCircle2,
  ImageIcon,
  Sparkles,
  Search,
  AlertTriangle,
  ZoomIn,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { lookupBarcode, recognizeProductImage, searchImagesManually } from "./scan-actions";
import { downloadProductImageFromUrl } from "./upload-actions";
import { CameraScanner } from "./CameraScanner";
import { ExistingProductActionCard } from "./ExistingProductActionCard";
import type { ProductSummary } from "@/lib/duplicateDetection";

// The site's CSP (img-src 'self' blob: data:) blocks hotlinking the image
// search results directly — this re-serves them from our own origin just
// for the picker preview. See src/app/api/image-proxy/route.ts.
const previewUrl = (externalUrl: string) => `/api/image-proxy?url=${encodeURIComponent(externalUrl)}`;

/** A phone camera photo straight off the file input is routinely 4-10+ MB —
 *  base64-encoded for the request body that's roughly another +33%, which
 *  clears nginx's `client_max_body_size 5M` before the request even reaches
 *  Next.js (a plain network/500-style failure, no useful message). Downscale
 *  to a size that's still easily enough for the vision model to read text
 *  off a box, cutting typical payloads to a few hundred KB. Falls back to
 *  the raw file's own data URL if the browser can't decode it (very old
 *  browsers, or an unsupported format) rather than blocking the upload —
 *  `recognizeProductImage`'s own error handling still catches anything that
 *  slips through this at the API layer. */
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

export interface ScanFill {
  name?: string;
  description?: string;
  category?: string;
  barcode?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  image?: string;
  /** Extra reference photos beyond the cover — admin-only, see
   *  ImageGalleryField. Only set when the admin picks more than one
   *  candidate in the image search picker. */
  images?: string[];
}

/** Barcode entry (typed, USB-scanner keyboard input, or live camera) + AI
 *  photo recognition, used only when creating a new product. */
export function ScannerPanel({ onFill }: { onFill: (fill: ScanFill) => void }) {
  const [barcode, setBarcode] = useState("");
  const [barcodeStatus, setBarcodeStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "existing"; product: ProductSummary }
    | { kind: "found" }
    | { kind: "not-found" }
  >({ kind: "idle" });
  const [cameraOpen, setCameraOpen] = useState(false);

  const [imageStatus, setImageStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "done" }
    | { kind: "existing"; product: ProductSummary }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Agrandar o recoger el apartado de fotos encontradas
  const [isEnlargedPicker, setIsEnlargedPicker] = useState(true);
  const [zoomModalUrl, setZoomModalUrl] = useState<string | null>(null);

  // "Reconocer con IA" takes several real seconds (vision model, then an
  // image search) — a bare spinner reads as frozen. This fakes a smooth,
  // ever-slowing progress toward 92% for as long as it's actually loading
  // (never claims to finish before the real response arrives), then snaps
  // to 100% and holds briefly once it does. Purely cosmetic — no relation
  // to real request progress, which the fetch API doesn't expose here.
  const [recognizeProgress, setRecognizeProgress] = useState(0);
  const [showRecognizeProgress, setShowRecognizeProgress] = useState(false);
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    if (imageStatus.kind === "loading") {
      wasLoadingRef.current = true;
      setShowRecognizeProgress(true);
      setRecognizeProgress(0);
      const start = performance.now();
      let raf: number;
      const tick = (now: number) => {
        const elapsedSec = (now - start) / 1000;
        setRecognizeProgress(92 * (1 - Math.exp(-elapsedSec / 3.2)));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    if (wasLoadingRef.current) {
      wasLoadingRef.current = false;
      setRecognizeProgress(100);
      const t = setTimeout(() => setShowRecognizeProgress(false), 700);
      return () => clearTimeout(t);
    }
  }, [imageStatus.kind]);

  const RECOGNIZE_STAGES = [
    { at: 0, label: "Leyendo la foto…" },
    { at: 20, label: "Identificando marca y modelo…" },
    { at: 45, label: "Redactando la descripción…" },
    { at: 68, label: "Buscando fotos en internet…" },
    { at: 88, label: "Verificando resultados…" },
  ];
  const recognizeLabel =
    recognizeProgress >= 100
      ? "¡Listo!"
      : RECOGNIZE_STAGES.reduce((label, s) => (recognizeProgress >= s.at ? s.label : label), RECOGNIZE_STAGES[0].label);

  // Candidate photos from an image search, shown when the barcode listing
  // itself had no photo. Multi-select (up to 4: one becomes the cover,
  // the rest go to the gallery) — `downloadingSelection` covers the whole
  // confirm step rather than one thumbnail at a time, since all selected
  // photos download together when the admin confirms.
  const MAX_PICKS = 4;
  const [imageOptions, setImageOptions] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [downloadingSelection, setDownloadingSelection] = useState(false);
  const [picksApplied, setPicksApplied] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [isSearchingManual, setIsSearchingManual] = useState(false);

  async function runBarcodeLookup(code: string) {
    const clean = code.trim();
    if (!clean) return;

    setBarcode(clean);
    setBarcodeStatus({ kind: "loading" });
    setImageOptions([]);
    setSelectedUrls([]);
    setPicksApplied(false);
    const result = await lookupBarcode(clean);

    if (result.existingProduct) {
      setBarcodeStatus({
        kind: "existing",
        product: result.existingProduct,
      });
      let parsedImages: string[] | undefined;
      if (result.existingProduct.images) {
        try {
          parsedImages =
            typeof result.existingProduct.images === "string"
              ? JSON.parse(result.existingProduct.images)
              : result.existingProduct.images;
        } catch {}
      }
      onFill({
        name: result.existingProduct.name,
        category: result.existingProduct.category ?? undefined,
        description: result.existingProduct.description ?? undefined,
        barcode: result.existingProduct.barcode ?? clean,
        price: result.existingProduct.price,
        costPrice: result.existingProduct.costPrice ?? 0,
        stock: result.existingProduct.stock ?? 0,
        image: result.existingProduct.image ?? undefined,
        images: parsedImages,
      });
      return;
    }

    const { imageUrl, imageOptions: candidates, ...suggestion } = result.suggestion ?? {};
    onFill({ barcode: clean, ...suggestion });
    setBarcodeStatus(result.suggestion ? { kind: "found" } : { kind: "not-found" });
    if (suggestion.name) setManualSearchQuery(suggestion.name);
    if (candidates && candidates.length > 0) {
      setImageOptions(candidates);
      setSelectedUrls(candidates.slice(0, MAX_PICKS));
    }

    // Best-effort: the product listing sometimes has its own photo — fetch
    // it in the background so a product with a barcode match doesn't
    // always need a manual "Subir foto" step. Fills in after the text
    // fields since it's slower (a real HTTP fetch + re-encode).
    if (imageUrl) {
      downloadProductImageFromUrl(imageUrl).then((img) => {
        if (img.path) onFill({ image: img.path });
      });
    }
  }

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    runBarcodeLookup(barcode);
  }

  function toggleSelection(url: string) {
    setSelectedUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : prev.length < MAX_PICKS ? [...prev, url] : prev
    );
  }

  /** Admin confirmed their selection (1–4 thumbnails) — download + re-encode
   *  every one through sharp (same pipeline as any other product photo),
   *  in parallel, and only then hand the resulting local paths to the form.
   *  The first successful download becomes the cover photo, the rest go to
   *  the gallery. Never store the external URLs themselves. */
  async function handleConfirmSelection() {
    if (selectedUrls.length === 0) return;
    setDownloadingSelection(true);
    const results = await Promise.all(selectedUrls.map((url) => downloadProductImageFromUrl(url)));
    setDownloadingSelection(false);

    const paths = results.map((r) => r.path).filter((p): p is string => !!p);
    if (paths.length === 0) return;
    const [cover, ...gallery] = paths;
    onFill({ image: cover, images: gallery });
    setPicksApplied(true);
  }

  function handleCameraDetected(code: string) {
    setCameraOpen(false);
    runBarcodeLookup(code);
  }

  async function processImageFile(file: File) {
    setImageStatus({ kind: "loading" });
    setImageOptions([]);
    setSelectedUrls([]);
    setPicksApplied(false);

    try {
      const dataUrl = await resizeImageForRecognition(file);

      const result = await recognizeProductImage(dataUrl);
      if (result.error) {
        setImageStatus({ kind: "error", message: result.error });
        return;
      }
      if (result.existingProduct) {
        setImageStatus({
          kind: "existing",
          product: result.existingProduct,
        });
        let parsedImages: string[] | undefined;
        if (result.existingProduct.images) {
          try {
            parsedImages =
              typeof result.existingProduct.images === "string"
                ? JSON.parse(result.existingProduct.images)
                : result.existingProduct.images;
          } catch {}
        }
        onFill({
          name: result.existingProduct.name,
          category: result.existingProduct.category ?? undefined,
          description: result.existingProduct.description ?? undefined,
          barcode: result.existingProduct.barcode ?? undefined,
          price: result.existingProduct.price,
          costPrice: result.existingProduct.costPrice ?? 0,
          stock: result.existingProduct.stock ?? 0,
          image: result.existingProduct.image ?? undefined,
          images: parsedImages,
        });
        return;
      }
      onFill({ name: result.name, description: result.description, category: result.category });
      setImageStatus({ kind: "done" });
      if (result.name) setManualSearchQuery(result.name);
      if (result.imageOptions && result.imageOptions.length > 0) {
        setImageOptions(result.imageOptions);
        setSelectedUrls(result.imageOptions.slice(0, MAX_PICKS));
      }
    } catch {
      setImageStatus({
        kind: "error",
        message: "No se pudo procesar la imagen. Revisa tu conexión e intenta de nuevo.",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  }

  // Pegar con Ctrl + V directamente en el panel
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        if (!e.clipboardData?.files || e.clipboardData.files.length === 0) return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processImageFile(file);
            break;
          }
        }
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  return (
    <div className="mb-8 admin-glass rounded-[var(--radius-lg)] p-6">
      <p className="text-xs font-bold uppercase tracking-wider text-fg-muted">
        Escáner de inventario (opcional)
      </p>

      <form onSubmit={handleBarcodeSubmit} className="mt-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Barcode size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Escanea (USB), escribe, o usa la cámara"
            autoComplete="off"
            className="w-full rounded-xl border border-border bg-bg py-2.5 pl-10 pr-4 text-sm text-fg outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={barcodeStatus.kind === "loading"}
          className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {barcodeStatus.kind === "loading" ? "Buscando..." : "Buscar"}
        </button>

        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border-strong px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-accent hover:text-accent"
        >
          <ScanLine size={15} />
          Usar cámara
        </button>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-5 py-2.5 text-sm font-bold text-purple-700 dark:text-purple-300 transition-all hover:bg-purple-500/20 hover:scale-[1.02] shadow-xs">
          {imageStatus.kind === "loading" ? (
            <Loader2 size={15} className="animate-spin text-purple-500" />
          ) : (
            <Camera size={15} className="text-purple-500" />
          )}
          <span>Reconocer con IA</span>
          <Sparkles size={13} className="text-purple-500 animate-pulse" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageChange}
            className="hidden"
          />
        </label>
      </form>

      {barcodeStatus.kind === "existing" && (
        <ExistingProductActionCard product={barcodeStatus.product} onFill={onFill} />
      )}
      {barcodeStatus.kind === "found" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-accent">
          <CheckCircle2 size={15} />
          Datos encontrados y completados abajo — revísalos antes de guardar.
        </p>
      )}
      {barcodeStatus.kind === "not-found" && (
        <p className="mt-3 text-sm text-fg-muted">
          No se encontró en bases públicas de códigos de barra (normal para repuestos genéricos
          o marcas B2B) — completa los datos a mano o usa &ldquo;Reconocer con IA&rdquo; con una
          foto de la caja o pega con <kbd className="rounded bg-bg px-1 font-mono text-xs">Ctrl+V</kbd>.
        </p>
      )}
      {showRecognizeProgress && (
        <div className="admin-glass mt-4 rounded-2xl p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-fg-muted">
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-accent animate-pulse" />
              {recognizeLabel}
            </span>
            <span className="tabular-nums text-accent">{Math.round(recognizeProgress)}%</span>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-bg-raised">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent via-accent-hover to-accent transition-[width] duration-200 ease-out"
              style={{ width: `${recognizeProgress}%` }}
            >
              <div className="absolute inset-0 animate-[shimmer_1.4s_linear_infinite] bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.55)_50%,transparent_70%)] bg-[length:200%_100%]" />
            </div>
            <div
              aria-hidden
              className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_12px_3px_rgba(10,95,219,0.7)] transition-[left] duration-200 ease-out"
              style={{ left: `calc(${recognizeProgress}% - 5px)` }}
            />
          </div>
        </div>
      )}

      {imageStatus.kind === "done" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-accent">
          <CheckCircle2 size={15} />
          Datos leídos de la foto y completados abajo — revísalos antes de guardar.
        </p>
      )}
      {imageStatus.kind === "existing" && (
        <ExistingProductActionCard product={imageStatus.product} onFill={onFill} />
      )}
      {imageStatus.kind === "error" && (
        <p className="mt-3 text-sm font-medium text-red-600">{imageStatus.message}</p>
      )}
      {imageOptions.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border/80 bg-bg/50 p-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-border/40 pb-2.5">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg">
                <ImageIcon size={14} className="text-accent" />
                Elige hasta {MAX_PICKS} fotos encontradas en internet para este producto
              </p>
              <p className="text-[11px] text-fg-muted mt-0.5">
                La primera foto seleccionada será la foto principal de portada; las demás quedarán en la galería.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">
                {selectedUrls.length} de {MAX_PICKS} fotos elegidas
              </span>

              {selectedUrls.length < Math.min(imageOptions.length, MAX_PICKS) ? (
                <button
                  type="button"
                  onClick={() => setSelectedUrls(imageOptions.slice(0, MAX_PICKS))}
                  className="rounded-lg border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent hover:bg-accent/20"
                >
                  Elegir las {Math.min(imageOptions.length, MAX_PICKS)}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedUrls([])}
                  className="rounded-lg border border-border px-2 py-0.5 text-[11px] font-medium text-fg-muted hover:text-fg"
                >
                  Desmarcar
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsEnlargedPicker(!isEnlargedPicker)}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-bg px-2.5 py-1 text-xs font-semibold text-fg-muted hover:text-fg transition-colors"
                title={isEnlargedPicker ? "Recoger apartado para vista compacta" : "Agrandar fotos para ver detalles"}
              >
                {isEnlargedPicker ? (
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
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {imageOptions.map((url, i) => {
              const order = selectedUrls.indexOf(url);
              const selected = order !== -1;
              return (
                <div
                  key={url}
                  className={`group relative flex items-center justify-center overflow-hidden rounded-2xl border-2 transition-all bg-white shadow-xs ${
                    isEnlargedPicker ? "h-36 w-36 sm:h-44 sm:w-44" : "h-20 w-20"
                  } ${
                    selected ? "border-accent ring-2 ring-accent/30 shadow-md" : "border-border hover:border-accent/60"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl(url)}
                    alt={`Opción ${i + 1}`}
                    className="h-full w-full object-contain p-2"
                    onError={() => {
                      setImageOptions((prev) => prev.filter((u) => u !== url));
                      setSelectedUrls((prev) => prev.filter((u) => u !== url));
                    }}
                  />

                  {/* Badge de orden o portada */}
                  {selected && (
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-fg shadow-xs">
                      <CheckCircle2 size={11} />
                      {order === 0 ? "★ Portada" : `#${order + 1} Galería`}
                    </div>
                  )}

                  {/* Click overlay para seleccionar / deseleccionar */}
                  <button
                    type="button"
                    onClick={() => toggleSelection(url)}
                    disabled={downloadingSelection}
                    className="absolute inset-0 cursor-pointer bg-black/0 hover:bg-black/10 transition-colors"
                    title={selected ? "Quitar selección" : "Seleccionar esta foto"}
                  />

                  {/* Botón de lupa Zoom en modo ampliado */}
                  {isEnlargedPicker && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomModalUrl(previewUrl(url));
                      }}
                      className="absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 hover:scale-110 transition-transform opacity-0 group-hover:opacity-100"
                      title="Ver foto en tamaño completo"
                    >
                      <ZoomIn size={13} />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={handleConfirmSelection}
              disabled={selectedUrls.length === 0 || downloadingSelection}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-xs font-bold text-accent-fg transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
            >
              {downloadingSelection && <Loader2 size={13} className="animate-spin" />}
              {downloadingSelection
                ? "Descargando y aplicando fotos…"
                : selectedUrls.length === MAX_PICKS
                ? `Usar las ${MAX_PICKS} fotos (1 portada + 3 galería)`
                : `Usar ${selectedUrls.length} foto${selectedUrls.length === 1 ? "" : "s"}`}
            </button>
          </div>
          {picksApplied && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-accent">
              <CheckCircle2 size={13} />
              Fotos aplicadas al producto abajo (1 de portada y {Math.max(0, selectedUrls.length - 1)} en galería de referencia).
            </p>
          )}

          {/* Buscador interactivo para refinar o cambiar fotos en el acto */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const q = manualSearchQuery.trim();
              if (!q || isSearchingManual) return;
              setIsSearchingManual(true);
              const found = await searchImagesManually(q);
              setIsSearchingManual(false);
              if (found.length > 0) {
                setImageOptions(found);
                setSelectedUrls(found.slice(0, MAX_PICKS));
                setPicksApplied(false);
              }
            }}
            className="mt-3 flex items-center gap-2 border-t border-border/40 pt-3"
          >
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
              <input
                value={manualSearchQuery}
                onChange={(e) => setManualSearchQuery(e.target.value)}
                placeholder="¿Buscar fotos de otro modelo específico? Ej: UGREEN 70450 o UGREEN US320..."
                className="w-full rounded-xl border border-border bg-bg py-1.5 pl-8 pr-3 text-xs text-fg outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingManual || !manualSearchQuery.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-fg transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {isSearchingManual ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              {isSearchingManual ? "Buscando…" : "Buscar fotos"}
            </button>
          </form>
        </div>
      )}

      {imageStatus.kind === "done" && imageOptions.length === 0 && (
        <div className="mt-3 rounded-2xl border border-border/70 bg-bg/50 p-4">
          <p className="text-xs text-fg-muted mb-2">
            No se encontraron fotos automáticas — escribe el modelo exacto o nombre para buscar en internet:
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const q = manualSearchQuery.trim();
              if (!q || isSearchingManual) return;
              setIsSearchingManual(true);
              const found = await searchImagesManually(q);
              setIsSearchingManual(false);
              if (found.length > 0) {
                setImageOptions(found);
                setSelectedUrls([]);
                setPicksApplied(false);
              }
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
              <input
                value={manualSearchQuery}
                onChange={(e) => setManualSearchQuery(e.target.value)}
                placeholder="Ej: UGREEN 70450 US320 USB-C HDMI..."
                className="w-full rounded-xl border border-border bg-bg py-1.5 pl-8 pr-3 text-xs text-fg outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingManual || !manualSearchQuery.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-fg transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {isSearchingManual ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              {isSearchingManual ? "Buscando…" : "Buscar fotos"}
            </button>
          </form>
        </div>
      )}

      {cameraOpen && (
        <CameraScanner onDetected={handleCameraDetected} onClose={() => setCameraOpen(false)} />
      )}

      {zoomModalUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setZoomModalUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-card p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomModalUrl(null)}
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-black/90"
              title="Cerrar vista ampliada"
            >
              <X size={18} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomModalUrl}
              alt="Vista previa ampliada"
              className="max-h-[82vh] max-w-[85vw] rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
