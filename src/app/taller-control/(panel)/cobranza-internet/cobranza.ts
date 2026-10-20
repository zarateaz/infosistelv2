/** Helpers puros de la cobranza de internet (sin "use server": se usan también en el cliente). */

export interface InternetClientRow {
  id: string;
  clientName: string;
  whatsapp: string;
  startDate: string; // YYYY-MM-DD
  nextPaymentDate: string; // YYYY-MM-DD
  amount: number;
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
  const msg =
    days < 0
      ? `Hola ${row.clientName}, te escribimos de Infosistel. Tu pago del servicio de internet${monto} venció hace ${-days} día(s). ¿Nos confirmas tu pago? Gracias.`
      : days === 0
        ? `Hola ${row.clientName}, te escribimos de Infosistel. Hoy vence tu pago del servicio de internet${monto}. Gracias.`
        : `Hola ${row.clientName}, te recordamos de Infosistel que tu pago del servicio de internet${monto} vence en ${days} día(s). Gracias.`;
  return `https://wa.me/${row.whatsapp}?text=${encodeURIComponent(msg)}`;
}
