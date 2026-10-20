"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, ShoppingBag, X, Check, Package, Plus, Sparkles, Layers } from "lucide-react";
import { searchCatalogProducts, type CatalogProductResult } from "./actions";

interface StoreCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: CatalogProductResult) => void;
  currencySymbol?: string;
}

export function StoreCatalogModal({
  isOpen,
  onClose,
  onSelectProduct,
  currencySymbol = "S/.",
}: StoreCatalogModalProps) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<CatalogProductResult[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("TODAS");
  const [isPending, startTransition] = useTransition();
  const [addedId, setAddedId] = useState<string | null>(null);

  // Load products on open or query change
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await searchCatalogProducts(query);
          setProducts(res || []);
        } catch {
          setProducts([]);
        }
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen, query]);

  if (!isOpen) return null;

  // Extract unique categories
  const categories = [
    "TODAS",
    ...Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[])),
  ];

  const filteredProducts = selectedCategory === "TODAS"
    ? products
    : products.filter((p) => p.category === selectedCategory);

  const handleSelect = (product: CatalogProductResult) => {
    setAddedId(product.id);
    onSelectProduct(product);
    setTimeout(() => {
      setAddedId(null);
      onClose();
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-3xl border border-border/80 bg-bg-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-alt/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-fg flex items-center gap-2">
                Catálogo de Productos de la Tienda
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {filteredProducts.length} disponibles
                </span>
              </h3>
              <p className="text-xs text-fg-muted">
                Selecciona cualquier producto para importar su precio, foto, marca y especificaciones a la cotización.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-fg-muted hover:bg-fg/5 hover:text-fg transition-colors"
            title="Cerrar catálogo"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search bar & Category filters */}
        <div className="p-4 border-b border-border bg-bg-surface space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              autoFocus
              placeholder="Escribe para buscar: ej. mouse, laptop, teclado, pantalla, cable, disco..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="admin-field w-full rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-fg h-11"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-fg-muted hover:text-fg font-bold"
              >
                Limpiar
              </button>
            )}
          </div>

          {categories.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <Layers size={13} className="text-fg-muted shrink-0 ml-1" />
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-xl px-3 py-1 text-xs font-bold transition-all shrink-0 ${
                    selectedCategory === cat
                      ? "bg-accent text-accent-fg shadow-xs"
                      : "bg-bg-alt/70 text-fg-muted hover:text-fg hover:bg-bg-alt"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isPending && products.length === 0 ? (
            <div className="py-16 text-center text-fg-muted text-xs flex flex-col items-center gap-2">
              <Sparkles size={24} className="animate-spin text-accent" />
              <span>Cargando productos de la tienda…</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-fg-muted text-xs space-y-2">
              <Package size={36} className="mx-auto opacity-30" />
              <p className="font-bold text-fg">No se encontraron productos con &quot;{query}&quot;</p>
              <p>Intenta con otra palabra clave o agrega el ítem manualmente en la cotización.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredProducts.map((p) => {
                const isSelected = addedId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`group relative flex flex-col justify-between rounded-2xl border p-3.5 transition-all duration-200 bg-bg hover:border-accent/50 hover:shadow-lg ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30"
                        : "border-border/70"
                    }`}
                  >
                    <div>
                      {/* Product image & badges */}
                      <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-border/50 flex items-center justify-center p-2">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name}
                            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1 text-fg-muted/40">
                            <Package size={32} />
                            <span className="text-[10px] font-medium">Sin imagen</span>
                          </div>
                        )}

                        {/* Stock badge */}
                        <span
                          className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            p.stock > 0
                              ? "bg-emerald-500/90 text-white shadow-xs"
                              : "bg-rose-500/90 text-white"
                          }`}
                        >
                          {p.stock > 0 ? `Stock: ${p.stock}` : "Agotado"}
                        </span>

                        {p.category && (
                          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                            {p.category}
                          </span>
                        )}
                      </div>

                      {/* Product info */}
                      <div className="mt-3">
                        <h4 className="font-bold text-xs text-fg leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                          {p.name}
                        </h4>
                        {p.description && (
                          <p className="mt-1 text-[11px] text-fg-muted line-clamp-2 leading-relaxed">
                            {p.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Price & Action Button */}
                    <div className="mt-3.5 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                          P. Venta
                        </div>
                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          {currencySymbol} {p.price.toFixed(2)}
                        </div>
                        {p.costPrice ? (
                          <div className="text-[10px] text-fg-muted">
                            Costo: {currencySymbol} {p.costPrice.toFixed(2)}
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelect(p)}
                        disabled={isSelected}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all shadow-xs active:scale-95 ${
                          isSelected
                            ? "bg-emerald-500 text-white"
                            : "bg-accent text-accent-fg hover:bg-accent-hover hover:shadow-md"
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check size={14} />
                            <span>¡Agregado!</span>
                          </>
                        ) : (
                          <>
                            <Plus size={14} />
                            <span>Cotizar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-bg-alt/30 flex items-center justify-between text-xs text-fg-muted">
          <span>💡 Al seleccionar un producto se cargará su foto, precio y ficha técnica automáticamente.</span>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-fg hover:underline"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
