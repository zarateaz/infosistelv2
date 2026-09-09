"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sanitizeName, sanitizePhone } from "@/lib/sanitize";
import { deleteServicePhotoFileIfManaged } from "./upload-actions";

const PATH = "/taller-control/servicios";
const PAYMENT_METHODS = ["Efectivo", "Yape", "Pendiente de pago"] as const;
const PAY_NOW_METHODS = ["Efectivo", "Yape"] as const;

function statusFor(paymentMethod: string): "PAGADO" | "PENDIENTE" {
  return paymentMethod === "Pendiente de pago" ? "PENDIENTE" : "PAGADO";
}

// ----------------------------- Técnicos ----------------------------- //

export interface AdminTechnician {
  id: string;
  name: string;
  phone: string | null;
  specialty: string | null;
  isActive: boolean;
  serviceCount: number;
}

export async function getTechnicians(activeOnly = false): Promise<AdminTechnician[]> {
  const technicians = await prisma.technician.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { services: true } } },
  });
  return technicians.map((t) => ({
    id: t.id,
    name: t.name,
    phone: t.phone,
    specialty: t.specialty,
    isActive: t.isActive,
    serviceCount: t._count.services,
  }));
}

export interface TechnicianFormState {
  error?: string;
}

const technicianSchema = z.object({
  name: z.string().trim().min(1, "El nombre del técnico es obligatorio.").max(100),
  phone: z.string().trim().max(20).optional(),
  specialty: z.string().trim().max(100).optional(),
});

export async function createTechnician(
  _prevState: TechnicianFormState,
  formData: FormData
): Promise<TechnicianFormState> {
  const parsed = technicianSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    specialty: formData.get("specialty") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  await prisma.technician.create({
    data: {
      name: sanitizeName(parsed.data.name, 100),
      phone: parsed.data.phone ? sanitizePhone(parsed.data.phone) : null,
      specialty: parsed.data.specialty ? sanitizeName(parsed.data.specialty, 100) : null,
    },
  });

  revalidatePath(PATH);
  return {};
}

export async function updateTechnician(
  id: string,
  data: { name: string; phone: string; specialty: string }
): Promise<void> {
  const name = sanitizeName(data.name, 100);
  if (!name) return;
  await prisma.technician.update({
    where: { id },
    data: {
      name,
      phone: data.phone ? sanitizePhone(data.phone) : null,
      specialty: data.specialty ? sanitizeName(data.specialty, 100) : null,
    },
  });
  revalidatePath(PATH);
}

export async function toggleTechnicianStatus(id: string): Promise<void> {
  const tech = await prisma.technician.findUnique({ where: { id }, select: { isActive: true } });
  if (!tech) return;
  await prisma.technician.update({ where: { id }, data: { isActive: !tech.isActive } });
  revalidatePath(PATH);
}

// ----------------------------- Estadísticas ----------------------------- //

export type StatsPeriod = "hoy" | "semana" | "mes" | "todo";

export interface ServiceStats {
  totalServices: number;
  activeTechnicians: number;
  paidCount: number;
  paidAmount: number;
  pendingCount: number;
  pendingAmount: number;
  periodCount: number;
  periodPaidAmount: number;
  periodPendingAmount: number;
}

