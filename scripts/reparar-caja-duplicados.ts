#!/usr/bin/env node
/**
 * scripts/reparar-caja-duplicados.ts
 *
 * Detecta los ingresos de Caja inflados desde el miércoles 18/11/2026:
 *
 *  A) "Servicio Técnico ..." creados por la auto-sincronización del GET de
 *     Servicios Técnicos: se generaron DESPUÉS de la restauración, pero con la
 *     fecha antigua del pago (createdAt muy posterior a `date`).
 *  B) Duplicados exactos (misma fecha, tipo, monto, método y descripción)
 *     creados desde el 18/11: se conserva el más antiguo.
 *
 * Por defecto SOLO MUESTRA (no toca nada). Para enviarlos a la Papelera
 * (soft delete, se pueden restaurar desde /taller-control/papelera):
 *
 *   node --env-file=.env ./node_modules/.bin/tsx scripts/reparar-caja-duplicados.ts
 *   node --env-file=.env ./node_modules/.bin/tsx scripts/reparar-caja-duplicados.ts --aplicar
 *
 * Opcional: --desde=2026-11-18 para cambiar el inicio de la ventana.
 */
import { prisma } from "../src/lib/prisma";

const APLICAR = process.argv.includes("--aplicar");
const desdeArg = process.argv.find((a) => a.startsWith("--desde="))?.split("=")[1] || "2026-11-18";
// Medianoche de Lima (UTC-5)
const DESDE = new Date(`${desdeArg}T05:00:00.000Z`);

const limaDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d);
const utcDay = (d: Date) => d.toISOString().slice(0, 10);
const money = (n: number) => `S/. ${n.toFixed(2)}`;

async function main() {
  console.log(`\n=== Revisión de Caja (ingresos creados desde ${desdeArg}) — modo ${APLICAR ? "APLICAR" : "SOLO LECTURA"} ===\n`);

  const recientes = await prisma.cashboxTransaction.findMany({
    where: { deletedAt: null, createdAt: { gte: DESDE } },
    orderBy: { createdAt: "asc" },
  });

  const sospechosos = new Map<string, { tx: (typeof recientes)[number]; motivo: string }>();

  // A) Auto-sync retroactivo de Servicios Técnicos
  for (const tx of recientes) {
    if (tx.type !== "INCOME" || !tx.description.startsWith("Servicio Técnico")) continue;
    // `date` se guarda como medianoche UTC del día de Caja
    if (utcDay(tx.date) < limaDay(tx.createdAt)) {
      sospechosos.set(tx.id, {
        tx,
        motivo: `ST retroactivo (fecha ${utcDay(tx.date)}, creado ${limaDay(tx.createdAt)})`,
      });
    }
  }

  // B) Duplicados exactos: comparar contra TODOS los activos con la misma clave
  const fechas = [...new Set(recientes.map((t) => t.date.getTime()))].map((t) => new Date(t));
  const candidatos = fechas.length
    ? await prisma.cashboxTransaction.findMany({
        where: { deletedAt: null, date: { in: fechas } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const grupos = new Map<string, typeof candidatos>();
  for (const tx of candidatos) {
    const k = [tx.date.toISOString(), tx.type, tx.amount.toFixed(2), tx.paymentMethod, tx.description.trim().toUpperCase()].join("|");
    grupos.set(k, [...(grupos.get(k) || []), tx]);
  }
  for (const lista of grupos.values()) {
    if (lista.length < 2) continue;
    for (const dup of lista.slice(1)) {
      if (dup.createdAt >= DESDE && !sospechosos.has(dup.id)) {
        sospechosos.set(dup.id, { tx: dup, motivo: `Duplicado exacto de ${lista[0].id}` });
      }
    }
  }

  if (sospechosos.size === 0) {
    console.log("✅ No se encontraron movimientos sospechosos.");
    return;
  }

  const impacto: Record<string, number> = {};
  for (const { tx, motivo } of sospechosos.values()) {
    const signo = tx.type === "INCOME" ? 1 : -1;
    impacto[tx.paymentMethod] = (impacto[tx.paymentMethod] || 0) + signo * tx.amount;
    console.log(
      `- [${tx.paymentMethod}] ${utcDay(tx.date)} ${tx.type === "INCOME" ? "+" : "-"}${money(tx.amount)}  ${tx.description}\n    id=${tx.id} · ${motivo}`
    );
  }
  console.log("\nImpacto en saldos (lo que bajaría cada cuenta):");
  for (const [m, v] of Object.entries(impacto)) console.log(`  ${m.padEnd(9)} ${money(v)}`);

  if (!APLICAR) {
    console.log(`\nRevisa la lista. Si es correcta, vuelve a ejecutar con --aplicar (van a la Papelera, son restaurables).`);
    return;
  }

  const ids = [...sospechosos.keys()];
  const r = await prisma.cashboxTransaction.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  console.log(`\n🗑️  ${r.count} movimiento(s) enviados a la Papelera.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
