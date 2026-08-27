"use client";

import { useEffect, useState } from "react";
import { Search, X, ShoppingCart, Package } from "lucide-react";
import { getProducts, getCategories } from "@/app/tienda/actions";
import { ProductCard } from "@/components/tienda/ProductCard";
import { ProductModal } from "@/components/tienda/ProductModal";
import { CartDrawer, type CartLine } from "@/components/tienda/CartDrawer";
import type { Product } from "@/types";

export default function TiendaPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    getProducts().then(setProducts);
    getCategories().then((cats) => setCategories(cats.map((c) => c.name)));
  }, []);

  // Debounced so the grid doesn't re-filter/re-render on every keystroke —
  // matters more on phones than desktops.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = products
    .filter((p) => activeCategory === "Todos" || p.category === activeCategory)
    .filter((p) => p.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
    .sort((a, b) => (a.isFeatured === b.isFeatured ? 0 : a.isFeatured ? -1 : 1));

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((line) => line.product.id !== productId));

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => {
    const unit = line.product.onSale && line.product.salePrice ? line.product.salePrice : line.product.price;
    return sum + unit * line.quantity;
  }, 0);

  return (
    <div className="min-h-screen bg-bg pb-24 pt-24">
      <div className="mx-auto max-w-7xl px-6 pb-8 md:px-10">
        <h1 className="font-display text-4xl font-bold tracking-tight text-fg sm:text-5xl">
          Nuestra <span className="text-accent">tienda</span>
        </h1>
        <p className="mt-3 text-sm text-fg-muted">Repuestos y equipos · Garantía Infosistel</p>
      </div>

      <div className="sticky top-16 z-40 border-y border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl space-y-3 px-6 py-3 md:px-10">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl bg-bg-alt py-2.5 pl-10 pr-4 text-sm text-fg outline-none placeholder:text-fg-muted"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X size={14} className="text-fg-muted" />
                </button>
              )}
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-black text-accent-fg"
            >
              <ShoppingCart size={16} />
              <span className="hidden sm:inline">Carrito</span>
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {["Todos", ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-1.5 text-xs font-black transition-colors ${
                  activeCategory === cat ? "bg-accent text-accent-fg" : "bg-bg-alt text-fg-muted hover:text-fg"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border py-20 text-center">
            <Package size={40} className="mx-auto mb-3 text-fg-muted opacity-40" />
            <p className="text-lg font-black text-fg-muted">Sin resultados</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={() => setSelectedProduct(product)}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        )}
      </div>

      {cartCount > 0 && !isCartOpen && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-24 right-5 z-50 flex items-center gap-2.5 rounded-2xl bg-accent px-5 py-3.5 text-sm font-black text-accent-fg shadow-2xl sm:hidden"
        >
          <ShoppingCart size={18} />
          <span>S/. {cartTotal.toFixed(0)}</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-fg text-[10px] font-black text-accent">
            {cartCount}
          </span>
        </button>
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
        />
      )}

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onRemove={removeFromCart}
        onOrderPlaced={() => setCart([])}
      />
    </div>
  );
}
