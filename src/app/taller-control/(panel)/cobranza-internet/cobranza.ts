/** Helpers puros de la cobranza de internet (sin "use server": se usan también en el cliente). */

import type { PaymentMethodType } from "@/lib/paymentMethods";

export const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export const MONTH_SHORT_NAMES = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OCT",
  "NOV",
  "DIC",
] as const;

export const ROUTERS = [
  "Router 1",
  "Router 2",
  "Router 3",
  "Router 4",
  "Router 5",
  "Router 6",
] as const;

export type RouterType = (typeof ROUTERS)[number];

export const TOTAL_SWITCH_PORTS = 16;
export const SWITCH_PORTS = Array.from({ length: TOTAL_SWITCH_PORTS }, (_, i) => i + 1); // 1..16

export interface MonthPaymentRecord {
  status: "paid" | "unpaid";
  paidAt?: string; // YYYY-MM-DD
  amount?: number;
  method?: string; // "EFECTIVO" | "YAPE 1" | "YAPE 2" (o legacy "YAPE", "PLIN")
  note?: string;
  cashboxTransactionId?: string; // ID en CashboxTransaction para trazabilidad y reversión en Caja
  receiptNumber?: string; // 6 dígitos correlativo (ej: "000101")
}

/** Formatea una clave "YYYY-MM" a etiqueta humana legible, ej: "2026-05" -> "Mayo 2026" */
export function formatMonthKeyLabel(yearMonth: string): string {
  if (!yearMonth) return "";
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return yearMonth;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Normaliza cualquier variante de método de pago al estándar exacto de Caja */
export function normalizeInternetPaymentMethod(method?: string | null): PaymentMethodType {
  if (!method) return "YAPE 1";
  const up = method.trim().toUpperCase();
  if (up === "YAPE 2" || up === "YAPE2") return "YAPE 2";
  if (up === "EFECTIVO") return "EFECTIVO";
  return "YAPE 1";
}

export type PaidMonthsMap = Record<string, MonthPaymentRecord>; // Key: "YYYY-MM" (ej: "2026-01")

export interface InternetClientRow {
  id: string;
  clientCode?: string | null;
  clientName: string;
  whatsapp: string;
  galeria?: string | null;
  router?: string | null;
  portNumber?: number | null;
  startDate: string; // YYYY-MM-DD
  nextPaymentDate: string; // YYYY-MM-DD
  amount: number;
  concept: string | null;
  paidMonths?: string | null; // JSON string
  /** ISO de cuándo se registró en el sistema (para ordenar por orden de registro). */
  createdAt?: string;
  /** YYYY-MM-DD si el cliente se retiró (null/undefined = activo). */
  retiredAt?: string | null;
  retiredReason?: string | null;
  /** JSON ["YYYY-MM", ...]: meses que quedó debiendo al retirarse. */
  retiredDebtMonths?: string | null;
}

/** Motivos rápidos al retirar un cliente (además se puede escribir otro). */
export const RETIRE_REASONS = [
  "Se mudó / cerró su stand",
  "Cambió de proveedor",
  "Ya no necesita el servicio",
  "Retirado por falta de pago",
  "Problemas con la señal",
] as const;

export function isRetired(row: Pick<InternetClientRow, "retiredAt">): boolean {
  return Boolean(row.retiredAt);
}

/** Meses que el cliente quedó debiendo al retirarse (lista guardada, ordenada y sin repetidos). */
export function parseRetiredDebtMonths(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const keys = parsed.filter((k): k is string => typeof k === "string" && /^\d{4}-\d{2}$/.test(k));
    return Array.from(new Set(keys)).sort();
  } catch {
    return [];
  }
}

export interface RetiredDebtInfo {
  /** Meses de la deuda que siguen sin pagar. */
  pendingMonths: string[];
  /** Meses de la deuda que ya pagó después de retirarse. */
  paidMonths: string[];
  /** Total pendiente en soles. */
  pendingTotal: number;
}

/**
 * Deuda viva de un cliente retirado: de los meses que quedó debiendo, los que aún no paga.
 * Los pagos se registran en el mismo historial (paidMonths), así que pagar un mes lo
 * saca de la deuda automáticamente y entra a Caja como cualquier cobro de internet.
 */
