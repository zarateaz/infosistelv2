"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Barcode, Camera, ScanLine, Loader2, CheckCircle2 } from "lucide-react";
import { lookupBarcode, recognizeProductImage } from "./scan-actions";
import { CameraScanner } from "./CameraScanner";

export interface ScanFill {
  name?: string;
  description?: string;
  category?: string;
  barcode?: string;
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

  async function runBarcodeLookup(code: string) {
    const clean = code.trim();
    if (!clean) return;

    setBarcode(clean);
    setBarcodeStatus({ kind: "loading" });
    const result = await lookupBarcode(clean);

    if (result.existingProductId) {
      setBarcodeStatus({
        kind: "existing",
        id: result.existingProductId,
        name: result.existingProductName ?? "",
      });
      return;
    }

    onFill({ barcode: clean, ...result.suggestion });
    setBarcodeStatus(result.suggestion ? { kind: "found" } : { kind: "not-found" });
  }

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    runBarcodeLookup(barcode);
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
    <div className="mb-8 rounded-[var(--radius-lg)] border border-border bg-bg-alt p-6">
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
          <Link href={`/admin/productos/${barcodeStatus.id}`} className="font-bold text-accent">
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

      {cameraOpen && (
        <CameraScanner onDetected={handleCameraDetected} onClose={() => setCameraOpen(false)} />
      )}
    </div>
  );
}
