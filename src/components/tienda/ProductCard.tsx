"use client";

import Image from "next/image";
import { ShoppingCart, Star } from "lucide-react";
import { CategoryIcon } from "@/components/tienda/categoryIcons";
import type { Product } from "@/types";

export function ProductCard({
  product,
  onSelect,
  onAddToCart,
}: {
  product: Product;
  onSelect: () => void;
  onAddToCart: (p: Product) => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-bg-alt transition-colors hover:border-accent/40"
    >
      <div className="relative aspect-square bg-bg">
        {product.image ? (
          <Image src={product.image} alt={product.name} fill className="object-contain p-4" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CategoryIcon category={product.category} size={40} strokeWidth={1.25} className="text-fg-muted opacity-40" />
          </div>
        )}

        {product.isFeatured && (
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[9px] font-black text-accent-fg">
            <Star size={9} fill="currentColor" /> TOP
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
          aria-label="Añadir al carrito"
          className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-fg opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        >
          <ShoppingCart size={14} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <span className="truncate text-[9px] font-black uppercase tracking-[0.2em] text-fg-muted">
          {product.category}
        </span>
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-fg">{product.name}</h3>
        <div className="mt-auto flex items-center justify-between pt-2">
          {product.onSale && product.salePrice ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-black text-accent">S/. {product.salePrice.toFixed(2)}</span>
              <span className="text-xs text-fg-muted line-through">S/. {product.price.toFixed(2)}</span>
            </div>
          ) : (
            <span className="text-base font-black text-fg">S/. {product.price.toFixed(2)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
