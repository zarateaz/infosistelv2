"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductFormState, AdminProduct } from "./actions";

const initialState: ProductFormState = {};

const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent";
const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";

export function ProductForm({
  product,
  categoryNames,
  action,
}: {
  product?: AdminProduct;
  categoryNames: string[];
  action: (prevState: ProductFormState, formData: FormData) => Promise<ProductFormState>;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [onSale, setOnSale] = useState(product?.onSale ?? false);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="name">
            Nombre
          </label>
          <input
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

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="image">
            Ruta de imagen
          </label>
          <input
            id="image"
            name="image"
            defaultValue={product?.image ?? ""}
            placeholder="/img/products/ejemplo.webp"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-fg-muted">
            Déjalo vacío para mostrar el ícono de la categoría.
          </p>
        </div>
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
          disabled={isPending}
          className="rounded-full bg-accent px-7 py-3 text-sm font-bold text-accent-fg transition-opacity disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Guardar"}
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
  );
}
