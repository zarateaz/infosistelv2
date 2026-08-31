"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Barcode, Camera, ScanLine, Loader2, CheckCircle2, ImageIcon } from "lucide-react";
import { lookupBarcode, recognizeProductImage } from "./scan-actions";
import { downloadProductImageFromUrl } from "./upload-actions";
import { CameraScanner } from "./CameraScanner";

// The site's CSP (img-src 'self' blob: data:) blocks hotlinking the image
// search results directly — this re-serves them from our own origin just
// for the picker preview. See src/app/api/image-proxy/route.ts.
const previewUrl = (externalUrl: string) => `/api/image-proxy?url=${encodeURIComponent(externalUrl)}`;

export interface ScanFill {
  name?: string;
  description?: string;
  category?: string;
  barcode?: string;
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
    | { kind: "existing"; id: string; name: string }
    | { kind: "found" }
    | { kind: "not-found" }
  >({ kind: "idle" });
  const [cameraOpen, setCameraOpen] = useState(false);

  const [imageStatus, setImageStatus] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "done" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function runBarcodeLookup(code: string) {
    const clean = code.trim();
    if (!clean) return;

    setBarcode(clean);
    setBarcodeStatus({ kind: "loading" });
    setImageOptions([]);
    setSelectedUrls([]);
    setPicksApplied(false);
    const result = await lookupBarcode(clean);

    if (result.existingProductId) {
      setBarcodeStatus({
        kind: "existing",
        id: result.existingProductId,
        name: result.existingProductName ?? "",
      });
      return;
    }

    const { imageUrl, imageOptions: candidates, ...suggestion } = result.suggestion ?? {};
    onFill({ barcode: clean, ...suggestion });
    setBarcodeStatus(result.suggestion ? { kind: "found" } : { kind: "not-found" });
    if (candidates && candidates.length > 0) setImageOptions(candidates);

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

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageStatus({ kind: "loading" });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const result = await recognizeProductImage(dataUrl);
    if (result.error) {
      setImageStatus({ kind: "error", message: result.error });
      return;
    }
    onFill({ name: result.name, description: result.description, category: result.category });
    setImageStatus({ kind: "done" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border-strong px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-accent hover:text-accent">
          {imageStatus.kind === "loading" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Camera size={15} />
          )}
          Reconocer con IA
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
        <p className="mt-3 text-sm text-fg-muted">
          Ya existe en el catálogo:{" "}
          <Link href={`/taller-control/productos/${barcodeStatus.id}`} className="font-bold text-accent">
            {barcodeStatus.name} — editar para actualizar stock
          </Link>
        </p>
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
          foto de la caja.
        </p>
      )}
      {imageStatus.kind === "done" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-accent">
          <CheckCircle2 size={15} />
          Datos leídos de la foto y completados abajo — revísalos antes de guardar.
        </p>
      )}
      {imageStatus.kind === "error" && (
        <p className="mt-3 text-sm font-medium text-red-600">{imageStatus.message}</p>
      )}

      {imageOptions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-muted">
            <ImageIcon size={13} />
            Este producto no tiene foto en su ficha — elige hasta {MAX_PICKS} encontradas en
            internet (la primera será la foto principal, el resto quedan de referencia)
          </p>
          <div className="flex flex-wrap items-end gap-3">
            {imageOptions.map((url, i) => {
              const order = selectedUrls.indexOf(url);
              const selected = order !== -1;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleSelection(url)}
                  disabled={downloadingSelection}
                  className={`group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-2 transition-all disabled:cursor-wait ${
                    selected ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/50"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl(url)}
                    alt={`Opción ${i + 1}`}
                    className="h-full w-full object-contain bg-white p-1"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {selected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-accent/20">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-fg">
                        {order === 0 ? <CheckCircle2 size={14} /> : order + 1}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleConfirmSelection}
              disabled={selectedUrls.length === 0 || downloadingSelection}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-xs font-bold text-accent-fg transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloadingSelection && <Loader2 size={13} className="animate-spin" />}
              {downloadingSelection
                ? "Guardando…"
                : `Usar ${selectedUrls.length || ""} foto${selectedUrls.length === 1 ? "" : "s"}`.trim()}
            </button>
          </div>
          {picksApplied && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent">
              <CheckCircle2 size={13} />
              Fotos aplicadas abajo.
            </p>
          )}
        </div>
      )}

      {cameraOpen && (
        <CameraScanner onDetected={handleCameraDetected} onClose={() => setCameraOpen(false)} />
      )}
    </div>
  );
}