function periodStart(period: StatsPeriod): Date | null {
  const now = new Date();
  if (period === "hoy") {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (period === "semana") {
    const day = (now.getDay() + 6) % 7; // lunes = 0
    now.setDate(now.getDate() - day);
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (period === "mes") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null;
}

export async function getServiceStats(period: StatsPeriod = "todo"): Promise<ServiceStats> {
  const from = periodStart(period);
  const periodWhere = from ? { serviceDate: { gte: from } } : {};

  const [totalServices, activeTechnicians, paidAgg, pendingAgg, periodCount, periodPaidAgg, periodPendingAgg] =
    await Promise.all([
      prisma.service.count(),
      prisma.technician.count({ where: { isActive: true } }),
      prisma.service.aggregate({ where: { paymentStatus: "PAGADO" }, _count: true, _sum: { amount: true } }),
      prisma.service.aggregate({ where: { paymentStatus: "PENDIENTE" }, _count: true, _sum: { amount: true } }),
      prisma.service.count({ where: periodWhere }),
      prisma.service.aggregate({
        where: { ...periodWhere, paymentStatus: "PAGADO" },
        _sum: { amount: true },
      }),
      prisma.service.aggregate({
        where: { ...periodWhere, paymentStatus: "PENDIENTE" },
        _sum: { amount: true },
      }),
    ]);

  return {
    totalServices,
    activeTechnicians,
    paidCount: paidAgg._count,
    paidAmount: paidAgg._sum.amount ?? 0,
    pendingCount: pendingAgg._count,
    pendingAmount: pendingAgg._sum.amount ?? 0,
    periodCount,
    periodPaidAmount: periodPaidAgg._sum.amount ?? 0,
    periodPendingAmount: periodPendingAgg._sum.amount ?? 0,
  };
}

// ----------------------------- Servicios ----------------------------- //

export interface AdminServicePhoto {
  id: string;
  path: string;
  originalName: string;
}

export interface AdminService {
  id: string;
  clientName: string;
  title: string;
  description: string;
  processes: string[];
  serviceDate: Date;
  amount: number;
  paymentMethod: string;
  paymentStatus: "PAGADO" | "PENDIENTE";
  technicianId: string;
  technicianName: string;
  photos: AdminServicePhoto[];
  createdAt: Date;
}

export interface ServiceFilters {
  q?: string;
  technicianId?: string;
  paymentStatus?: "PAGADO" | "PENDIENTE";
  period?: StatsPeriod;
}

export async function getAdminServices(filters: ServiceFilters = {}): Promise<AdminService[]> {
  const { q, technicianId, paymentStatus, period = "todo" } = filters;
  const from = periodStart(period);

  const services = await prisma.service.findMany({
    where: {
      ...(from ? { serviceDate: { gte: from } } : {}),
      ...(technicianId ? { technicianId } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(q?.trim()
        ? {
            OR: [
              { clientName: { contains: q.trim() } },
              { title: { contains: q.trim() } },
              { description: { contains: q.trim() } },
              { technician: { name: { contains: q.trim() } } },
              { processes: { some: { description: { contains: q.trim() } } } },
            ],
          }
        : {}),
    },
    include: {
      technician: true,
      photos: { orderBy: { uploadedAt: "asc" } },
      processes: { orderBy: { order: "asc" } },
    },
    orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
  });

  return services.map((s) => ({
    id: s.id,
    clientName: s.clientName,
    title: s.title,
    description: s.description,
    processes: s.processes.map((p) => p.description),
    serviceDate: s.serviceDate,
    amount: s.amount,
    paymentMethod: s.paymentMethod,
    paymentStatus: s.paymentStatus as "PAGADO" | "PENDIENTE",
    technicianId: s.technicianId,
    technicianName: s.technician.name,
    photos: s.photos.map((p) => ({ id: p.id, path: p.path, originalName: p.originalName })),
    createdAt: s.createdAt,
  }));
}

export interface ServiceFormState {
  error?: string;
}

const photoSchema = z.object({ path: z.string().min(1), originalName: z.string().max(255) });
const processSchema = z.string().trim().min(1).max(300);

const serviceSchema = z.object({
  clientName: z.string().trim().min(1, "El nombre del cliente es obligatorio.").max(150),
  title: z.string().trim().min(1, "El trabajo realizado es obligatorio.").max(150),
  description: z.string().trim().max(2000).optional(),
  processes: z
    .array(processSchema)
    .min(1, "Registra al menos un proceso realizado.")
    .max(30, "Demasiados procesos — máximo 30 por servicio."),
  serviceDate: z.string().trim().min(1, "La fecha del servicio es obligatoria."),
  amount: z.coerce.number().min(0, "El monto no puede ser negativo."),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: "Forma de pago inválida." }),
  technicianId: z.string().trim().min(1, "Selecciona un técnico."),
  photos: z.array(photoSchema).max(12).optional(),
});

function parsePhotosField(raw: FormDataEntryValue | null): { path: string; originalName: string }[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const decoded = JSON.parse(raw);
    if (!Array.isArray(decoded)) return [];
    return decoded.filter(
      (v): v is { path: string; originalName: string } =>
        v && typeof v.path === "string" && typeof v.originalName === "string"
    );
  } catch {
    return [];
  }
}

/** Same JSON-in-hidden-input convention as parsePhotosField — the client
 *  (ProcessesField) keeps a dynamic list of rows and serializes it on every
 *  change, since a plain <form> can't submit a variable-length list of
 *  same-named text inputs through a server action any other way. */