export function retiredDebtInfo(row: InternetClientRow): RetiredDebtInfo {
  const owed = parseRetiredDebtMonths(row.retiredDebtMonths);
  if (owed.length === 0) return { pendingMonths: [], paidMonths: [], pendingTotal: 0 };
  const { map } = normalizeClientPayments(row);
  const pendingMonths = owed.filter((k) => map[k]?.status !== "paid");
  const paidMonths = owed.filter((k) => map[k]?.status === "paid");
  const pendingTotal = Math.round(pendingMonths.length * (row.amount || 0) * 100) / 100;
  return { pendingMonths, paidMonths, pendingTotal };
}

/** Mensaje de WhatsApp para cobrar la deuda pendiente de un cliente que ya se retiró. */
export function retiredDebtWhatsappLink(row: InternetClientRow, info: RetiredDebtInfo): string {
  const clean = row.whatsapp.replace(/\D/g, "");
  const number = clean.length === 9 ? `51${clean}` : clean;
  const meses = info.pendingMonths.map(formatMonthKeyLabel).join(", ");
  const msg =
    `Hola ${row.clientName}, te saludamos de Infosistel Internet. ` +
    `Según nuestro registro quedó pendiente el pago de ${info.pendingMonths.length} mes(es) del servicio ` +
    `(${meses}) por un total de S/. ${info.pendingTotal.toFixed(2)}. ` +
    `¿Nos ayudas a regularizarlo por Yape o en tienda? Muchas gracias.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
}

/** Días hasta la fecha de pago, contando calendario (negativo = vencido). */
export function daysUntil(dateStr: string, today: Date = new Date()): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - now) / 86_400_000);
}

export type CobranzaState = "vencido" | "hoy" | "pronto" | "ok";
/** Con cuántos días de anticipación se avisa en rojo. */
export const WARN_DAYS = 3;

export function cobranzaState(days: number): CobranzaState {
  if (days < 0) return "vencido";
  if (days === 0) return "hoy";
  if (days <= WARN_DAYS) return "pronto";
  return "ok";
}

export function whatsappLink(row: InternetClientRow, days: number): string {
  const monto = row.amount > 0 ? ` por S/. ${row.amount.toFixed(2)}` : "";
  const infoExtra = [
    row.galeria ? `Galería: ${row.galeria}` : null,
    row.router && row.portNumber ? `${row.router} - Pto ${row.portNumber}` : null,
    row.clientCode ? `Cód: ${row.clientCode}` : null,
  ].filter(Boolean).join(" · ");

  const conexionTxt = infoExtra ? ` (${infoExtra})` : "";

  const msg =
    days < 0
      ? `Hola ${row.clientName}, te escribimos de Infosistel Internet${conexionTxt}. Tu pago mensual del servicio${monto} venció hace ${-days} día(s). ¿Nos confirmas tu pago? Muchas gracias.`
      : days === 0
        ? `Hola ${row.clientName}, te escribimos de Infosistel Internet${conexionTxt}. Hoy vence tu pago mensual del servicio${monto}. Muchas gracias.`
        : `Hola ${row.clientName}, te recordamos de Infosistel Internet${conexionTxt} que tu pago mensual del servicio${monto} vence en ${days} día(s). Muchas gracias.`;
  return `https://wa.me/${row.whatsapp}?text=${encodeURIComponent(msg)}`;
}

