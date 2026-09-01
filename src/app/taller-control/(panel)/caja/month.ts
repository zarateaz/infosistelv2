/** Plain util, deliberately outside actions.ts: that file is "use server",
 *  and every export from a "use server" file must be an async Server
 *  Action — a synchronous helper like this one isn't allowed to live
 *  there (Next.js build error: "Server Actions must be async functions"). */

/** "2026-09" for the given date, defaulting to now. */
export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
