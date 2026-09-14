/** Plain util, deliberately outside actions.ts: that file is "use server",
 *  and every export from a "use server" file must be an async Server
 *  Action — a synchronous helper like this one isn't allowed to live
 *  there (Next.js build error: "Server Actions must be async functions"). */

/** "2026-09" for the given date, defaulting to now. */
export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09-05" for the given date, defaulting to now — matches the value
 *  an <input type="date"> produces, so it round-trips through parseDateInput. */
export function toDateInputValue(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Parses an <input type="date"> value ("YYYY-MM-DD") into a local midnight
 *  Date. Deliberately avoids `new Date(str)`, which reads the string as UTC
 *  and can land on the wrong calendar day depending on the server's timezone. */
export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}
