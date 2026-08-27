import { getCategories } from "@/app/tienda/actions";
import { createProduct } from "../actions";
import { ProductForm } from "../ProductForm";

export default async function NewProductPage() {
  const categories = await getCategories();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Nuevo producto</h1>
      <div className="mt-8">
        <ProductForm categoryNames={categories.map((c) => c.name)} action={createProduct} />
      </div>
    </div>
  );
}