function parseProcessesField(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const decoded = JSON.parse(raw);
    if (!Array.isArray(decoded)) return [];
    return decoded.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export async function createService(
  _prevState: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const parsed = serviceSchema.safeParse({
    clientName: formData.get("clientName"),
    title: formData.get("title"),
    description: formData.get("description"),
    processes: parseProcessesField(formData.get("processes")),
    serviceDate: formData.get("serviceDate"),
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod"),
    technicianId: formData.get("technicianId"),
    photos: parsePhotosField(formData.get("photos")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const technician = await prisma.technician.findUnique({ where: { id: parsed.data.technicianId } });
  if (!technician) return { error: "El técnico seleccionado no existe." };

  await prisma.service.create({
    data: {
      clientName: sanitizeName(parsed.data.clientName, 150),
      title: sanitizeName(parsed.data.title, 150),
      description: parsed.data.description ?? "",
      serviceDate: new Date(parsed.data.serviceDate),
      amount: Math.round(parsed.data.amount * 100) / 100,
      paymentMethod: parsed.data.paymentMethod,
      paymentStatus: statusFor(parsed.data.paymentMethod),
      technicianId: parsed.data.technicianId,
      processes: {
        create: parsed.data.processes.map((description, order) => ({
          description: sanitizeName(description, 300),
          order,
        })),
      },
      photos: {
        create: (parsed.data.photos ?? []).map((p) => ({
          path: p.path,
          originalName: sanitizeName(p.originalName, 255) || p.originalName.slice(0, 255),
        })),
      },
    },
  });

  revalidatePath(PATH);
  return {};
}

export async function updateService(
  id: string,
  _prevState: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const parsed = serviceSchema.safeParse({
    clientName: formData.get("clientName"),
    title: formData.get("title"),
    description: formData.get("description"),
    processes: parseProcessesField(formData.get("processes")),
    serviceDate: formData.get("serviceDate"),
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod"),
    technicianId: formData.get("technicianId"),
    photos: parsePhotosField(formData.get("photos")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const technician = await prisma.technician.findUnique({ where: { id: parsed.data.technicianId } });
  if (!technician) return { error: "El técnico seleccionado no existe." };

  await prisma.service.update({
    where: { id },
    data: {
      clientName: sanitizeName(parsed.data.clientName, 150),
      title: sanitizeName(parsed.data.title, 150),
      description: parsed.data.description ?? "",
      serviceDate: new Date(parsed.data.serviceDate),
      amount: Math.round(parsed.data.amount * 100) / 100,
      paymentMethod: parsed.data.paymentMethod,
      paymentStatus: statusFor(parsed.data.paymentMethod),
      technicianId: parsed.data.technicianId,
      // The itemized process list is the edit's source of truth each time
      // (delete-and-recreate) — unlike photos, there's no separate
      // "remove one process" action, so the submitted list must fully
      // replace the previous one or a removed row would never disappear.
      processes: {
        deleteMany: {},
        create: parsed.data.processes.map((description, order) => ({
          description: sanitizeName(description, 300),
          order,
        })),
      },
      // Edits only ever ADD photos (matches the original tool's behavior) —
      // removing one is its own action (deleteServicePhoto) so a half-typed
      // edit can never silently drop evidence already on file.
      photos: {
        create: (parsed.data.photos ?? []).map((p) => ({
          path: p.path,
          originalName: sanitizeName(p.originalName, 255) || p.originalName.slice(0, 255),
        })),
      },
    },
  });

  revalidatePath(PATH);
  return {};
}

export async function markServiceAsPaid(id: string, method: (typeof PAY_NOW_METHODS)[number]): Promise<void> {
  if (!PAY_NOW_METHODS.includes(method)) return;
  await prisma.service.update({
    where: { id },
    data: { paymentMethod: method, paymentStatus: "PAGADO" },
  });
  revalidatePath(PATH);
}

export async function deleteService(id: string): Promise<void> {
  const photos = await prisma.servicePhoto.findMany({ where: { serviceId: id }, select: { path: true } });
  await prisma.service.delete({ where: { id } });
  await Promise.all(photos.map((p) => deleteServicePhotoFileIfManaged(p.path)));
  revalidatePath(PATH);
}

export async function deleteServicePhoto(photoId: string): Promise<void> {
  const photo = await prisma.servicePhoto.findUnique({ where: { id: photoId } });
  if (!photo) return;
  await prisma.servicePhoto.delete({ where: { id: photoId } });
  await deleteServicePhotoFileIfManaged(photo.path);
  revalidatePath(PATH);
}
