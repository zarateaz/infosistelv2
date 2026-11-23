"use client";

import { useEffect, useRef, useState } from "react";
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
import { findProductPhotos, lookupBarcode, recognizeProductImage, searchImagesManually } from "./scan-actions";
import { downloadProductImageFromUrl } from "./upload-actions";
import { CameraScanner } from "./CameraScanner";
import { decodeBarcodeFromFile } from "./barcodeFromImage";
import type { ProductSummary } from "@/lib/duplicateDetection";

const previewUrl = (url: string) =>
  url.startsWith("/") ? url : `/api/image-proxy?url=${encodeURIComponent(url)}`;

/**
 * Reduce la foto hasta que su data URL quepa en `maxChars` (base64). Los proxys
 * (Nginx) rechazan por defecto peticiones de más de 1 MB, y una foto de celular
 * de 1600px con mucho detalle lo supera: por eso se ajusta calidad y tamaño
 * hasta entrar en el presupuesto, manteniendo el texto impreso legible.
 */
async function resizeImageForRecognition(file: File, maxChars = 800_000): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      let best = "";
      for (const maxDim of [1600, 1400, 1200, 1000, 850, 700]) {
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas 2d context unavailable");
        ctx.drawImage(bitmap, 0, 0, width, height);
        for (const quality of [0.85, 0.75, 0.65]) {
          best = canvas.toDataURL("image/jpeg", quality);
          if (best.length <= maxChars) return best;
        }
      }
      return best;
    } finally {
      bitmap.close();
    }
  } catch {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}

/** Total base64 budget for all photos of one recognition request (stays under a 1 MB proxy limit). */
const PHOTO_BUDGET_CHARS = 880_000;

function friendlyActionError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/server action|failed to find|deployment/i.test(msg)) {
    return "La página quedó desactualizada después de una actualización del sistema. Recárgala (desliza hacia abajo o F5) e intenta de nuevo.";
  }
  return "No se pudo conectar con el servidor. Revisa tu internet; si sigue fallando, recarga la página e intenta con 1 sola foto.";
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
  images?: string[];
  existingProduct?: ProductSummary | null;
  /** Catalog products the admin said are NOT this product */
  ignoreIds?: string[];
  /** true while similar products are shown and the admin hasn't decided yet */
  pendingReview?: boolean;
  /** Admin's photos saved as pending reference photos; attached to the product on save */
  refTokens?: string[];
}

function parseGallery(images: ProductSummary["images"]): string[] | undefined {
  if (!images) return undefined;
  try {
    const parsed = typeof images === "string" ? JSON.parse(images) : images;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : undefined;
  } catch {
    return undefined;
  }
}

