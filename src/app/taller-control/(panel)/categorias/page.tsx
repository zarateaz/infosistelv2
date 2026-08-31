import { getCategories } from "@/app/tienda/actions";
import { AddCategoryForm } from "./AddCategoryForm";
import { CategoryChip } from "./CategoryChip";

export default async function AdminCategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Categorías</h1>
      <p className="mt-1 text-sm text-fg-muted">{categories.length} categorías en el catálogo.</p>

      <div className="mt-8 space-y-6">
        <div className="admin-glass rounded-[var(--radius-lg)] p-6">
          <h2 className="font-display text-lg font-bold text-fg">Gestionar categorías</h2>
          <div className="mt-5">
            <AddCategoryForm />
          </div>
        </div>

        <div className="admin-glass rounded-[var(--radius-lg)] p-6">
          <div className="flex flex-wrap gap-3">
            {categories.map((c) => (
              <CategoryChip key={c.id} id={c.id} name={c.name} />
            ))}
            {categories.length === 0 && (
              <p className="w-full py-10 text-center text-sm font-medium text-fg-muted">No hay categorías.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
