/**
 * One-off loader for the real September 2026 cashbox numbers, taken
 * directly from "CONTROL DE CAJA- 2026-SEPTIEMBRE.pdf1.pdf" (resumen por
 * medio de pago: Yape 1 S/.455.42, Efectivo S/.544.90, Yape 2 S/.0.00,
 * saldo final S/.1000.32) and the opening-balance/internet-payment split
 * already visible in the spreadsheet this replaces.
 *
 * Idempotent: matches each row by description+date+amount+paymentMethod
 * before inserting, so running this twice — or running it after some rows
 * were already typed in by hand through the admin UI — never creates
 * duplicates. Safe to re-run.
 *
 * Usage: npx tsx scripts/seed-caja-septiembre-2026.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const MONTH = "2026-09";
const RESPONSIBLE = "Veronica Ramos P.";
const OPENING_DATE = new Date(2026, 8, 1); // 2026-09-01 (month is 0-indexed)

const ROWS: { description: string; amount: number; paymentMethod: string }[] = [
  { description: "SALDO INICIAL", amount: 425.42, paymentMethod: "YAPE 1" },
  { description: "SALDO INICIAL", amount: 544.9, paymentMethod: "EFECTIVO" },
  { description: "PAGO POR EL SERVICIO DE INTERNET STAND B21-AGOSTO", amount: 30.0, paymentMethod: "YAPE 1" },
];

async function main() {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const prisma = new PrismaClient({ adapter });

  await prisma.cashboxPeriod.upsert({
    where: { month: MONTH },
    update: { responsible: RESPONSIBLE },
    create: { month: MONTH, responsible: RESPONSIBLE },
  });
  console.log(`✓ Periodo ${MONTH} — responsable: ${RESPONSIBLE}`);

  for (const row of ROWS) {
    const existing = await prisma.cashboxTransaction.findFirst({
      where: {
        date: OPENING_DATE,
        description: row.description,
        amount: row.amount,
        paymentMethod: row.paymentMethod,
      },
    });
    if (existing) {
      console.log(`… ya existía: ${row.description} — S/.${row.amount.toFixed(2)} (${row.paymentMethod})`);
      continue;
    }
    await prisma.cashboxTransaction.create({
      data: {
        date: OPENING_DATE,
        description: row.description,
        type: "INCOME",
        amount: row.amount,
        paymentMethod: row.paymentMethod,
      },
    });
    console.log(`✓ Creado: ${row.description} — S/.${row.amount.toFixed(2)} (${row.paymentMethod})`);
  }

  const total = ROWS.reduce((sum, r) => sum + r.amount, 0);
  console.log(`\nTotal esperado del período: S/.${total.toFixed(2)}`);
  await prisma.$disconnect();
}

main();
