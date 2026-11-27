#!/usr/bin/env node
/**
 * scripts/migrar-clientes-retirados.ts
 *
 * Agrega (si faltan) las columnas de "Clientes retirados" a InternetClient.
 * Idempotente: si ya existen no hace nada. Solo AGREGA columnas vacías (NULL),
 * nunca borra ni modifica datos. Lo ejecuta sync-vps.sh en cada deploy.
 *
 *   node --env-file=.env ./node_modules/.bin/tsx scripts/migrar-clientes-retirados.ts
 */
import { prisma } from "../src/lib/prisma";

const COLUMNS: { name: string; type: string }[] = [
  { name: "retiredAt", type: "DATETIME" },
  { name: "retiredReason", type: "TEXT" },
  { name: "retiredDebtMonths", type: "TEXT" },
];

async function main() {
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("InternetClient")`);
  if (cols.length === 0) throw new Error("No existe la tabla InternetClient en la base de datos configurada.");
  const existing = new Set(cols.map((c) => c.name));
  let added = 0;
  for (const col of COLUMNS) {
    if (existing.has(col.name)) continue;
    await prisma.$executeRawUnsafe(`ALTER TABLE "InternetClient" ADD COLUMN "${col.name}" ${col.type}`);
    console.log(`  + columna InternetClient.${col.name} agregada`);
    added++;
  }
  console.log(added ? `✅ Clientes retirados: ${added} columna(s) agregada(s).` : "✅ Clientes retirados: esquema ya al día.");
}

main()
  .catch((e) => {
    console.error("❌ No se pudo preparar la tabla de clientes retirados:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