export function directWhatsappLink(whatsapp: string, clientName?: string): string {
  const clean = whatsapp.replace(/\D/g, "");
  const number = clean.length === 9 ? `51${clean}` : clean;
  const msg = clientName
    ? `Hola ${clientName}, te saludamos de Infosistel Internet.`
    : `Hola, te saludamos del soporte de Infosistel Internet.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
}

/**
 * Parsea el mapa de meses pagados o deriva el historial de pagos para clientes
 * existentes basándose en startDate y nextPaymentDate.
 */
export function parsePaidMonths(
  raw?: string | null,
  startDate?: string,
  nextPaymentDate?: string,
  defaultAmount: number = 0
): PaidMonthsMap {
  const result: PaidMonthsMap = {};

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as PaidMonthsMap;
      }
    } catch {
      // fallback a derivación
    }
  }

  // Derivación automática para clientes preexistentes
  if (startDate && nextPaymentDate) {
    const [sy, sm] = startDate.split("-").map(Number);
    const [ny, nm] = nextPaymentDate.split("-").map(Number);

    let cy = sy;
    let cm = sm;
    const endKey = `${ny}-${String(nm).padStart(2, "0")}`;

    while (true) {
      const key = `${cy}-${String(cm).padStart(2, "0")}`;
      if (key >= endKey) break;
      result[key] = {
        status: "paid",
        paidAt: `${cy}-${String(cm).padStart(2, "0")}-01`,
        amount: defaultAmount,
        note: "Registrado al inicio",
      };
      cm++;
      if (cm > 12) {
        cm = 1;
        cy++;
      }
      if (cy > ny + 2) break;
    }
  }

  return result;
}

/**
 * Calcula la próxima fecha de pago buscando el primer mes pendiente (unpaid).
 * Conserva el día original de corte de nextPaymentDate / startDate.
 */
export function calculateNextPaymentDate(
  startDate: string,
  currentNextPaymentDate: string,
  paidMonths: PaidMonthsMap
): string {
  const [, , origDay] = currentNextPaymentDate.split("-").map(Number);
  const [sy, sm] = startDate.split("-").map(Number);

  let cy = sy;
  let cm = sm;
  const maxYear = new Date().getFullYear() + 4;

  while (cy <= maxYear) {
    const key = `${cy}-${String(cm).padStart(2, "0")}`;
    const rec = paidMonths[key];
    if (!rec || rec.status !== "paid") {
      const lastDayOfMonth = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
      const day = Math.min(origDay || 1, lastDayOfMonth);
      return `${cy}-${String(cm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    cm++;
    if (cm > 12) {
      cm = 1;
      cy++;
    }
  }

  const lastDay = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
  return `${cy}-${String(cm).padStart(2, "0")}-${String(Math.min(origDay || 1, lastDay)).padStart(2, "0")}`;
}

export interface ClientPaymentSource {
  startDate: string;
  nextPaymentDate: string;
  paidMonths?: string | null;
  amount?: number;
}

/**
 * Estado de pagos NORMALIZADO de un cliente (única fuente de verdad):
 *  - `map`: meses marcados; si la fecha guardada quedó ADELANTE de los meses marcados
 *    (se fijó a mano al editar), los meses intermedios cuentan como pagados
 *    ("Registrado al inicio"), igual que al crear el cliente.
 *  - `nextPaymentDate`: primer mes impago desde el inicio, con el día de corte original.
 * Así la lista, el panel, la vista mes a mes y los avisos de WhatsApp nunca se contradicen.
 */
export function normalizeClientPayments(row: ClientPaymentSource): {
  map: PaidMonthsMap;
  nextPaymentDate: string;
} {
  const amount = row.amount ?? 0;
  const map: PaidMonthsMap = { ...parsePaidMonths(row.paidMonths, row.startDate, row.nextPaymentDate, amount) };
  if (!row.startDate || !row.nextPaymentDate) return { map, nextPaymentDate: row.nextPaymentDate };

  let next = calculateNextPaymentDate(row.startDate, row.nextPaymentDate, map);
  const storedKey = row.nextPaymentDate.slice(0, 7);
  if (next.slice(0, 7) < storedKey) {
    let [cy, cm] = next.split("-").map(Number);
    for (let guard = 0; guard < 600; guard++) {
      const key = `${cy}-${String(cm).padStart(2, "0")}`;
      if (key >= storedKey) break;
      if (map[key]?.status !== "paid") {
        map[key] = { status: "paid", paidAt: `${key}-01`, amount, note: "Registrado al inicio" };
      }
      cm++;
      if (cm > 12) {
        cm = 1;
        cy++;
      }
    }
    next = calculateNextPaymentDate(row.startDate, row.nextPaymentDate, map);
  }
  return { map, nextPaymentDate: next };
}

/** Próxima fecha de pago real (ver normalizeClientPayments). */
export function effectiveNextPaymentDate(row: ClientPaymentSource): string {
  return normalizeClientPayments(row).nextPaymentDate;
}

/**
 * Meses impagos desde el inicio del cliente hasta el mes `today` inclusive
 * (incluye años anteriores: es la deuda real completa).
 */
export function getUnpaidMonthKeys(
  paidMonths: PaidMonthsMap,
  startDate: string,
  today: Date = new Date()
): string[] {
  const [sy, sm] = startDate.split("-").map(Number);
  if (!sy || !sm) return [];
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const out: string[] = [];
  let cy = sy;
  let cm = sm;
  for (let guard = 0; guard < 600; guard++) {
    const key = `${cy}-${String(cm).padStart(2, "0")}`;
    if (key > currentKey) break;
    if (paidMonths[key]?.status !== "paid") out.push(key);
    cm++;
    if (cm > 12) {
      cm = 1;
      cy++;
    }
  }
  return out;
}

export interface MonthUIInfo {
  monthIndex: number; // 0..11
  monthNum: number; // 1..12
  monthName: string;
  monthShort: string;
  key: string; // "YYYY-MM"
  isBeforeStart: boolean;
  isPaid: boolean;
  paidAt?: string;
  amount?: number;
  method?: string;
  note?: string;
  receiptNumber?: string;
  cashboxTransactionId?: string;
  isOverdue: boolean;
  isDueThisMonth: boolean;
  isAdvance: boolean;
  isFuture: boolean;
  badgeText: string;
  badgeStyle: "paid" | "advance" | "overdue" | "due" | "future" | "before_start";
}

/**
 * Obtiene la información para pintar los meses de un año dado, respetando
 * la fecha de inicio del cliente (`startDate`) para no mostrar meses
 * anteriores a su primer mes de servicio.
 */
export function getYearMonthsInfo(
  year: number,
  paidMonths: PaidMonthsMap,
  today: Date = new Date(),
  clientAmount: number = 0,
  startDate?: string
): {
  months: MonthUIInfo[];
  paidCount: number;
  advanceCount: number;
  overdueCount: number;
  totalCollected: number;
} {
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const startMonthKey = startDate && startDate.length >= 7 ? startDate.slice(0, 7) : null;
  let paidCount = 0;
  let advanceCount = 0;
  let overdueCount = 0;
  let totalCollected = 0;

  const months: MonthUIInfo[] = MONTH_NAMES.map((name, idx) => {
    const monthNum = idx + 1;
    const key = `${year}-${String(monthNum).padStart(2, "0")}`;
    const isBeforeStart = Boolean(startMonthKey && key < startMonthKey);
    const rec = isBeforeStart ? undefined : paidMonths[key];
    const isPaid = !isBeforeStart && rec?.status === "paid";

    const isAdvance = isPaid && key > currentKey;
    const isOverdue = !isBeforeStart && !isPaid && key < currentKey;
    const isDueThisMonth = !isBeforeStart && !isPaid && key === currentKey;
    const isFuture = !isBeforeStart && !isPaid && key > currentKey;

    if (isPaid) {
      paidCount++;
      totalCollected += rec?.amount ?? clientAmount;
      if (isAdvance) advanceCount++;
    } else if (isOverdue) {
      overdueCount++;
    }

    let badgeText = "Pendiente";
    let badgeStyle: MonthUIInfo["badgeStyle"] = "future";

    if (isBeforeStart) {
      badgeText = "Sin servicio";
      badgeStyle = "before_start";
    } else if (isAdvance) {
      badgeText = "Adelantado";
      badgeStyle = "advance";
    } else if (isPaid) {
      badgeText = "Pagado";
      badgeStyle = "paid";
    } else if (isOverdue) {
      badgeText = "Vencido";
      badgeStyle = "overdue";
    } else if (isDueThisMonth) {
      badgeText = "Por pagar";
      badgeStyle = "due";
    }

    return {
      monthIndex: idx,
      monthNum,
      monthName: name,
      monthShort: MONTH_SHORT_NAMES[idx],
      key,
      isBeforeStart,
      isPaid,
      paidAt: rec?.paidAt,
      amount: rec?.amount ?? clientAmount,
      method: rec?.method,
      note: rec?.note,
      receiptNumber: rec?.receiptNumber,
      cashboxTransactionId: rec?.cashboxTransactionId,
      isOverdue,
      isDueThisMonth,
      isAdvance,
      isFuture,
      badgeText,
      badgeStyle,
    };
  });

  return {
    months,
    paidCount,
    advanceCount,
    overdueCount,
    totalCollected,
  };
}

/**
 * Deriva un número de recibo de 6 dígitos consistente.
 * Si ya tiene receiptNumber registrado, lo normaliza a 6 dígitos.
 * Si no, genera un correlativo determinista de 6 dígitos basado en el cliente y mes
 * para que ningún comprobante quede vacío ante reclamos de clientes.
 */
export function deriveReceiptNumber(
  existingReceipt?: string | null,
  clientCode?: string | null,
  clientId?: string,
  yearMonth?: string
): string {
  if (existingReceipt && existingReceipt.trim()) {
    const clean = existingReceipt.replace(/\D/g, "");
    if (clean.length > 0) return clean.slice(-6).padStart(6, "0");
    return existingReceipt.trim().slice(0, 10);
  }
  const seed = `${clientCode || clientId || "CLI"}-${yearMonth || "2026-01"}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const positive = (Math.abs(hash) % 900000) + 100000;
  return String(positive);
}

/**
 * Genera el enlace de WhatsApp con el recibo preformateado listo para enviar al cliente.
 */
export function internetReceiptWhatsappLink(params: {
  whatsapp: string;
  clientName: string;
  clientCode?: string | null;
  receiptNumber: string;
  periodLabel: string;
  amount: number;
  paidAt: string;
  method?: string;
  galeria?: string | null;
}): string {
  const clean = params.whatsapp.replace(/\D/g, "");
  const number = clean.length === 9 ? `51${clean}` : clean;
  const codeTxt = params.clientCode ? ` (${params.clientCode})` : "";
  const galTxt = params.galeria ? `\n📍 *Ubicación:* ${params.galeria}` : "";
  const methodTxt = params.method || "EFECTIVO";

  const msg =
    `🧾 *RECIBO DE PAGO — INFOSISTEL INTERNET*\n\n` +
    `*N° de Recibo:* #${params.receiptNumber}\n` +
    `*Cliente:* ${params.clientName}${codeTxt}${galTxt}\n` +
    `*Período Pagado:* ${params.periodLabel}\n` +
    `*Fecha de Pago:* ${params.paidAt}\n` +
    `*Medio de Pago:* ${methodTxt}\n` +
    `*Monto Cancelado:* S/. ${params.amount.toFixed(2)}\n` +
    `*Estado:* PAGADO CONFORME ✅\n\n` +
    `Muchas gracias por su puntualidad y preferencia.\n` +
    `*INFOSISTEL* · Soporte y Conectividad`;

  return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
}

export interface InternetHistoryItem {
  id: string; // client.id + "_" + yearMonth
  clientId: string;
  clientCode?: string | null;
  clientName: string;
  whatsapp: string;
  galeria?: string | null;
  router?: string | null;
  portNumber?: number | null;
  startDate: string; // YYYY-MM-DD
  yearMonth: string; // YYYY-MM
  periodLabel: string; // "Mayo 2026"
  dueDate: string; // YYYY-MM-DD
  paidAt?: string; // YYYY-MM-DD
  amount: number;
  method?: string; // "EFECTIVO" | "YAPE 1" | "YAPE 2"
  status: "PAGADO" | "VENCIDO" | "PENDIENTE";
  receiptNumber: string; // 6 dígitos ej: "000101"
  note?: string;
  cashboxTransactionId?: string;
  daysOverdue?: number;
}

/**
 * Aplana y construye el historial mes a mes de todos los clientes de internet.
 * Permite auditar pagos atrasados de 2 a 3 meses con comprobante de 6 dígitos.
 */
export function buildInternetPaymentHistory(
  clients: InternetClientRow[],
  today: Date = new Date()
): InternetHistoryItem[] {
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  const history: InternetHistoryItem[] = [];

  for (const client of clients) {
    const { map } = normalizeClientPayments(client);
    // Retirados: no generan meses nuevos después de irse, y solo cuentan como deuda
    // los meses que quedaron debiendo (los demás impagos se perdonaron al retirarlo).
    const retiredKey = client.retiredAt ? client.retiredAt.slice(0, 7) : null;
    const retiredOwed = retiredKey ? new Set(parseRetiredDebtMonths(client.retiredDebtMonths)) : null;

    // Obtener día de corte del cliente
    const nextPayParts = client.nextPaymentDate ? client.nextPaymentDate.split("-").map(Number) : [];
    const startParts = client.startDate ? client.startDate.split("-").map(Number) : [];
    const billingDay = nextPayParts[2] || startParts[2] || 1;

    // Determinar el rango de meses del cliente
    const sy = startParts[0] || currentYear;
    const sm = startParts[1] || 1;
    const startKey = `${sy}-${String(sm).padStart(2, "0")}`;

    // Buscar el mes más alto entre los pagados y el mes actual + 2 meses adelante
    let maxYear = Math.max(currentYear, sy);
    let maxMonth = Math.max(currentMonth, 1);
    for (const k of Object.keys(map)) {
      if (k.length === 7) {
        const [ky, km] = k.split("-").map(Number);
        if (ky > maxYear || (ky === maxYear && km > maxMonth)) {
          maxYear = ky;
          maxMonth = km;
        }
      }
    }

    let cy = sy;
    let cm = sm;

    while (cy < maxYear || (cy === maxYear && cm <= maxMonth)) {
      const yearMonth = `${cy}-${String(cm).padStart(2, "0")}`;
      const rec = map[yearMonth];
      const isPaid = rec?.status === "paid";
      const skipRetired =
        retiredKey !== null && !isPaid && (yearMonth > retiredKey || !retiredOwed!.has(yearMonth));
      if (yearMonth >= startKey && !skipRetired) {

        const lastDayOfMonth = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
        const dueDayClamped = Math.min(billingDay, lastDayOfMonth);
        const dueDate = `${cy}-${String(cm).padStart(2, "0")}-${String(dueDayClamped).padStart(2, "0")}`;

        const periodLabel = formatMonthKeyLabel(yearMonth);
        const receiptNumber = deriveReceiptNumber(
          rec?.receiptNumber,
          client.clientCode,
          client.id,
          yearMonth
        );

        let status: InternetHistoryItem["status"] = "PENDIENTE";
        let daysOverdue = 0;

        if (isPaid) {
          status = "PAGADO";
        } else if (yearMonth < currentKey) {
          status = "VENCIDO";
          daysOverdue = Math.max(0, -daysUntil(dueDate, today));
        } else {
          status = "PENDIENTE";
        }

        history.push({
          id: `${client.id}_${yearMonth}`,
          clientId: client.id,
          clientCode: client.clientCode,
          clientName: client.clientName,
          whatsapp: client.whatsapp,
          galeria: client.galeria,
          router: client.router,
          portNumber: client.portNumber,
          startDate: client.startDate,
          yearMonth,
          periodLabel,
          dueDate,
          paidAt: isPaid ? rec?.paidAt || dueDate : undefined,
          amount: isPaid ? (rec?.amount ?? client.amount) : client.amount,
          method: isPaid ? rec?.method || "YAPE 1" : undefined,
          status,
          receiptNumber,
          note: rec?.note,
          cashboxTransactionId: rec?.cashboxTransactionId,
          daysOverdue,
        });
      }

      cm++;
      if (cm > 12) {
        cm = 1;
        cy++;
      }
    }
  }

  // Ordenar por fecha de vencimiento descendente (lo más reciente arriba)
  return history.sort((a, b) => b.dueDate.localeCompare(a.dueDate) || a.clientName.localeCompare(b.clientName));
}
