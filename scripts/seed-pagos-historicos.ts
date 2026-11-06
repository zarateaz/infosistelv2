import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

function excelSerialToDateStr(serial: number): string {
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000).toISOString().slice(0, 10);
}

function parseDateStr(str: string): string {
  if (!str) return "2026-01-28";
  if (/^\d{5}$/.test(str)) {
    return excelSerialToDateStr(parseInt(str, 10));
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

/**
 * Pagos históricos exactos extraídos celda por celda de las hojas 2026 de:
 * "PAGOS DE SERVICIOS-DESKTOP-GCPF8MM(Recuperado automáticamente).xlsx"
 * (ENERO 2026 a PAGOS DE OCTUBRE).
 */
const HISTORICAL_PAYMENTS: PaymentSeed[] = [
  // ── ENERO 2026 (Hoja: ENERO 2026) ─────────────────────────────────────────
  { period: "2026-01", debtName: "Alquiler S-25 — Sra. Julia", amount: 150, dateStr: "46025", method: "YAPE 1", note: "se pago a Julia 3/1" },
  { period: "2026-01", debtName: "EsSalud", amount: 112, dateStr: "46030", method: "TRANSFERENCIA", note: "Se pago el 8/01" },
  { period: "2026-01", debtName: "AFP", amount: 123.05, dateStr: "2026-01-09", method: "TRANSFERENCIA", note: "se pago el 9/01" },
  { period: "2026-01", debtName: "Alquiler S-25 — Eduardo", amount: 150, dateStr: "2026-01-09", method: "YAPE 1", note: "se pago a Eduardo 9/01" },
  { period: "2026-01", debtName: "Alquiler S-25 — Lenin", amount: 150, dateStr: "46032", method: "YAPE 1", note: "se pago a Lenin 10/01" },
  { period: "2026-01", debtName: "SUNAT (NPS)", amount: 413, dateStr: "46038", method: "TRANSFERENCIA", note: "se pago 16/1. s/413" },
  { period: "2026-01", debtName: "Alquiler B-10 — Sr. Montes", amount: 600, dateStr: "46038", method: "TRANSFERENCIA", note: "se pago a montes 16/01" },
  { period: "2026-01", debtName: "Personal — Rocío", amount: 1130, dateStr: "46041", method: "TRANSFERENCIA", note: "se pago a Rocio" },
  { period: "2026-01", debtName: "Contador — Henrri García", amount: 150, dateStr: "46046", method: "TRANSFERENCIA", note: "se pago 24/01" },
  { period: "2026-01", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46050", method: "TRANSFERENCIA", note: "se pago 28/01" },
  { period: "2026-01", debtName: "Claro Fijo — 20051067", amount: 76, dateStr: "46050", method: "TRANSFERENCIA", note: "se pago 28/01" },
  { period: "2026-01", debtName: "Internet Claro — Piso 1 B-10", amount: 75, dateStr: "46050", method: "TRANSFERENCIA", note: "se pago 28/01" },
  { period: "2026-01", debtName: "Internet WIN", amount: 69, dateStr: "46050", method: "TRANSFERENCIA", note: "se pago 28/01" },
  { period: "2026-01", debtName: "Luz — Casa Irma", amount: 94.4, dateStr: "46051", method: "TRANSFERENCIA", note: "SE PAGO" },
  { period: "2026-01", debtName: "Luz — Stand E-10", amount: 55.7, dateStr: "46051", method: "TRANSFERENCIA", note: "SE PAGO" },
  { period: "2026-01", debtName: "Celular Claro — Infosistel B-10 EC", amount: 34.95, dateStr: "46051", method: "TRANSFERENCIA", note: "se pago 29/01" },
  { period: "2026-01", debtName: "Celular Claro — Irma", amount: 39.9, dateStr: "46051", method: "TRANSFERENCIA", note: "se pago 29/01" },
  { period: "2026-01", debtName: "Internet FOP", amount: 90, dateStr: "46052", method: "YAPE 1", note: "se pago el 30/01" },
  { period: "2026-01", debtName: "Internet Claro — Piso 3 S-25", amount: 75, dateStr: "46053", method: "TRANSFERENCIA", note: "se pago 31/01" },
  { period: "2026-01", debtName: "Movistar — Edgar Caballero", amount: 123.4, dateStr: "46053", method: "TRANSFERENCIA", note: "se pago el 31/01" },
  { period: "2026-01", debtName: "Movistar — Infosistel", amount: 102.9, dateStr: "46053", method: "TRANSFERENCIA", note: "se pago el 31/01" },
  { period: "2026-01", debtName: "Servicios CNG — Stand S-25", amount: 36, dateStr: "2026-02-17", method: "YAPE 1", note: "se pago 17/02" },
  { period: "2026-01", debtName: "Servicios CNG — Stand E-10", amount: 36, dateStr: "2026-02-17", method: "YAPE 1", note: "se pago 17/02" },

  // ── FEBRERO 2026 (Hoja: FEBRERO 2026) ─────────────────────────────────────
  { period: "2026-02", debtName: "Alquiler S-25 — Sra. Julia", amount: 150, dateStr: "46054", method: "YAPE 1", note: "se pago a Julia 1/2" },
  { period: "2026-02", debtName: "Alquiler S-25 — Eduardo", amount: 150, dateStr: "46056", method: "YAPE 1", note: "se pago a Eduardo 3/2" },
  { period: "2026-02", debtName: "Alquiler S-25 — Lenin", amount: 150, dateStr: "46056", method: "YAPE 1", note: "se pago a Lenin 3/2" },
  { period: "2026-02", debtName: "Luz — Stand E-10", amount: 55.7, dateStr: "46056", method: "TRANSFERENCIA", note: "se pago 3/2" },
  { period: "2026-02", debtName: "Celular Entel — Infosistel", amount: 98.8, dateStr: "46056", method: "TRANSFERENCIA", note: "se pago 3/2" },
  { period: "2026-02", debtName: "AFP", amount: 141.47, dateStr: "46063", method: "TRANSFERENCIA", note: "se pago 10/02 - S/141.47" },
  { period: "2026-02", debtName: "EsSalud", amount: 112, dateStr: "46063", method: "TRANSFERENCIA", note: "se pago 10/02 - s/112" },
  { period: "2026-02", debtName: "SUNAT (NPS)", amount: 413, dateStr: "46066", method: "TRANSFERENCIA", note: "se pago 13/02, fue del mes de enero" },
  { period: "2026-02", debtName: "Luz — Casa Irma", amount: 94.4, dateStr: "46066", method: "TRANSFERENCIA", note: "se pago 13/02" },
  { period: "2026-02", debtName: "Luz — Stand B-10 / S-25", amount: 117.21, dateStr: "46066", method: "TRANSFERENCIA", note: "se pago 13/02" },
  { period: "2026-02", debtName: "Claro Fijo — 20051067", amount: 76, dateStr: "46073", method: "TRANSFERENCIA", note: "se pago 20/02" },
  { period: "2026-02", debtName: "Internet Claro — Piso 1 B-10", amount: 53.21, dateStr: "46073", method: "TRANSFERENCIA", note: "se pago 20/02, s/53.21" },
  { period: "2026-02", debtName: "Internet WIN", amount: 69, dateStr: "46074", method: "TRANSFERENCIA", note: "se pago 21/02" },
  { period: "2026-02", debtName: "Internet Claro — Piso 3 S-25", amount: 75, dateStr: "46074", method: "TRANSFERENCIA", note: "se pago 21/02" },
  { period: "2026-02", debtName: "Celular Claro — Irma", amount: 39.9, dateStr: "46074", method: "TRANSFERENCIA", note: "se pago 21/02" },
  { period: "2026-02", debtName: "Alquiler B-10 — Sr. Montes", amount: 600, dateStr: "46076", method: "TRANSFERENCIA", note: "se pago 23/02" },
  { period: "2026-02", debtName: "Servicios CNG — Stand S-25", amount: 36, dateStr: "46080", method: "YAPE 1", note: "se pago 27/02" },
  { period: "2026-02", debtName: "Servicios CNG — Stand E-10", amount: 36, dateStr: "46080", method: "YAPE 1", note: "se pago 27/02" },
  { period: "2026-02", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46080", method: "TRANSFERENCIA", note: "se pago 27/02" },
  { period: "2026-02", debtName: "Internet FOP", amount: 90, dateStr: "46080", method: "YAPE 1", note: "se pago 27/02" },
  { period: "2026-02", debtName: "Movistar — Edgar Caballero", amount: 123.4, dateStr: "46080", method: "TRANSFERENCIA", note: "se pago 27/02" },
  { period: "2026-02", debtName: "Movistar — Infosistel", amount: 102.9, dateStr: "46080", method: "TRANSFERENCIA", note: "se pago el 27/02" },
  { period: "2026-02", debtName: "Celular Claro — Infosistel B-10 EC", amount: 34.95, dateStr: "46081", method: "TRANSFERENCIA", note: "se pago 28/02" },

  // ── MARZO 2026 (Hojas: MARZO 2026, PAGO DE SERVICIOS, PAGO DE SERVICIO DE PERSONAL) ──
  { period: "2026-03", debtName: "Alquiler S-25 — Sra. Julia", amount: 150, dateStr: "46082", method: "YAPE 1", note: "PAGO POR EL SERVICIO DE ALQUILER" },
  { period: "2026-03", debtName: "Alquiler S-25 — Eduardo", amount: 150, dateStr: "46082", method: "YAPE 1", note: "PAGO POR EL SERVICIO DE ALQUILER" },
  { period: "2026-03", debtName: "Alquiler S-25 — Lenin", amount: 150, dateStr: "46082", method: "YAPE 1", note: "PAGO POR EL SERVICIO DE ALQUILER" },
  { period: "2026-03", debtName: "AFP", amount: 141.33, dateStr: "46086", method: "TRANSFERENCIA", note: "AFP 141.33" },
  { period: "2026-03", debtName: "Alquiler B-10 — Sr. Montes", amount: 600, dateStr: "46088", method: "TRANSFERENCIA", note: "cta. 107002211005170494" },
  { period: "2026-03", debtName: "Luz — Casa Irma", amount: 67.6, dateStr: "46097", method: "TRANSFERENCIA", note: "PAGO POR EL SERVICIO DE LUZ" },
  { period: "2026-03", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46097", method: "TRANSFERENCIA", note: "100" },
  { period: "2026-03", debtName: "Claro Fijo — 20051067", amount: 53.21, dateStr: "46097", method: "TRANSFERENCIA", note: "53.21" },
  { period: "2026-03", debtName: "Internet Claro — Piso 1 B-10", amount: 52.5, dateStr: "46097", method: "TRANSFERENCIA", note: "52.5" },
  { period: "2026-03", debtName: "Internet WIN", amount: 69, dateStr: "46097", method: "TRANSFERENCIA", note: "69" },
  { period: "2026-03", debtName: "Internet Claro — Piso 3 S-25", amount: 75, dateStr: "46097", method: "TRANSFERENCIA", note: "75" },
  { period: "2026-03", debtName: "Movistar — Edgar Caballero", amount: 123.4, dateStr: "46097", method: "TRANSFERENCIA", note: "123.40" },
  { period: "2026-03", debtName: "Celular Claro — Infosistel B-10 EC", amount: 34.95, dateStr: "46097", method: "TRANSFERENCIA", note: "34.95" },
  { period: "2026-03", debtName: "Celular Claro — Irma", amount: 39.9, dateStr: "46097", method: "TRANSFERENCIA", note: "39.9" },
  { period: "2026-03", debtName: "Luz — Stand E-10", amount: 48.2, dateStr: "46098", method: "TRANSFERENCIA", note: "48.2" },
  { period: "2026-03", debtName: "Luz — Stand B-10 / S-25", amount: 127.8, dateStr: "46098", method: "TRANSFERENCIA", note: "127.80" },
  { period: "2026-03", debtName: "Servicios CNG — Stand S-25", amount: 36, dateStr: "46111", method: "EFECTIVO", note: "PAGADO EFECTIVO" },
  { period: "2026-03", debtName: "Servicios CNG — Stand E-10", amount: 36, dateStr: "46111", method: "EFECTIVO", note: "PAGADO EFECTIVO" },
  { period: "2026-03", debtName: "Contador — Henrri García", amount: 150, dateStr: "46111", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-03", debtName: "Gerente — Edgar C.P.", amount: 1130, dateStr: "46111", method: "EFECTIVO", note: "PAGADO" },

  // ── ABRIL 2026 (Hoja: ABRIL- PAGOS) ───────────────────────────────────────
  { period: "2026-04", debtName: "AFP", amount: 123.05, dateStr: "46133", method: "TRANSFERENCIA", note: "PAGDO" },
  { period: "2026-04", debtName: "EsSalud", amount: 112, dateStr: "46133", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Alquiler S-25 — Sra. Julia", amount: 150, dateStr: "46133", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-04", debtName: "Alquiler S-25 — Eduardo", amount: 150, dateStr: "46133", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-04", debtName: "Alquiler S-25 — Lenin", amount: 150, dateStr: "46133", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-04", debtName: "Alquiler B-10 — Sr. Montes", amount: 600, dateStr: "46133", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Contador — Henrri García", amount: 150, dateStr: "46136", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Luz — Casa Irma", amount: 94.4, dateStr: "46137", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Luz — Stand E-10", amount: 55.7, dateStr: "46137", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Luz — Stand B-10 / S-25", amount: 117.21, dateStr: "46137", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Servicios CNG — Stand S-25", amount: 36, dateStr: "46141", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-04", debtName: "Servicios CNG — Stand E-10", amount: 36, dateStr: "46141", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-04", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46142", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Claro Fijo — 20051067", amount: 76, dateStr: "46133", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Internet WIN", amount: 69, dateStr: "46134", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Internet Claro — Piso 3 S-25", amount: 75, dateStr: "46133", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Internet FOP", amount: 90, dateStr: "46141", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-04", debtName: "Movistar — Edgar Caballero", amount: 123.4, dateStr: "46142", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Movistar — Infosistel", amount: 102.9, dateStr: "46142", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Celular Entel — Infosistel", amount: 98.8, dateStr: "46146", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-04", debtName: "Celular Claro — Infosistel B-10 EC", amount: 34.95, dateStr: "46142", method: "TRANSFERENCIA", note: "PAGO" },
  { period: "2026-04", debtName: "Celular Claro — Irma", amount: 39.9, dateStr: "46139", method: "TRANSFERENCIA", note: "PAGADO" },

  // ── MAYO 2026 (Hoja: PAGOS-MAYO) ──────────────────────────────────────────
  { period: "2026-05", debtName: "IGV — SUNAT", amount: 62, dateStr: "46161", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "AFP", amount: 141, dateStr: "46150", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "EsSalud", amount: 112, dateStr: "46150", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Alquiler S-25 — Sra. Julia", amount: 150, dateStr: "2026-05-06", method: "YAPE 1", note: "PAGADO 6/5/2026" },
  { period: "2026-05", debtName: "Alquiler S-25 — Eduardo", amount: 150, dateStr: "2026-05-06", method: "YAPE 1", note: "6/5/2026 LENIN, EDUARDO" },
  { period: "2026-05", debtName: "Alquiler S-25 — Lenin", amount: 150, dateStr: "2026-05-06", method: "YAPE 1", note: "6/5/2026 LENIN, EDUARDO" },
  { period: "2026-05", debtName: "Alquiler B-10 — Sr. Montes", amount: 600, dateStr: "46149", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Contador — Henrri García", amount: 150, dateStr: "46246", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Luz — Casa Irma", amount: 82.8, dateStr: "46156", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Luz — Stand E-10", amount: 44.6, dateStr: "46156", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Luz — Stand B-10 / S-25", amount: 109.6, dateStr: "46156", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Servicios CNG — Stand S-25", amount: 36, dateStr: "46170", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-05", debtName: "Servicios CNG — Stand E-10", amount: 36, dateStr: "46170", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-05", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46170", method: "TRANSFERENCIA", note: "PAGO" },
  { period: "2026-05", debtName: "Internet WIN", amount: 69, dateStr: "46168", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Internet FOP", amount: 90, dateStr: "46170", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-05", debtName: "Movistar — Edgar Caballero", amount: 123.4, dateStr: "46170", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Movistar — Infosistel", amount: 102.9, dateStr: "46147", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Internet Claro — Piso 1 B-10", amount: 75, dateStr: "46185", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Internet Claro — Piso 2 D-17", amount: 53, dateStr: "46147", method: "TRANSFERENCIA", note: "PAGO" },
  { period: "2026-05", debtName: "Internet Claro — Piso 3 S-25", amount: 75, dateStr: "46147", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Claro Fijo — 20051067", amount: 76, dateStr: "46168", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Celular Entel — Infosistel", amount: 98.8, dateStr: "46146", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Celular Claro — Infosistel B-10 EC", amount: 34.95, dateStr: "46168", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-05", debtName: "Celular Claro — Irma", amount: 39.9, dateStr: "46168", method: "TRANSFERENCIA", note: "PAGADO" },

  // ── JUNIO 2026 (Hoja: PAGOS-JUNIO) ────────────────────────────────────────
  { period: "2026-06", debtName: "IGV — SUNAT", amount: 553, dateStr: "46192", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "AFP", amount: 123.05, dateStr: "46179", method: "TRANSFERENCIA", note: "PAGADO X PLIN" },
  { period: "2026-06", debtName: "Alquiler S-25 — Sra. Julia", amount: 150, dateStr: "46174", method: "YAPE 1", note: "PAGADO A LA SEÑORA JULIA" },
  { period: "2026-06", debtName: "Alquiler S-25 — Eduardo", amount: 150, dateStr: "46179", method: "YAPE 1", note: "PAGADO A EDUARDO" },
  { period: "2026-06", debtName: "Alquiler S-25 — Lenin", amount: 150, dateStr: "46179", method: "YAPE 1", note: "PAGADO A LENIN" },
  { period: "2026-06", debtName: "Alquiler B-10 — Sr. Montes", amount: 600, dateStr: "46190", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Luz — Casa Irma", amount: 103.6, dateStr: "46188", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Luz — Stand E-10", amount: 45, dateStr: "46188", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Luz — Stand B-10 / S-25", amount: 101, dateStr: "46188", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Servicios CNG — Stand S-25", amount: 36, dateStr: "46203", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-06", debtName: "Servicios CNG — Stand E-10", amount: 36, dateStr: "46203", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-06", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46203", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Internet WIN", amount: 69, dateStr: "46199", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Internet FOP", amount: 90, dateStr: "46203", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-06", debtName: "Movistar — Edgar Caballero", amount: 123.4, dateStr: "46170", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Internet Claro — Piso 1 B-10", amount: 75, dateStr: "46203", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Internet Claro — Piso 2 D-17", amount: 55, dateStr: "46185", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Internet Claro — Piso 3 S-25", amount: 75, dateStr: "46196", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Claro Fijo — 20051067", amount: 76, dateStr: "46194", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Celular Entel — Infosistel", amount: 102.8, dateStr: "46178", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Celular Claro — Infosistel B-10 EC", amount: 71.02, dateStr: "46204", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-06", debtName: "Celular Claro — Irma", amount: 39.9, dateStr: "46199", method: "TRANSFERENCIA", note: "PAGADO" },

  // ── JULIO 2026 (Hoja: PAGOS JULIO) ────────────────────────────────────────
  { period: "2026-07", debtName: "Alquiler S-25 — Sra. Julia", amount: 150, dateStr: "46204", method: "YAPE 1", note: "PAGADO-SEÑORA JULIA - S/150.00" },
  { period: "2026-07", debtName: "Alquiler B-10 — Sr. Montes", amount: 600, dateStr: "46239", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Contador — Henrri García", amount: 150, dateStr: "46247", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Luz — Casa Irma", amount: 113.2, dateStr: "46240", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Luz — Stand E-10", amount: 38.8, dateStr: "46220", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Servicios CNG — Stand S-25", amount: 36, dateStr: "46234", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-07", debtName: "Servicios CNG — Stand E-10", amount: 36, dateStr: "46234", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-07", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46230", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Internet WIN", amount: 69, dateStr: "46230", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Internet FOP", amount: 90, dateStr: "46230", method: "YAPE 1", note: "PAGO" },
  { period: "2026-07", debtName: "Movistar — Edgar Caballero", amount: 123.4, dateStr: "46204", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Internet Claro — Piso 2 D-17", amount: 55, dateStr: "46216", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Celular Entel — Infosistel", amount: 102.8, dateStr: "46204", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-07", debtName: "Celular Claro — Infosistel B-10 EC", amount: 71.02, dateStr: "46204", method: "TRANSFERENCIA", note: "PAGADO" },

  // ── AGOSTO 2026 (Hoja: PAGOS AGOSTO) ──────────────────────────────────────
  { period: "2026-08", debtName: "IGV — SUNAT", amount: 165, dateStr: "46249", method: "TRANSFERENCIA", note: "PAGO" },
  { period: "2026-08", debtName: "EsSalud", amount: 112, dateStr: "46253", method: "TRANSFERENCIA", note: "PAGO" },
  { period: "2026-08", debtName: "Alquiler S-25 — Sra. Julia", amount: 150, dateStr: "46235", method: "YAPE 1", note: "PAGO JULIA" },
  { period: "2026-08", debtName: "Alquiler S-25 — Eduardo", amount: 150, dateStr: "46244", method: "YAPE 1", note: "PAGADO EDUARDO-MES DE AGOSTO" },
  { period: "2026-08", debtName: "Alquiler S-25 — Lenin", amount: 150, dateStr: "46247", method: "YAPE 1", note: "PAGO LENIN - MES DE AGOSTO" },
  { period: "2026-08", debtName: "Alquiler B-10 — Sr. Montes", amount: 600, dateStr: "46253", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Luz — Casa Irma", amount: 97.7, dateStr: "46246", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Luz — Stand E-10", amount: 34.3, dateStr: "46237", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Luz — Stand B-10 / S-25", amount: 192.1, dateStr: "46235", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46258", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Internet WIN", amount: 69, dateStr: "46258", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Internet FOP", amount: 90, dateStr: "46258", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-08", debtName: "Movistar — Edgar Caballero", amount: 123.4, dateStr: "46235", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Internet Claro — Piso 1 B-10", amount: 75, dateStr: "46262", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Internet Claro — Piso 2 D-17", amount: 55, dateStr: "46237", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Internet Claro — Piso 3 S-25", amount: 75, dateStr: "46235", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Claro Fijo — 20051067", amount: 76, dateStr: "46252", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Celular Entel — Infosistel", amount: 102.8, dateStr: "46239", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-08", debtName: "Celular Claro — Infosistel B-10 EC", amount: 29.89, dateStr: "46266", method: "TRANSFERENCIA", note: "PAGADO" },

  // ── SEPTIEMBRE 2026 (Hoja: PAGOS SEPTIEMBRE) ──────────────────────────────
  { period: "2026-09", debtName: "SUNAT (NPS)", amount: 178, dateStr: "46283", method: "TRANSFERENCIA", note: "pagado" },
  { period: "2026-09", debtName: "AFP", amount: 123.05, dateStr: "46270", method: "TRANSFERENCIA", note: "pagado" },
  { period: "2026-09", debtName: "EsSalud", amount: 112, dateStr: "46269", method: "TRANSFERENCIA", note: "pagado" },
  { period: "2026-09", debtName: "Alquiler S-25 — Sra. Julia", amount: 150, dateStr: "46266", method: "YAPE 1", note: "PAGO-JULIA" },
  { period: "2026-09", debtName: "Alquiler S-25 — Eduardo", amount: 150, dateStr: "46266", method: "YAPE 1", note: "PAGO-EDUARDO" },
  { period: "2026-09", debtName: "Alquiler S-25 — Lenin", amount: 150, dateStr: "46266", method: "YAPE 1", note: "PAGO-LENIN" },
  { period: "2026-09", debtName: "Alquiler B-10 — Sr. Montes", amount: 600, dateStr: "46302", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Luz — Casa Irma", amount: 80.5, dateStr: "46280", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Luz — Stand E-10", amount: 33.8, dateStr: "46276", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Luz — Stand B-10 / S-25", amount: 92.2, dateStr: "46276", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Servicios CNG — Stand S-25", amount: 36, dateStr: "46295", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-09", debtName: "Servicios CNG — Stand E-10", amount: 36, dateStr: "46295", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-09", debtName: "Cable Red — 7030505", amount: 100, dateStr: "46295", method: "TRANSFERENCIA", note: "PAGO" },
  { period: "2026-09", debtName: "Internet WIN", amount: 69, dateStr: "46291", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Internet FOP", amount: 90, dateStr: "46295", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-09", debtName: "Movistar — Edgar Caballero", amount: 123.4, dateStr: "46295", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Internet Claro — Piso 1 B-10", amount: 75, dateStr: "46295", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Internet Claro — Piso 2 D-17", amount: 55, dateStr: "46276", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Internet Claro — Piso 3 S-25", amount: 75, dateStr: "46266", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Claro Fijo — 20051067", amount: 76, dateStr: "46284", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Celular Entel — Infosistel", amount: 102.8, dateStr: "46272", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Celular Claro — Infosistel B-10 EC", amount: 29.89, dateStr: "46295", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-09", debtName: "Celular Claro — Irma", amount: 39.9, dateStr: "46291", method: "TRANSFERENCIA", note: "PAGADO" },

  // ── OCTUBRE 2026 (Hoja: PAGOS DE OCTUBRE) — 16 pagos exactos del Excel ────
  { period: "2026-10", debtName: "SUNAT (NPS)", amount: 416, dateStr: "46316", method: "TRANSFERENCIA", note: "pagado" },
  { period: "2026-10", debtName: "AFP", amount: 141.61, dateStr: "46308", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "EsSalud", amount: 112, dateStr: "46307", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "Alquiler S-25 — Sra. Julia", amount: 150, dateStr: "46296", method: "YAPE 1", note: "PAGO-JULIA" },
  { period: "2026-10", debtName: "Alquiler S-25 — Eduardo", amount: 150, dateStr: "46305", method: "YAPE 1", note: "PAGO-EDUARDO · PAGADO" },
  { period: "2026-10", debtName: "Alquiler S-25 — Lenin", amount: 150, dateStr: "46305", method: "YAPE 1", note: "PAGO-LENIN · PAGADO" },
  { period: "2026-10", debtName: "Luz — Casa Irma", amount: 94.1, dateStr: "46308", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-10", debtName: "Luz — Stand E-10", amount: 38.4, dateStr: "46308", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-10", debtName: "Luz — Stand B-10 / S-25", amount: 108.1, dateStr: "46308", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-10", debtName: "Internet FOP", amount: 100, dateStr: "46309", method: "YAPE 1", note: "PAGADO S/100,00" },
  { period: "2026-10", debtName: "Internet Claro — Piso 2 D-17", amount: 55, dateStr: "46305", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-10", debtName: "Internet Claro — Piso 3 S-25", amount: 75, dateStr: "46300", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-10", debtName: "Claro Fijo — 20051067", amount: 76, dateStr: "46305", method: "YAPE 1", note: "PAGADO" },
  { period: "2026-10", debtName: "Celular Entel — Infosistel", amount: 98.8, dateStr: "46302", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "Celular Claro — Infosistel B-10 EC", amount: 34.95, dateStr: "2026-10-26", method: "TRANSFERENCIA", note: "PAGADO" },
  { period: "2026-10", debtName: "Celular Claro — Irma", amount: 39.9, dateStr: "2026-10-26", method: "TRANSFERENCIA", note: "PAGADO" },
];

async function seedPayments() {
  console.log("Sincronizando pagos históricos exactos del Excel (2026-01 a 2026-10)...");

  const allDebts = await prisma.debt.findMany();
  const debtMap = new Map<string, string>();
  for (const d of allDebts) {
    debtMap.set(d.name, d.id);
  }

  // Mapa de pagos válidos por clave `${debtId}::${period}` para limpiar cualquier pago erróneo previo en 2026-01..2026-10
  const validKeys = new Set<string>();
  let createdCount = 0;
  let updatedCount = 0;

  for (const item of HISTORICAL_PAYMENTS) {
    const debtId = debtMap.get(item.debtName);
    if (!debtId) {
      console.warn(`⚠ No se encontró la obligación: "${item.debtName}"`);
      continue;
    }

    validKeys.add(`${debtId}::${item.period}`);
    const paidAtDate = new Date(parseDateStr(item.dateStr) + "T12:00:00.000Z");

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
      await prisma.debtPayment.update({
        where: { id: existing.id },
        data: {
          amount: item.amount,
          paidAt: paidAtDate,
          method: item.method || "TRANSFERENCIA",
          note: item.note || null,
        },
      });
      updatedCount++;
    }
  }

  // Eliminar pagos de obligaciones del catálogo en 2026-01..2026-10 que NO estén en el Excel (ej. los que antes se marcaron por error)
  const catalogDebtIds = Array.from(debtMap.values());
  const existingPayments = await prisma.debtPayment.findMany({
    where: {
      debtId: { in: catalogDebtIds },
      period: { gte: "2026-01", lte: "2026-10" },
    },
  });

  let removedStale = 0;
  for (const p of existingPayments) {
    if (!validKeys.has(`${p.debtId}::${p.period}`)) {
      await prisma.debtPayment.delete({ where: { id: p.id } });
      removedStale++;
    }
  }

  console.log(
    `¡Sincronización de pagos históricos completada! Creados: ${createdCount}, Actualizados: ${updatedCount}, Depurados: ${removedStale}. Total Excel: ${HISTORICAL_PAYMENTS.length}`
  );
}

seedPayments()
  .catch((e) => {
    console.error("Error sembrando pagos:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
