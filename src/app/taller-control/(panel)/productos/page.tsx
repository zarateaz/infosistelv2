import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getCategories } from "@/app/tienda/actions";
import { getAdminProducts, createProduct, deleteProduct } from "./actions";
import { CategoryIcon } from "@/components/tienda/categoryIcons";
import { DeleteProductButton } from "./DeleteProductButton";
import { ProductForm } from "./ProductForm";

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([getAdminProducts(), getCategories()]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Productos</h1>
      <p className="mt-1 text-sm text-fg-muted">{products.length} productos en el catálogo.</p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:sticky lg:top-28 lg:col-span-1 lg:self-start">
          <div className="admin-glass rounded-[var(--radius-lg)] p-6">
            <h2 className="mb-6 flex items-center gap-2 font-display text-lg font-bold text-fg">
              <Plus size={18} className="text-accent" /> Añadir producto
            </h2>
            <ProductForm categoryNames={categories.map((c) => c.name)} action={createProduct} showScanner />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="overflow-x-auto admin-glass rounded-[var(--radius-lg)]">
            <table className="w-full min-w-[560px] text-left text-sm">
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
      </div>
    </div>
  );
}
