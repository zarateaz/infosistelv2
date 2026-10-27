import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { env } from "../src/lib/env";

const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function excelSerialToDateStr(serial: number): string {
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000).toISOString().slice(0, 10);
}

function parseDateStr(str: string): string {
  if (!str) return "2026-01-28";
  if (/^\d{5}$/.test(str)) {
    return excelSerialToDateStr(parseInt(str));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    const y = m[3] ? (m[3].length === 2 ? "20" + m[3] : m[3]) : "2026";
    return `${y}-${mo}-${d}`;
  }
  return "2026-01-28";
}

interface PaymentSeed {
  period: string; // YYYY-MM
  debtName: string;
  amount: number;
  dateStr: string;
  method?: string;
  note?: string;
}

const HISTORICAL_PAYMENTS: PaymentSeed[] = [
  // ── ENERO 2026 ───────────────────────────────────────────────────────────
  { period: "2026-01", debtName: "Alquiler S-25 (Sra. Julia)", amount: 150, dateStr: "2026-01-03", method: "YAPE 1", note: "se pago a Julia 3/1" },
  { period: "2026-01", debtName: "EsSalud", amount: 112, dateStr: "2026-01-08", method: "TRANSFERENCIA", note: "Se pago el 8/01" },
  { period: "2026-01", debtName: "AFP", amount: 123.05, dateStr: "2026-01-09", method: "TRANSFERENCIA", note: "se pago el 9/01" },
  { period: "2026-01", debtName: "Alquiler S-25 (Eduardo)", amount: 150, dateStr: "2026-01-09", method: "YAPE 1", note: "se pago a Eduardo 9/01" },
  { period: "2026-01", debtName: "Alquiler S-25 (Lenin)", amount: 150, dateStr: "2026-01-10", method: "YAPE 1", note: "se pago a Lenin 10/01" },
  { period: "2026-01", debtName: "SUNAT (NPS / IGV / Renta)", amount: 413, dateStr: "2026-01-16", method: "TRANSFERENCIA", note: "se pago 16/1. s/413" },
  { period: "2026-01", debtName: "Alquiler B-10 (Sr. Montes)", amount: 600, dateStr: "2026-01-16", method: "TRANSFERENCIA", note: "se pago a montes 16/01" },
  { period: "2026-01", debtName: "Honorarios Contador (Henrri Garcia)", amount: 150, dateStr: "2026-01-24", method: "TRANSFERENCIA", note: "se pago 24/01" },
  { period: "2026-01", debtName: "Cable Red — 7030505", amount: 100, dateStr: "2026-01-28", method: "TRANSFERENCIA", note: "se pago 28/01" },
  { period: "2026-01", debtName: "Internet Claro S25 (Piso 3)", amount: 75, dateStr: "2026-01-28", method: "TRANSFERENCIA", note: "se pago 28/01" },
  { period: "2026-01", debtName: "Internet Claro B10 (Piso 1)", amount: 75, dateStr: "2026-01-28", method: "TRANSFERENCIA", note: "se pago 28/01" },
  { period: "2026-01", debtName: "WIN Internet", amount: 69, dateStr: "2026-01-28", method: "TRANSFERENCIA", note: "se pago 28/01" },
  { period: "2026-01", debtName: "Luz — Casa Irma", amount: 94.4, dateStr: "2026-01-29", method: "TRANSFERENCIA", note: "SE PAGO" },
  { period: "2026-01", debtName: "Luz — Stand E-10", amount: 55.7, dateStr: "2026-01-29", method: "TRANSFERENCIA", note: "SE PAGO" },
  { period: "2026-01", debtName: "Claro Postpago B10", amount: 34.95, dateStr: "2026-01-29", method: "TRANSFERENCIA", note: "se pago 29/01" },
  { period: "2026-01", debtName: "Claro Postpago Irma", amount: 39.9, dateStr: "2026-01-29", method: "TRANSFERENCIA", note: "se pago 29/01" },
  { period: "2026-01", debtName: "FOP Internet", amount: 90, dateStr: "2026-01-30", method: "YAPE 1", note: "se pago el 30/01" },
  { period: "2026-01", debtName: "Internet Claro D17 (Piso 2)", amount: 55, dateStr: "2026-01-31", method: "TRANSFERENCIA", note: "se pago 31/01" },
  { period: "2026-01", debtName: "Internet Movistar / Infosistel", amount: 102.9, dateStr: "2026-01-31", method: "TRANSFERENCIA", note: "se pago el 31/01" },
  { period: "2026-01", debtName: "Servicios CNG (S-25)", amount: 36, dateStr: "2026-02-17", method: "YAPE 1", note: "se pago 17/02" },
  { period: "2026-01", debtName: "Servicios CNG (E-10)", amount: 36, dateStr: "2026-02-17", method: "YAPE 1", note: "se pago 17/02" },

  // ── FEBRERO 2026 ──────────────────────────────────────────────────────────
  { period: "2026-02", debtName: "Alquiler S-25 (Sra. Julia)", amount: 150, dateStr: "2026-02-01", method: "YAPE 1", note: "se pago a Julia 1/2" },
  { period: "2026-02", debtName: "Alquiler S-25 (Eduardo)", amount: 150, dateStr: "2026-02-03", method: "YAPE 1", note: "se pago a Eduardo 3/2" },
  { period: "2026-02", debtName: "Alquiler S-25 (Lenin)", amount: 150, dateStr: "2026-02-03", method: "YAPE 1", note: "se pago a Lenin 3/2" },
  { period: "2026-02", debtName: "Luz — Stand E-10", amount: 55.7, dateStr: "2026-02-03", method: "TRANSFERENCIA", note: "se pago 3/2" },
  { period: "2026-02", debtName: "Entel Postpago Infosistel", amount: 98.8, dateStr: "2026-02-03", method: "TRANSFERENCIA", note: "se pago 3/2" },
  { period: "2026-02", debtName: "AFP", amount: 141.47, dateStr: "2026-02-10", method: "TRANSFERENCIA", note: "se pago 10/02 - S/141.47" },
  { period: "2026-02", debtName: "EsSalud", amount: 112, dateStr: "2026-02-10", method: "TRANSFERENCIA", note: "se pago 10/02 - s/112" },
  { period: "2026-02", debtName: "SUNAT (NPS / IGV / Renta)", amount: 413, dateStr: "2026-02-13", method: "TRANSFERENCIA", note: "se pago 13/02" },
  { period: "2026-02", debtName: "Luz — Casa Irma", amount: 94.4, dateStr: "2026-02-13", method: "TRANSFERENCIA", note: "se pago 13/02" },
  { period: "2026-02", debtName: "Luz — Stand B-10", amount: 117.2, dateStr: "2026-02-13", method: "TRANSFERENCIA", note: "se pago 13/02" },
  { period: "2026-02", debtName: "Internet Claro S25 (Piso 3)", amount: 75, dateStr: "2026-02-20", method: "TRANSFERENCIA", note: "se pago 20/02" },
  { period: "2026-02", debtName: "Internet Claro B10 (Piso 1)", amount: 53.21, dateStr: "2026-02-20", method: "TRANSFERENCIA", note: "se pago 20/02" },
  { period: "2026-02", debtName: "WIN Internet", amount: 69, dateStr: "2026-02-21", method: "TRANSFERENCIA", note: "se pago 21/02" },
  { period: "2026-02", debtName: "Internet Claro D17 (Piso 2)", amount: 55, dateStr: "2026-02-21", method: "TRANSFERENCIA", note: "se pago 21/02" },
  { period: "2026-02", debtName: "Claro Postpago Irma", amount: 39.9, dateStr: "2026-02-21", method: "TRANSFERENCIA", note: "se pago 21/02" },
  { period: "2026-02", debtName: "Alquiler B-10 (Sr. Montes)", amount: 600, dateStr: "2026-02-23", method: "TRANSFERENCIA", note: "se pago 23/02" },
  { period: "2026-02", debtName: "Servicios CNG (S-25)", amount: 36, dateStr: "2026-02-27", method: "YAPE 1", note: "se pago 27/02" },
  { period: "2026-02", debtName: "Servicios CNG (E-10)", amount: 36, dateStr: "2026-02-27", method: "YAPE 1", note: "se pago 27/02" },
  { period: "2026-02", debtName: "Cable Red — 7030505", amount: 100, dateStr: "2026-02-27", method: "TRANSFERENCIA", note: "se pago 27/02" },
  { period: "2026-02", debtName: "FOP Internet", amount: 90, dateStr: "2026-02-27", method: "YAPE 1", note: "se pago 27/02" },
  { period: "2026-02", debtName: "Internet Movistar / Infosistel", amount: 102.9, dateStr: "2026-02-27", method: "TRANSFERENCIA", note: "se pago el 27/02" },
  { period: "2026-02", debtName: "Claro Postpago B10", amount: 34.95, dateStr: "2026-02-28", method: "TRANSFERENCIA", note: "se pago 28/02" },

  // ── MARZO 2026 ────────────────────────────────────────────────────────────
  { period: "2026-03", debtName: "Alquiler S-25 (Sra. Julia)", amount: 150, dateStr: "46082", method: "YAPE 1", note: "Alquiler S25" },
  { period: "2026-03", debtName: "Alquiler S-25 (Eduardo)", amount: 150, dateStr: "46082", method: "YAPE 1", note: "Alquiler S25" },
  { period: "2026-03", debtName: "Alquiler S-25 (Lenin)", amount: 150, dateStr: "46082", method: "YAPE 1", note: "Alquiler S25" },
  { period: "2026-03", debtName: "Alquiler B-10 (Sr. Montes)", amount: 600, dateStr: "46088", method: "TRANSFERENCIA", note: "Alquiler B10" },
  { period: "2026-03", debtName: "AFP", amount: 141.33, dateStr: "46086", method: "TRANSFERENCIA", note: "AFP marzo" },
  { period: "2026-03", debtName: "Luz — Casa Irma", amount: 67.6, dateStr: "46097", method: "TRANSFERENCIA", note: "Luz" },
  { period: "2026-03", debtName: "Luz — Stand E-10", amount: 48.2, dateStr: "46098", method: "TRANSFERENCIA", note: "Luz" },
  { period: "2026-03", debtName: "Luz — Stand B-10", amount: 121.7, dateStr: "46098", method: "TRANSFERENCIA", note: "Luz" },
  { period: "2026-03", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46097", method: "TRANSFERENCIA", note: "Cable Red" },
  { period: "2026-03", debtName: "Internet Claro S25 (Piso 3)", amount: 53.21, dateStr: "46097", method: "TRANSFERENCIA", note: "Claro" },
  { period: "2026-03", debtName: "Internet Claro B10 (Piso 1)", amount: 52.5, dateStr: "46097", method: "TRANSFERENCIA", note: "Claro" },
  { period: "2026-03", debtName: "WIN Internet", amount: 69, dateStr: "46097", method: "TRANSFERENCIA", note: "WIN" },
  { period: "2026-03", debtName: "Internet Claro D17 (Piso 2)", amount: 75, dateStr: "46097", method: "TRANSFERENCIA", note: "Claro" },
  { period: "2026-03", debtName: "Internet Movistar / Infosistel", amount: 123.4, dateStr: "46097", method: "TRANSFERENCIA", note: "Movistar" },
  { period: "2026-03", debtName: "Claro Postpago B10", amount: 34.95, dateStr: "46097", method: "TRANSFERENCIA", note: "Claro" },
  { period: "2026-03", debtName: "Claro Postpago Irma", amount: 39.9, dateStr: "46097", method: "TRANSFERENCIA", note: "Claro" },
  { period: "2026-03", debtName: "Servicios CNG (S-25)", amount: 36, dateStr: "46111", method: "EFECTIVO", note: "CNG" },
  { period: "2026-03", debtName: "Servicios CNG (E-10)", amount: 36, dateStr: "46111", method: "EFECTIVO", note: "CNG" },
  { period: "2026-03", debtName: "Honorarios Contador (Henrri Garcia)", amount: 150, dateStr: "46111", method: "TRANSFERENCIA", note: "Contador" },
  { period: "2026-03", debtName: "Sueldo Gerente (Edgar C.P)", amount: 1130, dateStr: "46111", method: "EFECTIVO", note: "Gerente" },

  // ── ABRIL 2026 ────────────────────────────────────────────────────────────
  { period: "2026-04", debtName: "Alquiler S-25 (Sra. Julia)", amount: 150, dateStr: "2026-04-15", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-04", debtName: "Alquiler S-25 (Eduardo)", amount: 150, dateStr: "2026-04-15", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-04", debtName: "Alquiler S-25 (Lenin)", amount: 150, dateStr: "2026-04-15", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-04", debtName: "Alquiler B-10 (Sr. Montes)", amount: 600, dateStr: "2026-04-15", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "AFP", amount: 123.05, dateStr: "2026-04-15", method: "TRANSFERENCIA", note: "PAGDO" },
  { period: "2026-04", debtName: "EsSalud", amount: 112, dateStr: "2026-04-15", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Honorarios Contador (Henrri Garcia)", amount: 150, dateStr: "46136", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Luz — Casa Irma", amount: 94.4, dateStr: "46137", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Luz — Stand E-10", amount: 55.7, dateStr: "46137", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Luz — Stand B-10", amount: 117.2, dateStr: "46137", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Servicios CNG (S-25)", amount: 36, dateStr: "46141", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-04", debtName: "Servicios CNG (E-10)", amount: 36, dateStr: "46141", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-04", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46142", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Internet Claro S25 (Piso 3)", amount: 76, dateStr: "46133", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "WIN Internet", amount: 69, dateStr: "46134", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "FOP Internet", amount: 90, dateStr: "46141", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-04", debtName: "Internet Movistar / Infosistel", amount: 102.9, dateStr: "46142", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Entel Postpago Infosistel", amount: 98.8, dateStr: "46146", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Claro Postpago B10", amount: 34.95, dateStr: "46142", method: "TRANSFERENCIA", note: "PAGO" },
  { period: "2026-04", debtName: "Claro Postpago Irma", amount: 39.9, dateStr: "46139", method: "TRANSFERENCIA", note: "PAGADO" },

  // ── MAYO 2026 ─────────────────────────────────────────────────────────────
  { period: "2026-05", debtName: "AFP", amount: 141, dateStr: "46150", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "EsSalud", amount: 112, dateStr: "46150", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "SUNAT (NPS / IGV / Renta)", amount: 62, dateStr: "46161", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Alquiler S-25 (Sra. Julia)", amount: 150, dateStr: "2026-05-06", method: "YAPE 1", note: "6/5/2026" },
  { period: "2026-05", debtName: "Alquiler S-25 (Eduardo)", amount: 150, dateStr: "2026-05-06", method: "YAPE 1", note: "6/5/2026" },
  { period: "2026-05", debtName: "Alquiler S-25 (Lenin)", amount: 150, dateStr: "2026-05-06", method: "YAPE 1", note: "6/5/2026" },
  { period: "2026-05", debtName: "Alquiler B-10 (Sr. Montes)", amount: 600, dateStr: "46149", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Honorarios Contador (Henrri Garcia)", amount: 150, dateStr: "46246", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Luz — Casa Irma", amount: 82.8, dateStr: "46156", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Luz — Stand E-10", amount: 44.6, dateStr: "46156", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Luz — Stand B-10", amount: 109.6, dateStr: "46156", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Servicios CNG (S-25)", amount: 36, dateStr: "46170", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-05", debtName: "Servicios CNG (E-10)", amount: 36, dateStr: "46170", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-05", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46170", method: "TRANSFERENCIA", note: "PAGO" },
  { period: "2026-05", debtName: "WIN Internet", amount: 69, dateStr: "46168", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "FOP Internet", amount: 90, dateStr: "46170", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-05", debtName: "Internet Claro B10 (Piso 1)", amount: 75, dateStr: "46185", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Internet Claro D17 (Piso 2)", amount: 53, dateStr: "46170", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Internet Claro S25 (Piso 3)", amount: 57, dateStr: "46170", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Internet Movistar / Infosistel", amount: 102.9, dateStr: "46147", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Entel Postpago Infosistel", amount: 98.8, dateStr: "46146", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Claro Postpago B10", amount: 34.95, dateStr: "46168", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Claro Postpago Irma", amount: 39.9, dateStr: "46168", method: "TRANSFERENCIA", note: "PAGADO" },

  // ── JUNIO 2026 ────────────────────────────────────────────────────────────
  { period: "2026-06", debtName: "SUNAT (NPS / IGV / Renta)", amount: 553, dateStr: "46192", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "AFP", amount: 123.05, dateStr: "46179", method: "TRANSFERENCIA", note: "PAGADO X PLIN" },
  { period: "2026-06", debtName: "Alquiler S-25 (Sra. Julia)", amount: 150, dateStr: "46174", method: "YAPE 1", note: "PAGADO A LA SEÑORA JULIA" },
  { period: "2026-06", debtName: "Alquiler S-25 (Eduardo)", amount: 150, dateStr: "46179", method: "YAPE 1", note: "PAGADO A EDUARDO" },
  { period: "2026-06", debtName: "Alquiler S-25 (Lenin)", amount: 150, dateStr: "46179", method: "YAPE 1", note: "PAGADO A LENIN" },
  { period: "2026-06", debtName: "Alquiler B-10 (Sr. Montes)", amount: 600, dateStr: "46190", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Luz — Casa Irma", amount: 103.6, dateStr: "46188", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Luz — Stand E-10", amount: 45, dateStr: "46188", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Luz — Stand B-10", amount: 101, dateStr: "46188", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Servicios CNG (S-25)", amount: 36, dateStr: "46203", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-06", debtName: "Servicios CNG (E-10)", amount: 36, dateStr: "46203", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-06", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46203", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "WIN Internet", amount: 69, dateStr: "46199", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "FOP Internet", amount: 90, dateStr: "46203", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-06", debtName: "Internet Claro D17 (Piso 2)", amount: 55, dateStr: "46185", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Internet Claro S25 (Piso 3)", amount: 75, dateStr: "46196", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Internet Movistar / Infosistel", amount: 102.9, dateStr: "46170", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Entel Postpago Infosistel", amount: 102.8, dateStr: "46178", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Claro Postpago B10", amount: 71.02, dateStr: "46204", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Claro Postpago Irma", amount: 39.9, dateStr: "46199", method: "TRANSFERENCIA", note: "PAGADO" },

  // ── JULIO 2026 ────────────────────────────────────────────────────────────
  { period: "2026-07", debtName: "Alquiler S-25 (Sra. Julia)", amount: 150, dateStr: "46204", method: "YAPE 1", note: "PAGADO-SEÑORA JULIA" },
  { period: "2026-07", debtName: "Alquiler S-25 (Eduardo)", amount: 150, dateStr: "46204", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-07", debtName: "Alquiler S-25 (Lenin)", amount: 150, dateStr: "46204", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-07", debtName: "Alquiler B-10 (Sr. Montes)", amount: 600, dateStr: "46239", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Honorarios Contador (Henrri Garcia)", amount: 150, dateStr: "46247", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Luz — Casa Irma", amount: 113.2, dateStr: "46240", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Luz — Stand E-10", amount: 38.8, dateStr: "46220", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Servicios CNG (S-25)", amount: 36, dateStr: "46234", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-07", debtName: "Servicios CNG (E-10)", amount: 36, dateStr: "46234", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-07", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46230", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "WIN Internet", amount: 69, dateStr: "46230", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "FOP Internet", amount: 90, dateStr: "46230", method: "YAPE 1", note: "PAGO" },
  { period: "2026-07", debtName: "Internet Claro D17 (Piso 2)", amount: 55, dateStr: "46216", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Internet Movistar / Infosistel", amount: 102.9, dateStr: "46204", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Entel Postpago Infosistel", amount: 102.8, dateStr: "46204", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Claro Postpago B10", amount: 71.02, dateStr: "46204", method: "TRANSFERENCIA", note: "PAGADO" },

  // ── AGOSTO 2026 ───────────────────────────────────────────────────────────
  { period: "2026-08", debtName: "SUNAT (NPS / IGV / Renta)", amount: 165, dateStr: "46249", method: "TRANSFERENCIA", note: "PAGO" },
  { period: "2026-08", debtName: "EsSalud", amount: 112, dateStr: "46253", method: "TRANSFERENCIA", note: "PAGO" },
  { period: "2026-08", debtName: "Alquiler S-25 (Sra. Julia)", amount: 150, dateStr: "46235", method: "YAPE 1", note: "PAGO JULIA" },
  { period: "2026-08", debtName: "Alquiler S-25 (Eduardo)", amount: 150, dateStr: "46244", method: "YAPE 1", note: "PAGO EDUARDO" },
  { period: "2026-08", debtName: "Alquiler S-25 (Lenin)", amount: 150, dateStr: "46247", method: "YAPE 1", note: "PAGO LENIN" },
  { period: "2026-08", debtName: "Alquiler B-10 (Sr. Montes)", amount: 600, dateStr: "46253", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Luz — Casa Irma", amount: 97.7, dateStr: "46246", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Luz — Stand E-10", amount: 34.3, dateStr: "46237", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Luz — Stand B-10", amount: 192.1, dateStr: "46235", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46258", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "WIN Internet", amount: 69, dateStr: "46258", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "FOP Internet", amount: 90, dateStr: "46258", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-08", debtName: "Internet Claro B10 (Piso 1)", amount: 75, dateStr: "46262", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Internet Claro D17 (Piso 2)", amount: 55, dateStr: "46237", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Internet Claro S25 (Piso 3)", amount: 75, dateStr: "46235", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Internet Movistar / Infosistel", amount: 76, dateStr: "46252", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Entel Postpago Infosistel", amount: 102.8, dateStr: "46239", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Claro Postpago B10", amount: 29.89, dateStr: "46266", method: "TRANSFERENCIA", note: "PAGADO" },

  // ── SEPTIEMBRE 2026 ───────────────────────────────────────────────────────
  { period: "2026-09", debtName: "SUNAT (NPS / IGV / Renta)", amount: 178, dateStr: "46283", method: "TRANSFERENCIA", note: "pagado" },
  { period: "2026-09", debtName: "AFP", amount: 123.05, dateStr: "46270", method: "TRANSFERENCIA", note: "pagado" },
  { period: "2026-09", debtName: "EsSalud", amount: 112, dateStr: "46269", method: "TRANSFERENCIA", note: "pagado" },
  { period: "2026-09", debtName: "Alquiler S-25 (Sra. Julia)", amount: 150, dateStr: "46266", method: "YAPE 1", note: "PAGO-JULIA" },
  { period: "2026-09", debtName: "Alquiler S-25 (Eduardo)", amount: 150, dateStr: "46266", method: "YAPE 1", note: "PAGO-EDUARDO" },
  { period: "2026-09", debtName: "Alquiler S-25 (Lenin)", amount: 150, dateStr: "46266", method: "YAPE 1", note: "PAGO-LENIN" },
  { period: "2026-09", debtName: "Alquiler B-10 (Sr. Montes)", amount: 600, dateStr: "46302", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Luz — Casa Irma", amount: 80.5, dateStr: "46280", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Luz — Stand E-10", amount: 33.8, dateStr: "46276", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Luz — Stand B-10", amount: 92.2, dateStr: "46276", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Servicios CNG (S-25)", amount: 36, dateStr: "46295", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-09", debtName: "Servicios CNG (E-10)", amount: 36, dateStr: "46295", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-09", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46295", method: "TRANSFERENCIA", note: "PAGO" },
  { period: "2026-09", debtName: "WIN Internet", amount: 69, dateStr: "46291", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "FOP Internet", amount: 90, dateStr: "46295", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-09", debtName: "Internet Claro B10 (Piso 1)", amount: 75, dateStr: "46295", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Internet Claro D17 (Piso 2)", amount: 55, dateStr: "46276", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Internet Claro S25 (Piso 3)", amount: 75, dateStr: "46266", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Internet Movistar / Infosistel", amount: 123.4, dateStr: "46295", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Entel Postpago Infosistel", amount: 102.8, dateStr: "46272", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Claro Postpago B10", amount: 29.89, dateStr: "46295", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Claro Postpago Irma", amount: 39.9, dateStr: "46291", method: "TRANSFERENCIA", note: "PAGADO" },

  // ── OCTUBRE 2026 ──────────────────────────────────────────────────────────
  { period: "2026-10", debtName: "SUNAT (NPS / IGV / Renta)", amount: 416, dateStr: "46316", method: "TRANSFERENCIA", note: "pagado" },
  { period: "2026-10", debtName: "AFP", amount: 141.61, dateStr: "46308", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "EsSalud", amount: 112, dateStr: "46307", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "Alquiler S-25 (Sra. Julia)", amount: 150, dateStr: "46296", method: "YAPE 1", note: "PAGO-JULIA" },
  { period: "2026-10", debtName: "Alquiler S-25 (Eduardo)", amount: 150, dateStr: "46305", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-10", debtName: "Alquiler S-25 (Lenin)", amount: 150, dateStr: "46305", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-10", debtName: "Luz — Casa Irma", amount: 94.1, dateStr: "46308", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "Luz — Stand E-10", amount: 38.4, dateStr: "46308", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "Luz — Stand B-10", amount: 108.1, dateStr: "46308", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "FOP Internet", amount: 100, dateStr: "46309", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-10", debtName: "Internet Claro B10 (Piso 1)", amount: 75, dateStr: "46305", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "Internet Claro D17 (Piso 2)", amount: 55, dateStr: "46305", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "Internet Claro S25 (Piso 3)", amount: 75, dateStr: "46300", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "Internet Movistar / Infosistel", amount: 76, dateStr: "46305", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "Entel Postpago Infosistel", amount: 98.8, dateStr: "46302", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "Claro Postpago B10", amount: 34.95, dateStr: "2026-10-30", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "Claro Postpago Irma", amount: 39.9, dateStr: "2026-10-26", method: "TRANSFERENCIA", note: "PAGADO" },
];

async function seedPayments() {
  console.log("Iniciando sembrado de pagos históricos del Excel...");

  const allDebts = await prisma.debt.findMany();
  const debtMap = new Map<string, string>();
  for (const d of allDebts) {
    debtMap.set(d.name, d.id);
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const item of HISTORICAL_PAYMENTS) {
    const debtId = debtMap.get(item.debtName);
    if (!debtId) {
      console.warn(`No se encontró la obligación: "${item.debtName}"`);
      continue;
    }

    const paidAtDate = new Date(parseDateStr(item.dateStr));

    const existing = await prisma.debtPayment.findUnique({
      where: {
        debtId_period: {
          debtId,
          period: item.period,
        },
      },
    });

    if (!existing) {
      await prisma.debtPayment.create({
        data: {
          debtId,
          period: item.period,
          amount: item.amount,
          paidAt: paidAtDate,
          method: item.method || "TRANSFERENCIA",
          note: item.note || null,
        },
      });
      createdCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`¡Sembrado finalizado! Creados: ${createdCount}, Ya existentes: ${skippedCount}. Total procesados: ${HISTORICAL_PAYMENTS.length}`);
}

seedPayments()
  .catch((e) => {
    console.error("Error sembrando pagos:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
