"use client";

import { Fragment, useMemo, useState } from "react";
import Image from "next/image";
import { Search, PackageX } from "lucide-react";
import { CategoryIcon } from "@/components/tienda/categoryIcons";
import { SellButton } from "./SellButton";
import type { AdminProduct } from "../productos/actions";

type StockFilter = "all" | "low" | "out";

const CHIP_TONE = {
  default: "border-border-strong text-fg-muted hover:border-accent hover:text-accent",
  active: "border-accent bg-accent text-accent-fg shadow-md shadow-accent/30",
  warn: "border-amber-500/40 text-amber-600 hover:border-amber-500 hover:bg-amber-50",
  warnActive: "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30",
  danger: "border-red-500/40 text-red-600 hover:border-red-500 hover:bg-red-50",
  dangerActive: "border-red-600 bg-red-600 text-white shadow-md shadow-red-600/30",
};

function FilterChip({
  label,
  count,
  active,
  tone = "default",
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: "default" | "warn" | "danger";
  onClick: () => void;
}) {
  const toneClass = active
    ? tone === "warn"
      ? CHIP_TONE.warnActive
      : tone === "danger"
        ? CHIP_TONE.dangerActive
        : CHIP_TONE.active
    : tone === "warn"
      ? CHIP_TONE.warn
      : tone === "danger"
        ? CHIP_TONE.danger
        : CHIP_TONE.default;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 bg-bg-alt px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-all ${toneClass}`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20" : "bg-fg/5"}`}>{count}</span>
    </button>
  );
}

export function InventoryTable({ products }: { products: AdminProduct[] }) {
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");

  const lowStockCount = products.filter((p) => p.stock <= 3 && p.stock > 0).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (stockFilter === "low" && !(p.stock <= 3 && p.stock > 0)) return false;
      if (stockFilter === "out" && p.stock !== 0) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, query, stockFilter]);

  // Grouped by category — products already arrives sorted category asc,
  // name asc (see productos/actions.ts's getAdminProducts), so this just
  // labels the existing order instead of re-sorting.
  const groups: { category: string; items: typeof filtered }[] = [];
  for (const p of filtered) {
    const current = groups[groups.length - 1];
    if (current && current.category === p.category) current.items.push(p);
    else groups.push({ category: p.category, items: [p] });
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 lg:max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, categoría o código..."
            className="admin-field w-full rounded-xl py-2.5 pl-10 pr-4 text-sm text-fg"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip label="Todos" count={products.length} active={stockFilter === "all"} onClick={() => setStockFilter("all")} />
          <FilterChip
            label="Stock bajo"
            count={lowStockCount}
            active={stockFilter === "low"}
            tone="warn"
            onClick={() => setStockFilter("low")}
          />
          <FilterChip
            label="Agotado"
            count={outOfStockCount}
            active={stockFilter === "out"}
            tone="danger"
            onClick={() => setStockFilter("out")}
          />
        </div>
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-fg-muted">
        {filtered.length} de {products.length} productos
      </p>

      <div className="mt-3 overflow-x-auto admin-glass rounded-[var(--radius-lg)]">
        <table className="w-full min-w-[640px] text-left text-sm">
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
                        <span className="font-semibold text-fg">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-fg-muted">{p.category}</td>
                    <td className="px-5 py-3.5 text-fg">
                      S/. {(p.onSale && p.salePrice ? p.salePrice : p.price).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={p.stock <= 3 ? "font-bold text-red-600" : "text-fg"}>{p.stock}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <SellButton productId={p.id} productName={p.name} stock={p.stock} />
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center text-fg-muted">
                  <div className="flex flex-col items-center gap-2">
                    <PackageX size={28} className="text-fg-muted/50" />
                    <p className="font-semibold">Sin resultados para “{query}”.</p>
                    <p className="text-xs">Prueba con otro nombre, categoría o código de barras.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
