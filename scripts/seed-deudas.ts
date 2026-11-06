import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

export interface InitialDebtSeed {
  name: string;
  category: "IMPUESTOS" | "ALQUILER" | "PERSONAL" | "SERVICIOS" | "INTERNET" | "CELULAR" | "OTROS";
  location?: string;
  reference?: string;
  payTo?: string;
  phone?: string;
  dueDay: number;
  defaultAmount: number;
  isVariable: boolean;
  startMonth?: string;
  endMonth?: string | null;
  notes?: string;
}

/**
 * Catálogo exacto (0 margen de error) extraído de las hojas 2026 de:
 * "PAGOS DE SERVICIOS-DESKTOP-GCPF8MM(Recuperado automáticamente).xlsx"
 *
 * NO incluye registros que pertenecen a otros módulos de la base de datos:
 * - Clientes de "SERVICIO DE INTERNET" (ya están en Cobranza de Internet / InternetClient)
 * - Facturas "F.E-*" y "F.R-*" (ya están en Facturas / Cuentas)
 * - Movimientos de Caja (CashboxTransaction)
 */
export const INITIAL_DEBTS: InitialDebtSeed[] = [
  // ── 1. IMPUESTOS (Columnas B, C, D, E, F del Excel) ───────────────────────
  {
    name: "IGV — SUNAT",
    category: "IMPUESTOS",
    reference: "SUNAT - IGV (Col. B)",
    payTo: "SUNAT / Clave SOL",
    dueDay: 20,
    defaultAmount: 453.0,
    isVariable: true,
    startMonth: "2026-01",
    notes: "s/453 ref. · El pago varía cada mes según declaración mensual",
  },
  {
    name: "Renta — SUNAT",
    category: "IMPUESTOS",
    reference: "SUNAT - RENTA (Col. C)",
    payTo: "SUNAT / Clave SOL",
    dueDay: 20,
    defaultAmount: 120.0,
    isVariable: true,
    startMonth: "2026-01",
    notes: "Impuesto a la Renta mensual (1.5% · varía cada mes)",
  },
  {
    name: "SUNAT (NPS)",
    category: "IMPUESTOS",
    reference: "SUNAT NPS (Col. D)",
    payTo: "SUNAT — Código NPS",
    dueDay: 20,
    defaultAmount: 413.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "Cuota fija mensual SUNAT (NPS) s/413.00",
  },
  {
    name: "AFP",
    category: "IMPUESTOS",
    reference: "AFP Planilla (Col. E)",
    payTo: "AFPnet",
    dueDay: 15,
    defaultAmount: 123.05,
    isVariable: true,
    startMonth: "2026-01",
    notes: "Aporte mensual AFP planilla (ref. S/ 123.05 – S/ 141.61)",
  },
  {
    name: "EsSalud",
    category: "IMPUESTOS",
    reference: "EsSalud Planilla (Col. F)",
    payTo: "SUNAT / EsSalud",
    dueDay: 15,
    defaultAmount: 112.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "Seguro regular EsSalud planilla S/ 112.00",
  },

  // ── 2. ARRIENDO / ALQUILERES (Columnas G y H del Excel) ───────────────────
  {
    name: "Alquiler S-25 — Sra. Julia",
    category: "ALQUILER",
    location: "Stand S-25",
    reference: "943 458 592",
    payTo: "Yape 943 458 592 (Sra. Julia)",
    phone: "943458592",
    dueDay: 1,
    defaultAmount: 150.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "01/xx · S/ 150.00 a cada hermano (Total Stand S-25: S/ 450.00)",
  },
  {
    name: "Alquiler S-25 — Eduardo",
    category: "ALQUILER",
    location: "Stand S-25",
    reference: "974 226 937 / 985 328 057",
    payTo: "Yape 974 226 937 (Eduardo) = 985 328 057",
    phone: "974226937",
    dueDay: 1,
    defaultAmount: 150.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "01/xx · S/ 150.00 a cada hermano (Total Stand S-25: S/ 450.00)",
  },
  {
    name: "Alquiler S-25 — Lenin",
    category: "ALQUILER",
    location: "Stand S-25",
    reference: "931 150 315",
    payTo: "Yape 931 150 315 (Lenin)",
    phone: "931150315",
    dueDay: 1,
    defaultAmount: 150.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "01/xx · S/ 150.00 a cada hermano (Total Stand S-25: S/ 450.00)",
  },
  {
    name: "Alquiler B-10 — Sr. Montes",
    category: "ALQUILER",
    location: "Stand B-10",
    reference: "cta. 107002211005170494",
    payTo: "Caja Huancayo cta. 107002211005170494 (Sr. Montes)",
    phone: "954938887",
    dueDay: 7,
    defaultAmount: 600.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "07/xx ; S/ 600.00 · PAGO DE CAJA · Tel. 954 938 887",
  },

  // ── 3. PERSONAL (Columnas I, J, K, L del Excel) ───────────────────────────
  {
    name: "Contador — Henrri García",
    category: "PERSONAL",
    reference: "952 526 320",
    payTo: "Henrri García (952 526 320)",
    phone: "952526320",
    dueDay: 30,
    defaultAmount: 150.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "CONTADOR 30/xx ; S/ 150.00",
  },
  {
    name: "Gerente — Edgar C.P.",
    category: "PERSONAL",
    reference: "GERENTE 30/xx",
    payTo: "Edgar C.P.",
    dueDay: 30,
    defaultAmount: 1130.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "GERENTE 30/xx ; S/ 1,130.00",
  },
  {
    name: "Personal Part Time — Alizon",
    category: "PERSONAL",
    reference: "PART TIME MENSUAL",
    payTo: "Alizon",
    dueDay: 16,
    defaultAmount: 650.0,
    isVariable: false,
    startMonth: "2026-10",
    notes: "ALIZON · PART TIME MENSUAL · 16/xx ; S/ 650.00",
  },
  {
    name: "Personal — Rocío",
    category: "PERSONAL",
    reference: "19/XX",
    payTo: "Rocío",
    dueDay: 19,
    defaultAmount: 1130.0,
    isVariable: false,
    startMonth: "2026-01",
    endMonth: "2026-09",
    notes: "Personal Rocío 19/xx ; S/ 1,130.00 (Enero–Septiembre 2026)",
  },

  // ── 4. PAGO DE SERVICIOS: LUZ Y CNG (Columnas N, O, P/Q, R, S del Excel) ──
  {
    name: "Luz — Casa Irma",
    category: "SERVICIOS",
    location: "Casa Irma",
    reference: "67262652",
    payTo: "Electrocentro (Suministro 67262652)",
    dueDay: 14,
    defaultAmount: 94.4,
    isVariable: true,
    startMonth: "2026-01",
    notes: "14/xx · S/ 94.40 ref. · El pago varía por mes",
  },
  {
    name: "Luz — Stand E-10",
    category: "SERVICIOS",
    location: "Stand E-10",
    reference: "67775854",
    payTo: "Electrocentro (Suministro 67775854)",
    dueDay: 14,
    defaultAmount: 55.7,
    isVariable: true,
    startMonth: "2026-01",
    notes: "14/xx · S/ 55.70 ref. · El pago varía por mes",
  },
  {
    name: "Luz — Stand B-10 / S-25",
    category: "SERVICIOS",
    location: "Stand B-10 / S-25",
    reference: "67775219",
    payTo: "Electrocentro (Suministro 67775219)",
    dueDay: 14,
    defaultAmount: 117.21,
    isVariable: true,
    startMonth: "2026-01",
    notes: "14/xx · Se paga uno de los 2, tanto del S25 y B10 · El pago varía por mes",
  },
  {
    name: "Servicios CNG — Stand S-25",
    category: "SERVICIOS",
    location: "Stand S-25",
    reference: "YAPE-954420642",
    payTo: "Yape 954 420 642",
    phone: "954420642",
    dueDay: 30,
    defaultAmount: 36.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "30/xx ; S/ 36.00 · YAPE-954420642",
  },
  {
    name: "Servicios CNG — Stand E-10",
    category: "SERVICIOS",
    location: "Stand E-10",
    reference: "YAPE-954420642",
    payTo: "Yape 954 420 642",
    phone: "954420642",
    dueDay: 30,
    defaultAmount: 36.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "30/xx ; S/ 36.00 · YAPE-954420642",
  },

  // ── 5. INTERNET FIJO (Columnas T, U, V, W, X/AM y Bloques Claro T18–T36) ──
  {
    name: "Cable Red — 7030505",
    category: "INTERNET",
    location: "Galería",
    reference: "6427160",
    payTo: "PAGAR CON QR-IMAGEN",
    dueDay: 31,
    defaultAmount: 100.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "31/xx ; S/ 100.00 · Cód. 7030505 / 6427160 · PAGAR CON QR-IMAGEN",
  },
  {
    name: "Internet WIN",
    category: "INTERNET",
    location: "Galería",
    reference: "10200510670",
    payTo: "WIN (Cód. 10200510670)",
    dueDay: 28,
    defaultAmount: 69.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "28/xx ; S/ 69.00 · RUC/Cód. 10200510670",
  },
  {
    name: "Internet FOP",
    category: "INTERNET",
    location: "Galería",
    reference: "20051067C",
    payTo: "PAGAR CON YAPE-929234880",
    phone: "929234880",
    dueDay: 30,
    defaultAmount: 90.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "30/xx ; S/ 90.00 (Octubre: S/ 100.00) · Cód. 20051067C · Yape 929234880",
  },
  {
    name: "Movistar — Edgar Caballero",
    category: "INTERNET",
    location: "Galería",
    reference: "745981870",
    payTo: "Movistar (Cód. 745981870)",
    dueDay: 28,
    defaultAmount: 123.4,
    isVariable: false,
    startMonth: "2026-01",
    notes: "28/xx ; S/ 123.40 · MOVISTAR / EDGAR CABALLERO · Cód. 745981870",
  },
  {
    name: "Movistar — Infosistel",
    category: "INTERNET",
    location: "Galería",
    reference: "603017173",
    payTo: "Movistar (Cód. 603017173)",
    dueDay: 5,
    defaultAmount: 102.9,
    isVariable: false,
    startMonth: "2026-01",
    notes: "05/xx ; S/ 102.90 · MOVISTAR / INFOSISTEL · Cód. 603017173",
  },
  {
    name: "Internet Claro — Piso 1 B-10",
    category: "INTERNET",
    location: "Av. Giraldez N° 274 - Piso 1 - B10",
    reference: "H54515572",
    payTo: "Claro (Cód. H54515572)",
    dueDay: 30,
    defaultAmount: 75.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "30 de cada mes ; S/ 75.00 · INTERNET CLARO - AV GIRALDEZ N° 274 - PISO 1 - B10",
  },
  {
    name: "Internet Claro — Piso 2 D-17",
    category: "INTERNET",
    location: "Av. Giraldez N° 274 - Piso 2 - D17",
    reference: "H57549715",
    payTo: "Claro (Cód. H57549715)",
    dueDay: 12,
    defaultAmount: 55.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "12 de cada mes ; S/ 55.00 · INTERNET CLARO - AV GIRALDEZ N° 274 - PISO 2 - D17",
  },
  {
    name: "Internet Claro — Piso 3 S-25",
    category: "INTERNET",
    location: "Av. Giraldez N° 274 - Piso 3 - S25",
    reference: "H55460149",
    payTo: "Claro RUC 10200510670 (Cód. H55460149)",
    dueDay: 3,
    defaultAmount: 75.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "3 de cada mes ; S/ 75.00 · CLARO RUC:10200510670 - AV GIRALDEZ N° 274 - PISO 3 - S25",
  },
  {
    name: "Claro Fijo — 20051067",
    category: "INTERNET",
    location: "Galería",
    reference: "20051067",
    payTo: "Claro (Cód. 20051067)",
    dueDay: 21,
    defaultAmount: 76.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "21 de cada mes ; S/ 76.00 · CLARO Código de pago 20051067",
  },

  // ── 6. CELULARES (Columnas Y, Z, AA, AB del Excel) ────────────────────────
  {
    name: "Celular Entel — Infosistel",
    category: "CELULAR",
    location: "Infosistel",
    reference: "964648202",
    payTo: "Entel (Línea 964 648 202)",
    phone: "964648202",
    dueDay: 5,
    defaultAmount: 98.8,
    isVariable: false,
    startMonth: "2026-01",
    notes: "05/xx ; S/ 98.80 · ENTEL INFOSISTEL 964648202",
  },
  {
    name: "Celular Claro — Infosistel S-25",
    category: "CELULAR",
    location: "Stand S-25",
    reference: "936193838",
    payTo: "Claro (Línea 936 193 838)",
    phone: "936193838",
    dueDay: 30,
    defaultAmount: 35.0,
    isVariable: false,
    startMonth: "2026-01",
    notes: "30/xx ; S/ 35.00 · Infosistel S25 936193838",
  },
  {
    name: "Celular Claro — Infosistel B-10 EC",
    category: "CELULAR",
    location: "Stand B-10",
    reference: "993829882",
    payTo: "Claro (Línea 993 829 882)",
    phone: "993829882",
    dueDay: 30,
    defaultAmount: 34.95,
    isVariable: false,
    startMonth: "2026-01",
    notes: "30/xx ; S/ 34.95 · Infosistel B10 EC 993829882 CLARO",
  },
  {
    name: "Celular Claro — Irma",
    category: "CELULAR",
    location: "Casa Irma",
    reference: "986147752 / 19848025",
    payTo: "Claro (Línea 986 147 752 · Cód. 19848025)",
    phone: "986147752",
    dueDay: 26,
    defaultAmount: 39.9,
    isVariable: false,
    startMonth: "2026-01",
    notes: "26/xx ; S/ 39.90 · Claro Irma 986147752 (Cód. 19848025)",
  },
];

