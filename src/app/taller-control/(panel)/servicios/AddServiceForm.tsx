"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { createService, type ServiceFormState } from "./actions";
import type { AdminTechnician } from "./actions";
import { ServicePhotosField } from "./ServicePhotosField";

const initialState: ServiceFormState = {};
const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";
const inputClass =
  "mt-1.5 w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-fg outline-none focus:border-accent";

function todayLocalISO(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

export function AddServiceForm({ technicians }: { technicians: AdminTechnician[] }) {
  const [state, formAction, isPending] = useActionState(createService, initialState);
  const [uploading, setUploading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.error && !isPending) formRef.current?.reset();
  }, [state, isPending]);

  return (
    <div className="admin-glass rounded-[var(--radius-lg)] p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
        <Plus size={18} className="text-accent" /> Registrar servicio técnico
      </h2>

      <form ref={formRef} action={formAction} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="clientName">
            Cliente
          </label>
          <input id="clientName" name="clientName" type="text" required maxLength={150} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="technicianId">
            Técnico asignado
          </label>
          <select id="technicianId" name="technicianId" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Selecciona un técnico
            </option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.specialty ? ` — ${t.specialty}` : ""}
              </option>
            ))}
          </select>
          {technicians.length === 0 && (
            <p className="mt-1.5 text-xs text-red-600">Registra al menos un técnico activo antes de crear un servicio.</p>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="title">
            Trabajo realizado
          </label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="Ej. Mantenimiento de PC"
            required
            maxLength={150}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="serviceDate">
            Fecha del servicio
          </label>
          <input
            id="serviceDate"
            name="serviceDate"
            type="date"
            required
            defaultValue={todayLocalISO()}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="description">
            Descripción del trabajo
          </label>
          <textarea id="description" name="description" required rows={3} maxLength={2000} className={inputClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor="amount">
            Monto (S/.)
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="paymentMethod">
            Forma de pago
          </label>
          <select id="paymentMethod" name="paymentMethod" required className={inputClass} defaultValue="Efectivo">
            <option value="Efectivo">Efectivo</option>
            <option value="Yape">Yape</option>
            <option value="Pendiente de pago">Pendiente de pago</option>
          </select>
        </div>

        <ServicePhotosField onUploadingChange={setUploading} />

        {state.error && <p className="sm:col-span-2 text-sm font-medium text-red-600">{state.error}</p>}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isPending || uploading}
            className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {uploading ? "Subiendo fotos..." : isPending ? "Registrando..." : "Registrar servicio"}
          </button>
        </div>
      </form>
    </div>
  );
}
