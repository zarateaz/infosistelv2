import { getCategories } from "@/app/tienda/actions";
import { AddCategoryForm } from "./AddCategoryForm";
import { CategoryChip } from "./CategoryChip";

export default async function AdminCategoriesPage() {
  const categories = await getCategories();

  // categories already arrives sorted name asc (see getCategories) —
  // grouping by first letter just turns 56 chips in a row into a scannable
  // A-Z index instead of a wall of text.
  const groups: { letter: string; items: typeof categories }[] = [];
  for (const c of categories) {
    const letter = c.name.charAt(0).toUpperCase();
    const current = groups[groups.length - 1];
    if (current && current.letter === letter) current.items.push(c);
    else groups.push({ letter, items: [c] });
  }

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
          {groups.map((group) => (
            <div key={group.letter} className="mb-5 last:mb-0">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-accent-fg">
                  {group.letter}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-wrap gap-3">
                {group.items.map((c) => (
                  <CategoryChip key={c.id} id={c.id} name={c.name} />
                ))}
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="w-full py-10 text-center text-sm font-medium text-fg-muted">No hay categorías.</p>
          )}
        </div>
      </div>
    </div>
  );
}