// Nombres antiguos de la versión previa del seed que deben limpiarse si existen
const LEGACY_SEED_NAMES = [
  "Alquiler S-25 (Sra. Julia)",
  "Alquiler S-25 (Eduardo)",
  "Alquiler S-25 (Lenin)",
  "Alquiler B-10 (Sr. Montes)",
  "Honorarios Contador (Henrri Garcia)",
  "Sueldo Gerente (Edgar C.P)",
  "SUNAT (NPS / IGV / Renta)",
  "Luz — Stand B-10",
  "Servicios CNG (S-25)",
  "Servicios CNG (E-10)",
  "WIN Internet",
  "FOP Internet",
  "Internet Claro B10 (Piso 1)",
  "Internet Claro D17 (Piso 2)",
  "Internet Claro S25 (Piso 3)",
  "Internet Movistar / Infosistel",
  "Entel Postpago Infosistel",
  "Claro Postpago S25",
  "Claro Postpago B10",
  "Claro Postpago Irma",
];

async function seed() {
  console.log("Sincronizando obligaciones exactas del Excel (0 margen de error)...");

  // Eliminar registros del seed anterior que tenían nombres fusionados o inexactos
  const deletedLegacy = await prisma.debt.deleteMany({
    where: {
      name: { in: LEGACY_SEED_NAMES },
    },
  });
  if (deletedLegacy.count > 0) {
    console.log(`✓ Limpiadas ${deletedLegacy.count} obligaciones del formato anterior.`);
  }

  for (const item of INITIAL_DEBTS) {
    const existing = await prisma.debt.findFirst({
      where: { name: item.name },
    });

    if (!existing) {
      await prisma.debt.create({
        data: {
          name: item.name,
          category: item.category,
          payee: item.payTo ?? null,
          location: item.location ?? null,
          reference: item.reference ?? null,
          payTo: item.payTo ?? null,
          phone: item.phone ?? null,
          dueDay: item.dueDay,
          amount: item.defaultAmount,
          isVariable: item.isVariable,
          startMonth: item.startMonth ?? "2026-01",
          endMonth: item.endMonth ?? null,
          notes: item.notes ?? null,
          active: true,
        },
      });
      console.log(`+ Creada obligación: ${item.name}`);
    } else {
      await prisma.debt.update({
        where: { id: existing.id },
        data: {
          category: item.category,
          payee: item.payTo ?? null,
          location: item.location ?? null,
          reference: item.reference ?? null,
          payTo: item.payTo ?? null,
          phone: item.phone ?? null,
          dueDay: item.dueDay,
          amount: item.defaultAmount,
          isVariable: item.isVariable,
          startMonth: item.startMonth ?? "2026-01",
          endMonth: item.endMonth ?? null,
          notes: item.notes ?? null,
        },
      });
      console.log(`= Actualizada obligación: ${item.name}`);
    }
  }

  console.log(`¡Sembrado completado con éxito! Total catálogo Excel: ${INITIAL_DEBTS.length} obligaciones.`);
}

seed()
  .catch((e) => {
    console.error("Error sembrando obligaciones:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
