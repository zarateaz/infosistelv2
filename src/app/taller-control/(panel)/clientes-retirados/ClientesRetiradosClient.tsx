"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ROUTERS, type InternetClientRow } from "../cobranza-internet/cobranza";
import { RetiredClientsPanel } from "../cobranza-internet/RetiredClientsPanel";

export function ClientesRetiradosClient({ clients }: { clients: InternetClientRow[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRouter, setFilterRouter] = useState("ALL");
  const [filterGaleria, setFilterGaleria] = useState("ALL");

  const galerias = useMemo(
    () => Array.from(new Set(clients.map((c) => c.galeria?.trim()).filter((g): g is string => Boolean(g)))).sort(),
    [clients]
  );

  const term = searchTerm.trim().toLowerCase();
  const filtered = clients.filter((c) => {
    if (filterRouter !== "ALL" && c.router !== filterRouter) return false;
    if (filterGaleria !== "ALL" && c.galeria?.trim() !== filterGaleria) return false;
    if (!term) return true;
    return [c.clientName, c.whatsapp, c.galeria, c.clientCode, c.router, c.retiredReason].some((v) =>
      v?.toLowerCase().includes(term)
    );
  });

  const selectClass = "rounded-xl border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-fg outline-none";

  return (
    <section className="admin-glass mt-8 rounded-[var(--radius-lg)] p-6">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border/60 pb-3">
        <select value={filterRouter} onChange={(e) => setFilterRouter(e.target.value)} className={selectClass} aria-label="Router">
          <option value="ALL">Todos los routers</option>
          {ROUTERS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {galerias.length > 0 && (
          <select value={filterGaleria} onChange={(e) => setFilterGaleria(e.target.value)} className={`${selectClass} max-w-[180px]`} aria-label="Galería">
            <option value="ALL">Todas las galerías</option>
            {galerias.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar cliente, cód, galería, motivo..."
            className="w-56 rounded-xl border border-border bg-bg py-1.5 pl-8 pr-3 text-xs font-medium text-fg outline-none placeholder:text-fg-muted focus:border-accent sm:w-64"
          />
        </div>
      </div>
      <RetiredClientsPanel clients={filtered} totalRetired={clients.length} />
    </section>
  );
}
