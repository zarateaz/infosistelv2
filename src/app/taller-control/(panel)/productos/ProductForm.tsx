"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, AlertCircle } from "lucide-react";
import type { ProductFormState, AdminProduct } from "./actions";
import { checkDuplicateProduct } from "./actions";
import { ScannerPanel, type ScanFill } from "./ScannerPanel";
import { ImageUploadField } from "./ImageUploadField";
import { ImageGalleryField } from "./ImageGalleryField";
import { ExistingProductActionCard } from "./ExistingProductActionCard";
import type { DuplicateDetectionResult } from "@/lib/duplicateDetection";

const initialState: ProductFormState = {};

/** Product.images is stored as a JSON-encoded string (see actions.ts) —
 *  tolerant of null/malformed values since this only ever reads back what
 *  the app itself wrote. */
function parseImagesJson(value?: string | null): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : undefined;
  } catch {
    return undefined;
  }
}

const inputClass = "admin-field mt-2 w-full rounded-xl px-4 py-2.5 text-sm text-fg";
const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";

export function ProductForm({
  product,
  categoryNames,
  action,
  showScanner = false,
}: {
  product?: AdminProduct;
  categoryNames: string[];
  action: (prevState: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  showScanner?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [onSale, setOnSale] = useState(product?.onSale ?? false);
  const [imageUploading, setImageUploading] = useState(false);
  const [scannedImagePath, setScannedImagePath] = useState<string | null>(null);
  const [scannedGalleryImages, setScannedGalleryImages] = useState<string[] | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateDetectionResult | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const costPriceRef = useRef<HTMLInputElement>(null);
  const stockRef = useRef<HTMLInputElement>(null);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performDuplicateCheck = async (nameVal?: string, barcodeVal?: string) => {
    const currentName = nameVal !== undefined ? nameVal : (nameRef.current?.value ?? "");
    const currentBarcode = barcodeVal !== undefined ? barcodeVal : (barcodeRef.current?.value ?? "");

    if (!currentName.trim() && !currentBarcode.trim()) {
      setDuplicateWarning(null);
      return;
    }

    try {
      const res = await checkDuplicateProduct(currentName, currentBarcode, product?.id);
      if (res.isDuplicate) {
        setDuplicateWarning(res);
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      // Best effort check
    }
  };

  const scheduleDuplicateCheck = (nameVal?: string, barcodeVal?: string) => {
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    checkTimeoutRef.current = setTimeout(() => {
      performDuplicateCheck(nameVal, barcodeVal);
    }, 350);
  };

  function handleScanFill(fill: ScanFill) {
    if (fill.name && nameRef.current) nameRef.current.value = fill.name;
    if (fill.description && descriptionRef.current) descriptionRef.current.value = fill.description;
    if (fill.category && categoryRef.current) categoryRef.current.value = fill.category;
    if (fill.barcode && barcodeRef.current) barcodeRef.current.value = fill.barcode;
    if (fill.price !== undefined && priceRef.current) {
      priceRef.current.value = String(fill.price);
    }
    if (fill.costPrice !== undefined && costPriceRef.current) {
      costPriceRef.current.value = String(fill.costPrice ?? 0);
    }
    if (fill.stock !== undefined && stockRef.current) {
      stockRef.current.value = String(fill.stock);
    }
    if (fill.image) setScannedImagePath(fill.image);
    if (fill.images) setScannedGalleryImages(fill.images);

    performDuplicateCheck(fill.name, fill.barcode);
  }

  return (
    <div className="max-w-2xl">
      {showScanner && <ScannerPanel onFill={handleScanFill} />}

      <form action={formAction} className="space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="name">
              Nombre
            </label>
            <input
              ref={nameRef}
              id="name"
              name="productName"
              defaultValue={product?.name}
              required
              autoComplete="off"
              className={inputClass}
              onChange={(e) => scheduleDuplicateCheck(e.target.value, undefined)}
              onBlur={(e) => performDuplicateCheck(e.target.value, undefined)}
            />
          </div>

          {duplicateWarning?.isDuplicate && duplicateWarning.existingProduct && (
            <div className="sm:col-span-2">
              <ExistingProductActionCard
                product={duplicateWarning.existingProduct}
                onFill={handleScanFill}
                onStockUpdated={(newStock) => {
                  if (stockRef.current) stockRef.current.value = String(newStock);
                }}
              />
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="category">
              Categoría
            </label>
            <input
              ref={categoryRef}
              id="category"
              name="category"
              list="category-options"
              defaultValue={product?.category}
              required
              autoComplete="off"
              className={inputClass}
              placeholder="Ej. LAPTOPS"
            />
            <datalist id="category-options">
              {categoryNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={labelClass} htmlFor="stock">
              Stock
            </label>
            <input
              ref={stockRef}
              id="stock"
              name="stock"
              type="number"
              min={0}
              step={1}
              defaultValue={product?.stock ?? 0}
              required
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="description">
              Descripción
            </label>
            <textarea
              ref={descriptionRef}
              id="description"
              name="description"
              defaultValue={product?.description}
              required
              rows={3}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="price">
              Precio (S/.)
            </label>
            <input
              ref={priceRef}
              id="price"
              name="price"
              type="number"
              min={0}
              step={0.01}
              defaultValue={product?.price}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="costPrice">
              Precio de costo (S/.)
            </label>
            <input
              ref={costPriceRef}
              id="costPrice"
              name="costPrice"
              type="number"
              min={0}
              step={0.01}
              defaultValue={product?.costPrice ?? 0}
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-fg-muted">Solo visible aquí — nunca sale al público.</p>
          </div>

          <div>
            <label className={labelClass} htmlFor="barcode">
              Código de barras
            </label>
            <input
              ref={barcodeRef}
              id="barcode"
              name="barcode"
              defaultValue={product?.barcode ?? ""}
              autoComplete="off"
              className={inputClass}
              placeholder="Opcional"
              onChange={(e) => scheduleDuplicateCheck(undefined, e.target.value)}
              onBlur={(e) => performDuplicateCheck(undefined, e.target.value)}
            />
          </div>

          <ImageUploadField
            defaultValue={product?.image}
            onUploadingChange={setImageUploading}
            autoImagePath={scannedImagePath}
          />

          <ImageGalleryField
            defaultValue={parseImagesJson(product?.images)}
            autoImages={scannedGalleryImages}
          />
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-medium text-fg">
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={product?.isFeatured}
              className="h-4 w-4 rounded border-border-strong accent-accent"
            />
            Destacado
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-fg">
            <input
              type="checkbox"
              name="onSale"
              checked={onSale}
              onChange={(e) => setOnSale(e.target.checked)}
              className="h-4 w-4 rounded border-border-strong accent-accent"
            />
            En oferta
          </label>

          {onSale && (
            <div className="flex items-center gap-2">
              <label htmlFor="salePrice" className={labelClass}>
                Precio oferta
              </label>
              <input
                id="salePrice"
                name="salePrice"
                type="number"
                min={0}
                step={0.01}
                defaultValue={product?.salePrice ?? ""}
                className="w-32 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-accent"
              />
            </div>
          )}
        </div>

        {state.error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-semibold text-red-600 dark:text-red-400"
          >
            <AlertCircle className="mt-0.5 shrink-0 text-red-500" size={18} />
            <div>{state.error}</div>
          </div>
        )}

        {duplicateWarning?.isDuplicate && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400">
            <AlertTriangle size={16} className="shrink-0 text-red-500" />
            <span>Guardado bloqueado: este producto ya está en tu inventario (0 margen de error).</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || imageUploading || !!duplicateWarning?.isDuplicate}
            className="rounded-full bg-accent px-7 py-3 text-sm font-bold text-accent-fg transition-opacity disabled:opacity-60"
          >
            {duplicateWarning?.isDuplicate
              ? "🚫 Producto ya en inventario"
              : isPending
              ? "Guardando..."
              : imageUploading
              ? "Subiendo imagen..."
              : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/taller-control/productos")}
            className="rounded-full border border-border-strong px-7 py-3 text-sm font-bold text-fg transition-colors hover:border-accent hover:text-accent"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
