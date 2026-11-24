/**
 * Hora oficial del negocio: Perú (America/Lima, UTC-5 fijo, sin horario de verano).
 *
 * El VPS corre en UTC: usar `new Date().getDate()` etc. en el servidor da el día
 * de MAÑANA después de las 7:00 PM de Lima (y el último día del mes, el mes
 * siguiente). Estas funciones dan el mismo resultado en cualquier servidor o navegador.
 */
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;

export function limaParts(now: Date = new Date()) {
  const s = new Date(now.getTime() - LIMA_OFFSET_MS);
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth() + 1, // 1..12
    day: s.getUTCDate(),
    weekday: s.getUTCDay(), // 0 = domingo
    hours: s.getUTCHours(),
    minutes: s.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" de hoy en Lima. */
export function todayLima(now: Date = new Date()): string {
  const p = limaParts(now);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "YYYY-MM" del instante dado (por defecto ahora) en Lima. */
export function monthKeyLima(now: Date = new Date()): string {
  const p = limaParts(now);
  return `${p.year}-${pad(p.month)}`;
}

/** Instante real de las 00:00 de Lima de ese día (month 1..12; acepta desbordes, p. ej. month 13). */
export function limaMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) + LIMA_OFFSET_MS);
}
