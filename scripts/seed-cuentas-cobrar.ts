/**
 * One-off loader for the real "CUENTAS POR COBRAR.pdf" spreadsheet — 8
 * outstanding client debts as of 2026-09-10. "CUENTAS POR PAGAR.pdf" was an
 * empty template with no rows, so nothing to seed there yet.
 *
 * Idempotent: matches each row by clientName+concept+total+dueDate before
 * inserting, so re-running this — or entering rows by hand afterwards —
 * never creates duplicates. Safe to re-run.
 *
 * Usage: npx tsx scripts/seed-cuentas-cobrar.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

type Row = {
  issueDate: Date;
  clientName: string;
  ruc?: string;
  documentType?: string;
  concept: string;
  total: number;
  dueDate: Date;
  notes?: string;
};

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

const ROWS: Row[] = [
  { issueDate: d(2026, 6, 26), clientName: "CLAUDIA PAMELA", concept: "VENTA DE TONER 17A", total: 70.0, dueDate: d(2026, 6, 30) },
  { issueDate: d(2026, 7, 3), clientName: "JULIA HUAMAN", concept: "SERVICIO DE INSTALACIÓN DE ANTIVIRUS", total: 127.0, dueDate: d(2026, 7, 10) },
  { issueDate: d(2026, 7, 30), clientName: "ELECTROCENTRO", concept: "SERVICIO DE MANTENIMIENTO DE EQUIPOS FECHA 30,31,01", total: 300.0, dueDate: d(2026, 8, 10) },
  {
    issueDate: d(2026, 8, 5),
    clientName: "MUNICIPALIDAD DISTRITAL DE CHAMABARA",
    ruc: "20191894490",
    documentType: "FACTURA",
    concept: "SERVICIO DE MANTENIMIENTO DE IMPRESORA CANON",
    total: 430.0,
    dueDate: d(2026, 8, 10),
    notes: "CODIGO EJECUTORA 301034 SIAF 329",
  },
  { issueDate: d(2026, 8, 17), clientName: "JUAN MONTES", concept: "RECARGA DE TONER 85A", total: 30.0, dueDate: d(2026, 8, 20) },
  { issueDate: d(2026, 8, 24), clientName: "JUAN MONTES", concept: "VENTA DE CARGADOR ASUS COMPATIBLE", total: 40.0, dueDate: d(2026, 8, 26) },
  { issueDate: d(2026, 8, 26), clientName: "JUAN MONTES", concept: "SERVICIO TÉCNICO - LAPTOP", total: 30.0, dueDate: d(2026, 8, 30) },
  {
    issueDate: d(2026, 9, 10),
    clientName: "MUNICIPALIDAD DISTRITAL DE CHAMABARA",
    ruc: "20191894490",
    documentType: "FACTURA",
    concept: "2 IMPRESORAS MULTIFUNCIONALES - HP",
    total: 1220.0,
    dueDate: d(2026, 9, 15),
    notes: "CODIGO EJECUTORA 301034 SIAF 386",
  },
];

async function main() {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const prisma = new PrismaClient({ adapter });

  for (const row of ROWS) {
    const existing = await prisma.receivable.findFirst({
      where: { clientName: row.clientName, concept: row.concept, total: row.total, dueDate: row.dueDate },
    });
    if (existing) {
      console.log(`… ya existía: ${row.clientName} — ${row.concept}`);
      continue;
    }
    await prisma.receivable.create({
      data: {
        issueDate: row.issueDate,
        clientName: row.clientName,
        ruc: row.ruc ?? null,
        documentType: row.documentType ?? null,
        concept: row.concept,
        total: row.total,
        dueDate: row.dueDate,
        notes: row.notes ?? null,
      },
    });
    console.log(`✓ Creado: ${row.clientName} — S/.${row.total.toFixed(2)} (${row.concept})`);
  }

  const total = ROWS.reduce((sum, r) => sum + r.total, 0);
  console.log(`\nTotal cargado: S/.${total.toFixed(2)} en ${ROWS.length} cuentas por cobrar.`);
  await prisma.$disconnect();
}

main();
