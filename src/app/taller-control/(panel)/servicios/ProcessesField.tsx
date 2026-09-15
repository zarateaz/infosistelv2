"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";
const inputClass = "admin-field w-full rounded-xl px-4 py-2.5 text-sm text-fg";

/** Itemized, add/remove list of repair processes/tasks performed in one
 *  service visit. Same JSON-in-hidden-input convention as ServicePhotosField
 *  — the list is variable-length, which a plain <form> can't submit through
 *  same-named inputs any other way that a server action can parse cleanly. */
export function ProcessesField({ defaultProcesses = [] }: { defaultProcesses?: string[] }) {
  const [rows, setRows] = useState<string[]>(defaultProcesses.length > 0 ? defaultProcesses : [""]);

  function update(index: number, value: string) {
    setRows((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  function add() {
    setRows((prev) => [...prev, ""]);
  }

  function remove(index: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const jsonValue = JSON.stringify(rows.map((r) => r.trim()).filter(Boolean));

  return (
    <div className="sm:col-span-2">
      <label className={labelClass}>Procesos / trabajos realizados</label>
      <input type="hidden" name="processes" value={jsonValue} />

      <div className="mt-1.5 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={row}
              onChange={(e) => update(i, e.target.value)}
              placeholder={i === 0 ? "Ej. Diagnóstico de placa madre" : "Ej. Limpieza interna del equipo"}
              maxLength={300}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={rows.length === 1}
              aria-label="Quitar proceso"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 py-1.5 text-xs font-bold text-fg-muted transition-colors hover:border-accent hover:text-accent"
      >
        <Plus size={14} /> Agregar proceso
      </button>
      <p className="mt-1.5 text-xs text-fg-muted">
        Registra cada trabajo por separado (diagnóstico, limpieza, cambio de piezas, instalación...).
      </p>
    </div>
  );
}
