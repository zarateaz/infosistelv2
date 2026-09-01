/**
 * One-off: borra todos los movimientos de CashboxTransaction de septiembre
 * 2026 (incluidos los cargados por seed-caja-septiembre-2026.ts), dejando
 * el saldo de caja en S/. 0.00. No toca CashboxPeriod — el responsable del
 * mes queda como estaba.
 *
 * Usage: npx tsx scripts/reset-caja-septiembre-2026.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function main() {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const prisma = new PrismaClient({ adapter });

  const start = new Date(2026, 8, 1); // 2026-09-01
  const end = new Date(2026, 9, 1); // 2026-10-01 (exclusivo)

  const existing = await prisma.cashboxTransaction.findMany({
    where: { date: { gte: start, lt: end } },
    select: { description: true, amount: true, paymentMethod: true },
  });

  if (existing.length === 0) {
    console.log("No hay movimientos de septiembre 2026 que borrar — la caja ya está en S/. 0.00.");
  } else {
    console.log(`Borrando ${existing.length} movimiento(s) de septiembre 2026:`);
    existing.forEach((t) => console.log(`  - ${t.description}: S/.${t.amount.toFixed(2)} (${t.paymentMethod})`));
    await prisma.cashboxTransaction.deleteMany({ where: { date: { gte: start, lt: end } } });
    console.log("✓ Listo — septiembre 2026 queda en S/. 0.00.");
  }

  await prisma.$disconnect();
}

main();
