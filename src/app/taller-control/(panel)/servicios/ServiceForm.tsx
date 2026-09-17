"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { ShieldCheck, X } from "lucide-react";
import {
  createService,
  updateService,
  deleteServicePhoto,
  type AdminService,
  type AdminTechnician,
  type AdminEquipmentType,
  type ServiceFormState,
} from "./actions";
import { PAYMENT_METHODS, PAY_NOW_METHODS, PAYMENT_METHOD_LABELS, formatSoles } from "./utils";
import { AutoGrowInput } from "../AutoGrowInput";
import { ServicePhotosField } from "./ServicePhotosField";
import { dateToInputValue, todayInputValue } from "../caja/month";

const initialState: ServiceFormState = {};
const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";
const inputClass = "admin-field mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm text-fg";

/** Un solo formulario para crear y editar — igual que el diseño original,
 *  que reutiliza la misma vista "Nuevo/Editar servicio" para ambos casos.
 *  Sin `service`, crea; con `service`, edita ese registro. */
export function ServiceForm({
  service,
  technicians,
  equipmentTypes,
  onDone,
}: {
  service?: AdminService;
  technicians: AdminTechnician[];
  equipmentTypes: AdminEquipmentType[];
  onDone: () => void;
}) {
  const boundAction = service ? updateService.bind(null, service.id) : createService;
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [uploading, setUploading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>(service?.paymentMethod ?? "EFECTIVO");
  const [amount, setAmount] = useState(service?.amount ?? 0);
  const [advanceAmount, setAdvanceAmount] = useState(service?.advanceAmount ?? 0);
  const [existingPhotos, setExistingPhotos] = useState(service?.photos ?? []);

  // `state !== initialState` is the part that was missing: useActionState's
  // `state` IS `initialState` (same object reference) on first render,
  // before any submission — and at that point isPending is also already
  // false. Without this check, the effect's condition was true from the
  // very first render, closing the form (onDone) the instant it opened,
  // with no submission involved — reported directly: the form "flashed
  // for a few seconds" (however long the initial render/hydration took)
  // and then vanished on its own. A real submission always produces a
  // *new* object (either `{}` or `{error}`), never the original reference,
  // so this only fires after something actually happened.
  useEffect(() => {
    if (state !== initialState && !state.error && !isPending) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isPending]);

  const isPartial = paymentMethod === "PARCIAL";
  const saldo = Math.max(amount - advanceAmount, 0);

  const removeExistingPhoto = (photoId: string) => {
    setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId));
    deleteServicePhoto(photoId);
  };

  return (
    <div className="admin-glass rounded-[var(--radius-lg)] p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-fg">{service ? "Editar servicio" : "Registrar servicio técnico"}</h2>
        <button type="button" onClick={onDone} className="text-xs font-bold uppercase text-fg-muted hover:text-fg">
          Cancelar
        </button>
      </div>

      <form action={formAction} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Cliente</label>
          <input name="clientName" defaultValue={service?.clientName} required maxLength={150} placeholder="Ej. Rosa Huamán Quispe" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Teléfono del cliente</label>
          <input
            name="clientPhone"
            type="tel"
            inputMode="numeric"
            defaultValue={service?.clientPhone}
            required
            maxLength={9}
            placeholder="Ej. 987654321"
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 9);
            }}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Trabajo realizado</label>
          <input name="title" defaultValue={service?.title} required maxLength={150} placeholder="Ej. Formateo e instalación de Windows" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Tipo de equipo</label>
          <select name="equipmentTypeId" defaultValue={service?.equipmentTypeId ?? ""} required className={inputClass}>
            <option value="" disabled>
              Selecciona un tipo
            </option>
            {equipmentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Descripción del trabajo (opcional)</label>
          <AutoGrowInput
            name="description"
            defaultValue={service?.description}
            maxLength={2000}
            placeholder="Detalle del diagnóstico, repuestos usados, observaciones..."
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Fecha de recepción</label>
          <input
            name="serviceDate"
            type="date"
            defaultValue={service ? dateToInputValue(new Date(service.serviceDate)) : todayInputValue()}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Monto (S/.)</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={service?.amount}
            required
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Técnico responsable</label>
          <select name="technicianId" defaultValue={service?.technicianId ?? ""} required className={inputClass}>
            <option value="" disabled>
              Selecciona un técnico
            </option>
            {technicians
              .filter((t) => t.isActive || t.id === service?.technicianId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Forma de pago</label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PAYMENT_METHODS.map((m) => (
              <label
                key={m}
                className={`flex cursor-pointer items-center justify-center rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  paymentMethod === m ? "border-accent bg-accent/10 text-accent" : "border-border-strong text-fg-muted hover:border-accent/50"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m}
                  checked={paymentMethod === m}
                  onChange={() => setPaymentMethod(m)}
                  required
                  className="sr-only"
                />
                {PAYMENT_METHOD_LABELS[m]}
              </label>
            ))}
          </div>

          {isPartial && (
            <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl bg-bg-raised/60 p-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Monto del adelanto (S/.)</label>
                <input
                  name="advanceAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={service?.advanceAmount ?? undefined}
                  onChange={(e) => setAdvanceAmount(Number(e.target.value) || 0)}
                  className={inputClass}
                />
                {amount > 0 && <p className="mt-1 text-xs font-semibold text-fg-muted">Saldo restante: {formatSoles(saldo)}</p>}
              </div>
              <div>
                <label className={labelClass}>Forma de pago del adelanto</label>
                <div className="mt-1.5 flex gap-2">
                  {PAY_NOW_METHODS.map((m) => (
                    <label
                      key={m}
                      className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border-2 border-border-strong px-3 py-2 text-xs font-bold text-fg-muted transition-colors has-checked:border-accent has-checked:bg-accent/10 has-checked:text-accent"
                    >
                      <input
                        type="radio"
                        name="advancePaymentMethod"
                        value={m}
                        defaultChecked={service?.advancePaymentMethod === m}
                        className="sr-only"
                      />
                      {PAYMENT_METHOD_LABELS[m]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {existingPhotos.length > 0 && (
          <div className="sm:col-span-2">
            <label className={labelClass}>Fotos actuales</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {existingPhotos.map((photo) => (
                <div key={photo.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-bg">
                  <Image src={photo.path} alt="" fill sizes="64px" className="object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingPhoto(photo.id)}
                    aria-label="Eliminar foto"
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <ServicePhotosField onUploadingChange={setUploading} label={service ? "Agregar más fotos" : "Fotografías de evidencia"} />

        {state.error && <p className="sm:col-span-2 text-sm font-medium text-red-600">{state.error}</p>}

        <div className="sm:col-span-2 flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending || uploading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <ShieldCheck size={14} />
            {uploading ? "Subiendo fotos..." : isPending ? "Guardando..." : service ? "Guardar cambios" : "Guardar servicio"}
          </button>
        </div>
      </form>
    </div>
  );
}
