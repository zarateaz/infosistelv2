#!/usr/bin/env node
/**
 * scripts/auditar-productos-duplicados.ts
 *
 * Revisa TODO el catálogo y lista los productos repetidos (SOLO LECTURA, no toca nada).
 * Para unirlos usa el panel: /taller-control/productos/duplicados
 *
 *   node --env-file=.env ./node_modules/.bin/tsx scripts/auditar-productos-duplicados.ts
 */
import { prisma } from "../src/lib/prisma";
import { findDuplicateGroups } from "../src/lib/duplicateAudit";

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true, itemNumber: true, name: true, barcode: true, category: true,
      price: true, costPrice: true, stock: true, image: true, images: true, description: true,
    },
    orderBy: { itemNumber: "asc" },
  });
  const t = Date.now();
  const groups = findDuplicateGroups(products);
  const seguros = groups.filter((g) => g.level === "seguro");
  const revisar = groups.filter((g) => g.level === "revisar");

  console.log(`\n=== Auditoría de repetidos: ${products.length} productos revisados en ${Date.now() - t} ms ===\n`);
  for (const [title, list] of [["REPETIDOS SEGUROS", seguros], ["PARA REVISAR", revisar]] as const) {
    console.log(`--- ${title}: ${list.length} grupo(s) ---`);
    list.forEach((g, i) => {
      console.log(`\n[${i + 1}]`);
      for (const p of g.products) {
        console.log(`   #${String(p.itemNumber).padEnd(5)} stock ${String(p.stock).padEnd(4)} S/.${String(p.price).padEnd(8)} ${p.barcode ? `cód ${p.barcode}  ` : ""}${p.name}`);
      }
    });
    console.log("");
  }
  console.log("Para unirlos: /taller-control/productos/duplicados\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
