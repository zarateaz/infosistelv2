import Image from "next/image";
import { getAdminProducts } from "../productos/actions";
import { CategoryIcon } from "@/components/tienda/categoryIcons";
import { SellButton } from "./SellButton";

export default async function AdminInventoryPage() {
  const products = await getAdminProducts();
  const lowStock = products.filter((p) => p.stock <= 3).length;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Inventario</h1>
      <p className="mt-1 text-sm text-fg-muted">
        {products.length} productos · {lowStock} con stock bajo (≤3).
      </p>

      <div className="mt-8 overflow-x-auto admin-glass rounded-[var(--radius-lg)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-bold uppercase tracking-wider text-fg-muted">
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3">Categoría</th>
              <th className="px-5 py-3">Precio</th>
              <th className="px-5 py-3">Stock</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
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
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-fg-muted">
                  Todavía no hay productos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