function existingFill(product: ProductSummary, scannedBarcode?: string, refTokens?: string[]): ScanFill {
  return {
    name: product.name,
    category: product.category ?? undefined,
    description: product.description ?? undefined,
    barcode: product.barcode ?? scannedBarcode,
    price: product.price,
    costPrice: product.costPrice ?? 0,
    stock: (product.stock ?? 0) + 1,
    image: product.image ?? undefined,
    images: parseGallery(product.images),
    existingProduct: product,
    pendingReview: false,
    refTokens,
  };
}

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
  const [possibleMatches, setPossibleMatches] = useState<ProductSummary[]>([]);
  const [scannedBarcodeForMatch, setScannedBarcodeForMatch] = useState<string | undefined>();
  const [matchReason, setMatchReason] = useState<string | null>(null);
  const [lastRefTokens, setLastRefTokens] = useState<string[] | undefined>();
  const [photoBarcode, setPhotoBarcode] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photoSearchFailed, setPhotoSearchFailed] = useState(false);

  const [isEnlargedPicker, setIsEnlargedPicker] = useState(true);
  const [zoomModalUrl, setZoomModalUrl] = useState<string | null>(null);

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
        setRecognizeProgress(94 * (1 - Math.exp(-elapsedSec / 3.5)));
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
    { at: 0, label: "Leyendo código de barras y texto impreso…" },
    { at: 20, label: "Comparando con tus fotos reales del catálogo…" },
    { at: 45, label: "Extrayendo categoría, descripción y precios…" },
    { at: 68, label: "Buscando y descargando las 4 mejores fotos…" },
    { at: 88, label: "Aplicando datos y fotos al formulario…" },
  ];
  const recognizeLabel =
    recognizeProgress >= 100
      ? "¡Completado con éxito!"
      : RECOGNIZE_STAGES.reduce((label, s) => (recognizeProgress >= s.at ? s.label : label), RECOGNIZE_STAGES[0].label);

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
    setLastRefTokens(undefined);
    setPhotoBarcode(null);
    setImageStatus({ kind: "idle" });
    setImageOptions([]);
    setSelectedUrls([]);
    setPicksApplied(false);
    setPossibleMatches([]);
    setMatchReason(null);
    const result = await lookupBarcode(clean);

    if (result.existingProduct) {
      setBarcodeStatus({
        kind: "existing",
        product: result.existingProduct,
      });
      onFill(existingFill(result.existingProduct, clean));
      return;
    }

    const { imageUrl, imageOptions: candidates, image, images, ...suggestion } = result.suggestion ?? {};
    const localApplied = [image, ...(images ?? [])].filter((p): p is string => !!p);

    const similar = result.possibleMatches ?? [];
    setPossibleMatches(similar);
    setScannedBarcodeForMatch(clean);
    onFill({
      barcode: clean,
      ...suggestion,
      stock: suggestion.stock ?? 1,
      image,
      images,
      existingProduct: null,
      pendingReview: similar.length > 0,
    });
    setBarcodeStatus(result.suggestion ? { kind: "found" } : { kind: "not-found" });
    if (suggestion.name) setManualSearchQuery(suggestion.name);

    if (localApplied.length > 0) {
      setImageOptions(localApplied);
      setSelectedUrls(localApplied.slice(0, MAX_PICKS));
      setPicksApplied(true);
    } else if (candidates && candidates.length > 0) {
      setImageOptions(candidates);
      setSelectedUrls(candidates.slice(0, MAX_PICKS));
    }

    if (!image && imageUrl) {
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
    setSelectedUrls((prev) => {
      const next = prev.includes(url)
        ? prev.filter((u) => u !== url)
        : prev.length < MAX_PICKS
        ? [...prev, url]
        : prev;
      // If all selected URLs are already local (/img/products/...), apply immediately!
      if (next.length > 0 && next.every((u) => u.startsWith("/"))) {
        const [cover, ...gallery] = next;
        onFill({ image: cover, images: gallery });
        setPicksApplied(true);
      } else {
        setPicksApplied(false);
      }
      return next;
    });
  }

  async function handleConfirmSelection(urlsToApply = selectedUrls) {
    if (urlsToApply.length === 0) return;
    setDownloadingSelection(true);
    const results = await Promise.all(
      urlsToApply.map(async (url) => {
        if (url.startsWith("/")) return { path: url };
        return downloadProductImageFromUrl(url);
      })
    );
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

  async function processImageFiles(input: File[]) {
    const files = input.filter((f) => f.type.startsWith("image/")).slice(0, 3);
    if (files.length === 0) return;
    setImageStatus({ kind: "loading" });
    setPossibleMatches([]);
    setMatchReason(null);
    setPhotoBarcode(null);
    setPhotoCount(files.length);
    setPhotoSearchFailed(false);
    setLastRefTokens(undefined);
    setBarcodeStatus({ kind: "idle" });
    setImageOptions([]);
    setSelectedUrls([]);
    setPicksApplied(false);

    try {
      // 1) Código de barras leído EXACTO desde la(s) foto(s), sin IA
      const perPhoto = Math.floor(PHOTO_BUDGET_CHARS / files.length);
      const [decoded, dataUrls] = await Promise.all([
        (async () => {
          for (const f of files) {
            const code = await decodeBarcodeFromFile(f);
            if (code) return code;
          }
          return null;
        })(),
        Promise.all(files.map((f) => resizeImageForRecognition(f, perPhoto))),
      ]);
      if (decoded) {
        setPhotoBarcode(decoded);
        setBarcode(decoded);
      }

      // 2) IA: lectura del texto impreso + comparación contra el catálogo
      let result: Awaited<ReturnType<typeof recognizeProductImage>>;
      try {
        result = await recognizeProductImage(dataUrls, decoded ?? undefined);
      } catch (firstErr) {
        if (/server action|failed to find|deployment/i.test(String((firstErr as Error)?.message ?? ""))) throw firstErr;
        // Reintento automático con fotos más livianas (red lenta / límite de tamaño)
        const lighter = await Promise.all(
          files.map((f) => resizeImageForRecognition(f, Math.floor(perPhoto / 2.5)))
        );
        result = await recognizeProductImage(lighter, decoded ?? undefined);
      }
      if (result.error) {
        setImageStatus({ kind: "error", message: result.error });
        return;
      }
      setLastRefTokens(result.refTokens);
      if (result.existingProduct) {
        setImageStatus({
          kind: "existing",
          product: result.existingProduct,
        });
        setMatchReason(result.matchReason ?? null);
        onFill(existingFill(result.existingProduct, result.barcode, result.refTokens));
        return;
      }

      // New product: fill ALL fields AND the 4 pre-downloaded images immediately!
      onFill({
        name: result.name,
        description: result.description,
        category: result.category,
        barcode: result.barcode,
        price: result.price,
        costPrice: result.costPrice,
        stock: result.stock ?? 1,
        image: result.image,
        images: result.images,
        existingProduct: null,
        pendingReview: (result.possibleMatches?.length ?? 0) > 0,
        refTokens: result.refTokens,
      });
      setPossibleMatches(result.possibleMatches ?? []);
      setScannedBarcodeForMatch(result.barcode);
      setImageStatus({ kind: "done" });
      if (result.name) setManualSearchQuery(result.name);

      // 3) Las 4 fotos del producto se buscan en una llamada aparte (respuesta rápida arriba)
      setPhotosLoading(true);
      try {
        const photos = await findProductPhotos({
          name: result.name ?? "",
          category: result.category,
          queries: result.photoSearch?.queries,
          negativeKeywords: result.photoSearch?.negativeKeywords,
          fallbackRefToken: result.refTokens?.[0],
        });
        if (photos.appliedLocalImages.length > 0) {
          const [cover, ...gallery] = photos.appliedLocalImages;
          onFill({ image: cover, images: gallery });
          const extra = photos.imageOptions.filter((u) => !photos.appliedLocalImages.includes(u));
          setImageOptions([...photos.appliedLocalImages, ...extra]);
          setSelectedUrls(photos.appliedLocalImages.slice(0, MAX_PICKS));
          setPicksApplied(true);
        } else if (photos.imageOptions.length > 0) {
          const initialPicks = photos.imageOptions.slice(0, MAX_PICKS);
          setImageOptions(photos.imageOptions);
          setSelectedUrls(initialPicks);
          await handleConfirmSelection(initialPicks);
        }
      } catch {
        // Las fotos son opcionales: el producto ya está reconocido; se pueden buscar a mano abajo.
        setPhotoSearchFailed(true);
      } finally {
        setPhotosLoading(false);
      }
    } catch (err) {
      setImageStatus({
        kind: "error",
        message: friendlyActionError(err),
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) processImageFiles(files);
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
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        processImageFiles(files);
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  });

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

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#0a5fdb]/40 bg-[#0a5fdb]/10 px-5 py-2.5 text-sm font-bold text-[#0a5fdb] transition-all hover:bg-[#0a5fdb]/20 hover:scale-[1.02] shadow-xs">
          {imageStatus.kind === "loading" ? (
            <Loader2 size={15} className="animate-spin text-[#0a5fdb]" />
          ) : (
            <Camera size={15} className="text-[#0a5fdb]" />
          )}
          <span>Reconocer con IA</span>
          <Sparkles size={13} className="text-[#0a5fdb] animate-pulse" />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageChange}
            className="hidden"
          />
        </label>
      </form>
      <p className="mt-2 text-[11px] text-fg-muted">
        Consejo: elige hasta <strong>3 fotos</strong> del mismo producto (frente + reverso con el código de barras).
        Si se lee el código de barras, la identificación es exacta.
      </p>
      {photoBarcode && imageStatus.kind !== "idle" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
          <Barcode size={14} /> Código de barras leído en la foto: {photoBarcode}
        </p>
      )}
      {imageStatus.kind === "loading" && photoCount > 1 && (
        <p className="mt-1 text-[11px] text-fg-muted">Analizando {photoCount} fotos del mismo producto…</p>
      )}

      {(barcodeStatus.kind === "existing" || imageStatus.kind === "existing") && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900">
          <AlertTriangle size={16} className="shrink-0 text-amber-600" />
          <span>
            ¡Producto detectado en tienda! Abajo puedes elegir cuánto stock agregar y pulsar{" "}
            <strong>Guardar</strong>.
            {matchReason && imageStatus.kind === "existing" && (
              <span className="mt-0.5 block font-medium text-amber-800">Motivo: {matchReason}</span>
            )}
          </span>
        </div>
      )}

      {possibleMatches.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-amber-500/60 bg-amber-50 p-4 text-amber-950 shadow-sm">
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <AlertTriangle size={16} className="shrink-0 text-amber-600" />
            ¿Es alguno de estos productos que ya tienes en la tienda?
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80">
            Se parecen a la foto. Si es uno de ellos se suma stock; si no, regístralo como nuevo.
          </p>
          <div className="mt-3 grid gap-2">
            {possibleMatches.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-amber-300 bg-white p-2">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl(p.image)} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <ImageIcon size={18} className="text-fg-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-fg" title={p.name}>{p.name}</p>
                  <p className="text-[11px] text-fg-muted">
                    Stock: {p.stock ?? 0} · S/. {p.price ?? "-"}
                    {p.barcode ? ` · Cód: ${p.barcode}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPossibleMatches([]);
                    setImageOptions([]);
                    setSelectedUrls([]);
                    setMatchReason("Confirmado por ti");
                    if (imageStatus.kind !== "idle") setImageStatus({ kind: "existing", product: p });
                    else setBarcodeStatus({ kind: "existing", product: p });
                    onFill(existingFill(p, scannedBarcodeForMatch, lastRefTokens));
                  }}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                >
                  Sí, es este
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const ids = possibleMatches.map((p) => p.id);
              setPossibleMatches([]);
              onFill({ ignoreIds: ids, pendingReview: false, existingProduct: null });
            }}
            className="mt-3 w-full rounded-xl border border-amber-500/60 bg-white px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
          >
            No, ninguno — es un producto nuevo
          </button>
        </div>
      )}

      {barcodeStatus.kind === "found" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-accent">
          <CheckCircle2 size={15} />
          Datos y 4 fotos completados automáticamente abajo — revísalos antes de guardar.
        </p>
      )}
      {barcodeStatus.kind === "not-found" && (
        <p className="mt-3 text-sm text-fg-muted">
          No se encontró en bases públicas de códigos de barra — usa &ldquo;Reconocer con IA&rdquo; con una
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

      {imageStatus.kind === "done" && photosLoading && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent">
          <Loader2 size={16} className="animate-spin" />
          Producto reconocido. Buscando las 4 mejores fotos del producto…
        </p>
      )}
      {imageStatus.kind === "done" && !photosLoading && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
          <CheckCircle2 size={16} />
          {selectedUrls.length > 0
            ? `¡Campos y ${selectedUrls.length} foto${selectedUrls.length === 1 ? "" : "s"} listos! Revisa el precio y guarda.`
            : "¡Campos listos! Revisa el precio y guarda."}
        </p>
      )}
      {imageStatus.kind === "done" && !photosLoading && photoSearchFailed && (
        <p className="mt-1 text-xs font-medium text-amber-700">
          No se pudieron traer fotos de internet en este momento. Puedes subir una foto manualmente abajo.
        </p>
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
                Fotos del producto ({selectedUrls.length} de {MAX_PICKS} elegidas)
              </p>
              <p className="text-[11px] text-fg-muted mt-0.5">
                La foto #1 es la portada principal; las otras 3 quedan en la galería del producto.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedUrls.length < Math.min(imageOptions.length, MAX_PICKS) ? (
                <button
                  type="button"
                  onClick={() => {
                    const top4 = imageOptions.slice(0, MAX_PICKS);
                    setSelectedUrls(top4);
                    handleConfirmSelection(top4);
                  }}
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
              >
                {isEnlargedPicker ? (
                  <>
                    <Minimize2 size={12} />
                    <span>Compactar</span>
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

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {imageOptions.map((url, i) => {
              const order = selectedUrls.indexOf(url);
              const selected = order !== -1;
              return (
                <div
                  key={url}
                  className={`group relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border-2 bg-white shadow-xs transition-all ${
                    selected
                      ? "border-accent ring-2 ring-accent/30 shadow-md"
                      : "border-border hover:border-accent/60"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl(url)}
                    alt={`Foto ${i + 1}`}
                    className="h-full w-full object-contain p-2"
                    onError={() => {
                      setImageOptions((prev) => prev.filter((u) => u !== url));
                      setSelectedUrls((prev) => prev.filter((u) => u !== url));
                    }}
                  />

                  {selected && (
                    <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-fg shadow-xs">
                      <CheckCircle2 size={10} />
                      {order === 0 ? "★ Portada" : `#${order + 1} Galería`}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleSelection(url)}
                    disabled={downloadingSelection}
                    className="absolute inset-0 cursor-pointer bg-black/0 hover:bg-black/10 transition-colors"
                    title={selected ? "Quitar selección" : "Seleccionar esta foto"}
                  />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomModalUrl(previewUrl(url));
                    }}
                    className="absolute bottom-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-transform hover:bg-black/80 hover:scale-110 group-hover:opacity-100"
                    title="Ver foto en tamaño completo"
                  >
                    <ZoomIn size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {!picksApplied && selectedUrls.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => handleConfirmSelection(selectedUrls)}
                disabled={selectedUrls.length === 0 || downloadingSelection}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold text-accent-fg shadow-sm transition-all hover:bg-accent-hover disabled:opacity-50"
              >
                {downloadingSelection && <Loader2 size={13} className="animate-spin" />}
                {downloadingSelection
                  ? "Descargando y aplicando fotos…"
                  : `Aplicar ${selectedUrls.length} foto${selectedUrls.length === 1 ? "" : "s"} seleccionadas`}
              </button>
            </div>
          )}

          {picksApplied && (
            <p className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <CheckCircle2 size={13} />
              ✓ {selectedUrls.length} fotos aplicadas automáticamente al producto (1 portada +{" "}
              {Math.max(0, selectedUrls.length - 1)} en galería).
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
                const top4 = found.slice(0, MAX_PICKS);
                setImageOptions(found);
                setSelectedUrls(top4);
                await handleConfirmSelection(top4);
              }
            }}
            className="mt-3 flex items-center gap-2 border-t border-border/40 pt-3"
          >
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
              <input
                value={manualSearchQuery}
                onChange={(e) => setManualSearchQuery(e.target.value)}
                placeholder="¿Buscar otras fotos? Ej: UGREEN LP130..."
                className="w-full rounded-xl border border-border bg-bg py-1.5 pl-8 pr-3 text-xs text-fg outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingManual || !manualSearchQuery.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-fg transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {isSearchingManual ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              {isSearchingManual ? "Buscando…" : "Buscar"}
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
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-white p-2 shadow-2xl"
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
