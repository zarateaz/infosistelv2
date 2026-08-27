import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { getAdminProducts, deleteProduct } from "./actions";
import { DeleteProductButton } from "./DeleteProductButton";

export default async function AdminProductsPage() {
  const products = await getAdminProducts();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Productos</h1>
          <p className="mt-1 text-sm text-fg-muted">{products.length} productos en el catálogo.</p>
        </div>
        <Link
          href="/admin/productos/nuevo"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-fg"
        >
          <Plus size={16} />
          Nuevo producto
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-bg-alt">
        <table className="w-full min-w-[720px] text-left text-sm">
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
                  <p className="font-semibold text-fg">{p.name}</p>
                  {p.onSale && p.salePrice && (
                    <p className="text-xs font-bold text-accent">Oferta: S/. {p.salePrice.toFixed(2)}</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-fg-muted">{p.category}</td>
                <td className="px-5 py-3.5 text-fg">S/. {p.price.toFixed(2)}</td>
                <td className="px-5 py-3.5">
                  <span className={p.stock === 0 ? "font-bold text-red-600" : "text-fg"}>{p.stock}</span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={`/admin/productos/${p.id}`}
                      aria-label={`Editar ${p.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg hover:text-accent"
                    >
                      <Pencil size={15} />
                    </Link>
                    <DeleteProductButton
                      productName={p.name}
                      action={async () => {
                        "use server";
                        await deleteProduct(p.id);
                      }}
                    />
                  </div>
                </td>
              </tr>
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
    </div>
  );
}
