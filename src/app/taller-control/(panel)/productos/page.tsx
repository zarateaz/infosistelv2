import { Plus } from "lucide-react";
import { getCategories } from "@/app/tienda/actions";
import { getAdminProducts, createProduct } from "./actions";
import { ProductForm } from "./ProductForm";
import { ProductsView } from "./ProductsView";

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
          <ProductsView products={products} />
        </div>
      </div>
    </div>
  );
}
