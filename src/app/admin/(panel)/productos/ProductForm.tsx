"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductFormState, AdminProduct } from "./actions";
import { ScannerPanel, type ScanFill } from "./ScannerPanel";
import { ImageUploadField } from "./ImageUploadField";

const initialState: ProductFormState = {};

const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent";
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

  const nameRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  function handleScanFill(fill: ScanFill) {
    if (fill.name && nameRef.current) nameRef.current.value = fill.name;
    if (fill.description && descriptionRef.current) descriptionRef.current.value = fill.description;
    if (fill.category && categoryRef.current) categoryRef.current.value = fill.category;
    if (fill.barcode && barcodeRef.current) barcodeRef.current.value = fill.barcode;
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
            />
          </div>

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
            />
          </div>

          <ImageUploadField defaultValue={product?.image} onUploadingChange={setImageUploading} />
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
          <p role="alert" className="text-sm font-medium text-red-600">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || imageUploading}
            className="rounded-full bg-accent px-7 py-3 text-sm font-bold text-accent-fg transition-opacity disabled:opacity-60"
          >
            {isPending ? "Guardando..." : imageUploading ? "Subiendo imagen..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/productos")}
            className="rounded-full border border-border-strong px-7 py-3 text-sm font-bold text-fg transition-colors hover:border-accent hover:text-accent"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
