"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { Camera, Pencil, Trash2, X } from "lucide-react";
import {
  deleteService,
  deleteServicePhoto,
  markServiceAsPaid,
  updateService,
  type AdminService,
  type AdminTechnician,
  type ServiceFormState,
} from "./actions";
import { ServicePhotosField } from "./ServicePhotosField";
import { ProcessesField } from "./ProcessesField";
import { ConfirmDialog } from "../ConfirmDialog";

const initialState: ServiceFormState = {};
const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";
const inputClass = "admin-field mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm text-fg";

function toDateInputValue(date: Date): string {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function ServiceRow({ service, technicians }: { service: AdminService; technicians: AdminTechnician[] }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const remove = () => {
    startTransition(async () => {
      await deleteService(service.id);
      setConfirmingDelete(false);
    });
  };

  const payNow = (method: "Efectivo" | "Yape") => {
    startTransition(() => markServiceAsPaid(service.id, method));
  };

  const removePhoto = (photoId: string) => {
    startTransition(() => deleteServicePhoto(photoId));
  };

  if (editing) {
    return (
      <EditServiceForm
        service={service}
        technicians={technicians}
        onDone={() => setEditing(false)}
        onRemovePhoto={removePhoto}
      />
    );
  }

  const paid = service.paymentStatus === "PAGADO";

  return (
    <div className="admin-glass rounded-[var(--radius-lg)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-fg">{service.title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                paid ? "bg-accent/10 text-accent" : "bg-red-50 text-red-600"
              }`}
            >
              {paid ? `Pagado · ${service.paymentMethod}` : "Pendiente de pago"}
            </span>
          </div>
          <p className="text-sm text-fg-muted">
            {service.clientName} · Técnico: {service.technicianName}
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            {new Date(service.serviceDate).toLocaleDateString("es-PE", { dateStyle: "medium" })}
          </p>
          {service.processes.length > 0 && (
            <ul className="mt-2 max-w-xl space-y-1">
              {service.processes.map((process, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-fg-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  {process}
                </li>
              ))}
            </ul>
          )}
          {service.description && <p className="mt-2 max-w-xl text-sm italic text-fg-muted">{service.description}</p>}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="text-lg font-bold text-accent">S/. {service.amount.toFixed(2)}</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Editar servicio ${service.title}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-raised hover:text-accent"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={isPending}
              aria-label={`Eliminar servicio ${service.title}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {confirmingDelete && (
          <ConfirmDialog
            title="Eliminar servicio"
            message={`¿Eliminar el servicio "${service.title}" de ${service.clientName}? Esta acción no se puede deshacer.`}
            danger
            pending={isPending}
            onConfirm={remove}
            onCancel={() => setConfirmingDelete(false)}
          />
        )}
      </div>

      {!paid && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="text-xs font-bold uppercase tracking-wide text-fg-muted">Marcar como pagado:</span>
          <button
            type="button"
            onClick={() => payNow("Efectivo")}
            disabled={isPending}
            className="rounded-lg border border-border-strong px-3 py-1.5 text-xs font-bold text-fg transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Efectivo
          </button>
          <button
            type="button"
            onClick={() => payNow("Yape")}
            disabled={isPending}
            className="rounded-lg border border-border-strong px-3 py-1.5 text-xs font-bold text-fg transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Yape
          </button>
        </div>
      )}

      {service.photos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          {service.photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightbox(photo.path)}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-bg"
              aria-label="Ver foto en tamaño grande"
            >
              <Image src={photo.path} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-fg/70 p-6 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Cerrar"
            className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X size={18} />
          </button>
          <div className="relative h-full max-h-[85vh] w-full max-w-3xl">
            <Image src={lightbox} alt="" fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

function EditServiceForm({
  service,
  technicians,
  onDone,
  onRemovePhoto,
}: {
  service: AdminService;
  technicians: AdminTechnician[];
  onDone: () => void;
  onRemovePhoto: (photoId: string) => void;
}) {
  const boundAction = updateService.bind(null, service.id);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!state.error && !isPending) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isPending]);

  return (
    <div className="admin-glass rounded-[var(--radius-lg)] p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-fg">Editar servicio</h3>
        <button type="button" onClick={onDone} className="text-xs font-bold uppercase text-fg-muted hover:text-fg">
          Cancelar
        </button>
      </div>

      <form action={formAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Cliente</label>
          <input name="clientName" defaultValue={service.clientName} required maxLength={150} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Técnico asignado</label>
          <select name="technicianId" defaultValue={service.technicianId} required className={inputClass}>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Trabajo realizado</label>
          <input name="title" defaultValue={service.title} required maxLength={150} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Fecha del servicio</label>
          <input
            name="serviceDate"
            type="date"
            defaultValue={toDateInputValue(service.serviceDate)}
            required
            className={inputClass}
          />
        </div>

        <ProcessesField defaultProcesses={service.processes} />

        <div className="sm:col-span-2">
          <label className={labelClass}>Notas generales (opcional)</label>
          <textarea name="description" defaultValue={service.description} rows={2} maxLength={2000} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Monto (S/.)</label>
          <input name="amount" type="number" step="0.01" min="0" defaultValue={service.amount} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Forma de pago</label>
          <select name="paymentMethod" defaultValue={service.paymentMethod} required className={inputClass}>
            <option value="Efectivo">Efectivo</option>
            <option value="Yape">Yape</option>
            <option value="Pendiente de pago">Pendiente de pago</option>
          </select>
        </div>

        {service.photos.length > 0 && (
          <div className="sm:col-span-2">
            <label className={labelClass}>Fotos actuales</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {service.photos.map((photo) => (
                <div key={photo.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-bg">
                  <Image src={photo.path} alt="" fill sizes="64px" className="object-cover" />
                  <button
                    type="button"
                    onClick={() => onRemovePhoto(photo.id)}
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

        <ServicePhotosField onUploadingChange={setUploading} label="Agregar más fotos" />

        {state.error && <p className="sm:col-span-2 text-sm font-medium text-red-600">{state.error}</p>}

        <div className="sm:col-span-2 flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending || uploading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Camera size={14} />
            {uploading ? "Subiendo fotos..." : isPending ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
