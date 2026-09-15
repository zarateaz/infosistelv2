"use client";

import { useState } from "react";
import { Fragment } from "react";
import { Pencil, List, LayoutGrid } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { CategoryIcon } from "@/components/tienda/categoryIcons";
import { DeleteProductButton } from "./DeleteProductButton";
import { deleteProduct, type AdminProduct } from "./actions";

type ViewMode = "list" | "grid";

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  const btnClass = (active: boolean) =>
    `flex h-8 w-9 items-center justify-center rounded-lg transition-colors ${
      active ? "bg-accent text-accent-fg shadow-sm" : "text-fg-muted hover:text-accent"
    }`;
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border-2 border-border-strong bg-bg-alt p-1">
      <button type="button" onClick={() => onChange("list")} aria-label="Ver como lista" className={btnClass(mode === "list")}>
        <List size={15} />
      </button>
      <button type="button" onClick={() => onChange("grid")} aria-label="Ver en cuadros" className={btnClass(mode === "grid")}>
        <LayoutGrid size={15} />
      </button>
    </div>
  );
}

function ProductGridCard({ p }: { p: AdminProduct }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-bg-alt transition-shadow hover:shadow-lg hover:shadow-accent/10">
      <div className="relative aspect-square w-full bg-bg">
        {p.image ? (
          <Image
            src={p.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CategoryIcon category={p.category} size={32} strokeWidth={1.5} className="text-fg-muted opacity-40" />
          </div>
        )}
        {p.stock === 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Agotado
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-fg">{p.name}</p>
        <p className="truncate text-[11px] font-bold uppercase tracking-wide text-fg-muted">{p.category}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <span className="font-bold text-fg">S/. {p.price.toFixed(2)}</span>
            {p.onSale && p.salePrice && <p className="text-xs font-bold text-accent">Oferta: S/. {p.salePrice.toFixed(2)}</p>}
          </div>
          <span className={`text-xs font-bold ${p.stock === 0 ? "text-red-600" : "text-fg-muted"}`}>{p.stock} u.</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2">
          <Link
            href={`/taller-control/productos/${p.id}`}
            aria-label={`Editar ${p.name}`}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold text-fg-muted transition-colors hover:bg-bg hover:text-accent"
          >
            <Pencil size={13} /> Editar
          </Link>
          <DeleteProductButton productName={p.name} action={() => deleteProduct(p.id)} />
        </div>
      </div>
    </div>
  );
}

export function ProductsView({ products }: { products: AdminProduct[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // products already arrives sorted category asc, name asc (see
  // getAdminProducts) — grouping here just labels that order.
  const groups: { category: string; items: AdminProduct[] }[] = [];
  for (const p of products) {
    const current = groups[groups.length - 1];
    if (current && current.category === p.category) current.items.push(p);
    else groups.push({ category: p.category, items: [p] });
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === "list" ? (
        <div className="overflow-x-auto admin-glass rounded-[var(--radius-lg)]">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="admin-thead text-xs font-bold uppercase tracking-wider text-fg-muted">
                <th className="px-5 py-3">Producto</th>
                <th className="px-5 py-3">Categoría</th>
                <th className="px-5 py-3">Precio</th>
                <th className="px-5 py-3">Stock</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.category}>
                  <tr className="bg-accent/10">
                    <td colSpan={5} className="px-5 py-2">
                      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-accent">
                        <CategoryIcon category={group.category} size={14} strokeWidth={2} />
                        {group.category}
                        <span className="font-semibold text-accent/70">· {group.items.length}</span>
                      </div>
                    </td>
                  </tr>
                  {group.items.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-bg">
                            {p.image ? (
                              <Image src={p.image} alt="" fill sizes="40px" className="object-cover" />
                            ) : (
                              <CategoryIcon category={p.category} size={18} strokeWidth={1.5} className="text-fg-muted opacity-50" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-fg">{p.name}</p>
                            {p.onSale && p.salePrice && (
                              <p className="text-xs font-bold text-accent">Oferta: S/. {p.salePrice.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-fg-muted">{p.category}</td>
                      <td className="px-5 py-3.5 text-fg">S/. {p.price.toFixed(2)}</td>
                      <td className="px-5 py-3.5">
                        <span className={p.stock === 0 ? "font-bold text-red-600" : "text-fg"}>{p.stock}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/taller-control/productos/${p.id}`}
                            aria-label={`Editar ${p.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg hover:text-accent"
                          >
                            <Pencil size={15} />
                          </Link>
                          <DeleteProductButton productName={p.name} action={() => deleteProduct(p.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-fg-muted">
                    Todavía no hay productos. Crea el primero.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {groups.map((group) => (
            <div key={group.category} className="mb-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-accent">
                <CategoryIcon category={group.category} size={14} strokeWidth={2} />
                {group.category}
                <span className="font-semibold text-accent/70">· {group.items.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.items.map((p) => (
                  <ProductGridCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <div className="admin-glass rounded-[var(--radius-lg)] py-10 text-center text-fg-muted">
              Todavía no hay productos. Crea el primero.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
