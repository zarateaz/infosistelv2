#!/usr/bin/env node
/**
 * scripts/auditar-cobranza-internet.ts
 *
 * Revisa TODOS los clientes de internet y explica por qué cada deudor figura como deudor
 * (SOLO LECTURA, no toca nada). Sirve para encontrar casos como "pagó todo 2026 pero
 * sale con deuda": meses impagos de años anteriores por una fecha de inicio mal puesta.
 *
 *   node --env-file=.env ./node_modules/.bin/tsx scripts/auditar-cobranza-internet.ts
 *
 * Para corregir: Cobranza de Internet → abrir "Meses" del cliente → botón
 * "Empezó en …: corregir inicio", o marcar los meses de ese año si de verdad los pagó.
 */
import { prisma } from "../src/lib/prisma";
import { dateToInputValue } from "../src/app/taller-control/(panel)/caja/month";
import {
  cobranzaState,
  daysUntil,
  formatMonthKeyLabel,
  getUnpaidMonthKeys,
  normalizeClientPayments,
} from "../src/app/taller-control/(panel)/cobranza-internet/cobranza";

async function main() {
  const clients = await prisma.internetClient.findMany({ orderBy: { clientName: "asc" } });
  const today = new Date();
  const curKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  let deudores = 0;
  let previos = 0;
  let desfasados = 0;

  console.log(`\n=== Auditoría de Cobranza de Internet: ${clients.length} clientes ===\n`);
  for (const c of clients) {
    const startDate = dateToInputValue(c.startDate);
    const stored = dateToInputValue(c.nextPaymentDate);
    const { map, nextPaymentDate } = normalizeClientPayments({
      startDate,
      nextPaymentDate: stored,
      paidMonths: c.paidMonths,
      amount: c.amount,
    });
    const overdue = getUnpaidMonthKeys(map, startDate, today).filter((k) => k < curKey);
    const prevYears = overdue.filter((k) => Number(k.slice(0, 4)) < today.getFullYear());
    const st = cobranzaState(daysUntil(nextPaymentDate, today));
    if (stored !== nextPaymentDate) desfasados++;
    if (st === "ok" && stored === nextPaymentDate) continue;
    if (st !== "ok") deudores++;
    if (prevYears.length > 0) previos++;

    console.log(`${prevYears.length > 0 ? "⚠ " : "  "}${c.clientName}${c.clientCode ? ` (${c.clientCode})` : ""}`);
    console.log(`     inicio ${startDate} · próximo pago ${nextPaymentDate}${stored !== nextPaymentDate ? ` (en BD: ${stored}, la pantalla ya usa ${nextPaymentDate})` : ""}`);
    if (overdue.length > 0) {
      console.log(
        `     debe ${overdue.length} mes(es): ${overdue.length <= 6 ? overdue.map(formatMonthKeyLabel).join(", ") : `${formatMonthKeyLabel(overdue[0])} → ${formatMonthKeyLabel(overdue[overdue.length - 1])}`}`
      );
    }
    if (prevYears.length > 0) {
      const firstPaid = Object.keys(map)
        .filter((k) => /^\d{4}-\d{2}$/.test(k) && map[k]?.status === "paid")
        .sort()[0];
      console.log(`     ${prevYears.length} de esos meses son de años anteriores.${firstPaid ? ` Primer mes pagado: ${formatMonthKeyLabel(firstPaid)} → ¿la fecha de inicio está mal?` : ""}`);
    }
    console.log("");
  }
  console.log(`Deudores: ${deudores} · con deuda de años anteriores: ${previos} · fechas desfasadas en BD: ${desfasados}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
