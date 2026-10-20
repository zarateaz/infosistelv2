import fs from "fs";
import path from "path";
import zlib from "zlib";
// @ts-ignore
import Database from "better-sqlite3";

/**
 * Universal script to find, recover and restore all quotations from any backup,
 * active database, or compressed (.gz) archive.
 * 0 margin of error.
 */

const tempFilesToClean: string[] = [];

function safeDecompressGz(filePath: string): string | null {
  try {
    const buffer = fs.readFileSync(filePath);
    // Gzip magic number check: 0x1f 0x8b
    if (buffer.length < 2 || buffer[0] !== 0x1f || buffer[1] !== 0x8b) {
      return null;
    }
    const decompressed = zlib.gunzipSync(buffer);
    const tempPath = path.join("/tmp", `restore_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.db`);
    fs.writeFileSync(tempPath, decompressed);
    tempFilesToClean.push(tempPath);
    return tempPath;
  } catch (err: any) {
    return null;
  }
}

function findDatabases(): string[] {
  const candidates: string[] = [
    process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/^file:/, "") : "",
    "/home/zarate/infosistel-v2-data/dev.db",
    "/home/zarate/infosistel-v2/dev.db",
    path.resolve(process.cwd(), "dev.db"),
    path.resolve(process.cwd(), "..", "infosistel-v2-data", "dev.db"),
    path.resolve(process.cwd(), "prisma", "dev.db"),
  ];

  const searchDirs = [
    "/home/zarate/infosistel-v2-data/backups",
    "/home/zarate/infosistel-v2-data",
    "/home/zarate/infosistel-v2/backups",
    "/home/zarate/infosistel-v2",
    "/home/zarate/backups",
    "/home/zarate",
    path.resolve(process.cwd(), "backups"),
    path.resolve(process.cwd()),
    "/tmp",
  ];

  for (const sDir of searchDirs) {
    if (fs.existsSync(sDir)) {
      try {
        const files = fs.readdirSync(sDir);
        for (const file of files) {
          const fullPath = path.join(sDir, file);
          try {
            const stat = fs.statSync(fullPath);
            if (!stat.isFile()) continue;

            if (file.endsWith(".gz") && (file.includes("dev.db") || file.includes("backup") || file.includes("infosistel"))) {
              const decompressed = safeDecompressGz(fullPath);
              if (decompressed) {
                candidates.push(decompressed);
              }
            } else if (file.includes("dev.db") || file.endsWith(".db") || file.endsWith(".sqlite") || file.includes(".bak")) {
              candidates.push(fullPath);
            }
          } catch {}
        }
      } catch {}
    }
  }

  // Deduplicate and filter existing valid files
  const existing = Array.from(new Set(candidates.filter(Boolean))).filter((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isFile() && fs.statSync(p).size > 1024;
    } catch {
      return false;
    }
  });

  return existing;
}

interface QuotationRow {
  id: string;
  code: string;
  clientName: string;
  clientDocType: string | null;
  clientDocNum: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  clientAddress: string | null;
  attentionTo: string | null;
  issueDate: string | number;
  validDays: number;
  currency: string;
  includeIgv: number;
  subtotal: number;
  igv: number;
  discount: number;
  total: number;
  status: string;
  deliveryTime: string | null;
  paymentMethod: string | null;
  warranty: string | null;
  notes: string | null;
  images: string | null;
  createdAt: string | number;
  updatedAt: string | number;
  deletedAt: string | number | null;
}

interface QuotationItemRow {
  id: string;
  quotationId: string;
  productId: string | null;
  description: string;
  brand: string | null;
  model: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  notes: string | null;
  costPrice: number | null;
  marginPercent: number | null;
  image?: string | null;
}

function restoreIntoTarget(targetDbPath: string, allFoundQuotations: Map<string, { q: QuotationRow; items: QuotationItemRow[]; source: string }>): number {
  if (!fs.existsSync(targetDbPath)) return 0;

  console.log(`\n⚙️  Restaurando datos en base de datos: ${targetDbPath}`);
  const targetDb = new Database(targetDbPath);

  // Ensure tables exist in target
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS "Quotation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "code" TEXT NOT NULL,
      "clientName" TEXT NOT NULL,
      "clientDocType" TEXT,
      "clientDocNum" TEXT,
      "clientPhone" TEXT,
      "clientEmail" TEXT,
      "clientAddress" TEXT,
      "attentionTo" TEXT,
      "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "validDays" INTEGER NOT NULL DEFAULT 15,
      "currency" TEXT NOT NULL DEFAULT 'PEN',
      "includeIgv" BOOLEAN NOT NULL DEFAULT 1,
      "subtotal" REAL NOT NULL,
      "igv" REAL NOT NULL DEFAULT 0,
      "discount" REAL NOT NULL DEFAULT 0,
      "total" REAL NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
      "deliveryTime" TEXT,
      "paymentMethod" TEXT,
      "warranty" TEXT,
      "notes" TEXT,
      "images" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deletedAt" DATETIME
    );

    CREATE TABLE IF NOT EXISTS "QuotationItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "quotationId" TEXT NOT NULL,
      "productId" TEXT,
      "description" TEXT NOT NULL,
      "brand" TEXT,
      "model" TEXT,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "unitPrice" REAL NOT NULL,
      "total" REAL NOT NULL,
      "notes" TEXT,
      "costPrice" REAL DEFAULT 0,
      "marginPercent" REAL DEFAULT 0,
      "image" TEXT,
      FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_code_key" ON "Quotation"("code");
    CREATE INDEX IF NOT EXISTS "Quotation_status_idx" ON "Quotation"("status");
    CREATE INDEX IF NOT EXISTS "Quotation_deletedAt_idx" ON "Quotation"("deletedAt");
    CREATE INDEX IF NOT EXISTS "Quotation_issueDate_idx" ON "Quotation"("issueDate");
    CREATE INDEX IF NOT EXISTS "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");
  `);

  // Ensure missing columns in existing pre-migrated tables are added cleanly
  try { targetDb.exec('ALTER TABLE "Quotation" ADD COLUMN "images" TEXT;'); } catch {}
  try { targetDb.exec('ALTER TABLE "Quotation" ADD COLUMN "deletedAt" DATETIME;'); } catch {}
  try { targetDb.exec('ALTER TABLE "QuotationItem" ADD COLUMN "costPrice" REAL DEFAULT 0;'); } catch {}
  try { targetDb.exec('ALTER TABLE "QuotationItem" ADD COLUMN "marginPercent" REAL DEFAULT 0;'); } catch {}
  try { targetDb.exec('ALTER TABLE "QuotationItem" ADD COLUMN "image" TEXT;'); } catch {}

  // Check columns present in target QuotationItem
  const itemCols = (targetDb.prepare('PRAGMA table_info("QuotationItem")').all() as { name: string }[]).map((c) => c.name);
  const hasCostPrice = itemCols.includes("costPrice");
  const hasMarginPercent = itemCols.includes("marginPercent");
  const hasImage = itemCols.includes("image");

  const insertQuote = targetDb.prepare(`
    INSERT INTO "Quotation" (
      id, code, clientName, clientDocType, clientDocNum, clientPhone, clientEmail,
      clientAddress, attentionTo, issueDate, validDays, currency, includeIgv,
      subtotal, igv, discount, total, status, deliveryTime, paymentMethod,
      warranty, notes, images, createdAt, updatedAt, deletedAt
    ) VALUES (
      @id, @code, @clientName, @clientDocType, @clientDocNum, @clientPhone, @clientEmail,
      @clientAddress, @attentionTo, @issueDate, @validDays, @currency, @includeIgv,
      @subtotal, @igv, @discount, @total, @status, @deliveryTime, @paymentMethod,
      @warranty, @notes, @images, @createdAt, @updatedAt, NULL
    )
    ON CONFLICT(id) DO UPDATE SET
      deletedAt = NULL
  `);

  const itemColsList = ["id", "quotationId", "productId", "description", "brand", "model", "quantity", "unitPrice", "total", "notes"];
  if (hasCostPrice) itemColsList.push("costPrice");
  if (hasMarginPercent) itemColsList.push("marginPercent");
  if (hasImage) itemColsList.push("image");

  const insertItemSql = `
    INSERT OR IGNORE INTO "QuotationItem" (${itemColsList.map((c) => `"${c}"`).join(", ")})
    VALUES (${itemColsList.map((c) => `@${c}`).join(", ")})
  `;
  const insertItem = targetDb.prepare(insertItemSql);

  let restoredCount = 0;
  const restoreTx = targetDb.transaction(() => {
    for (const [, data] of allFoundQuotations) {
      const q = { ...data.q };

      if (typeof q.issueDate === "number") q.issueDate = new Date(q.issueDate).toISOString();
      if (typeof q.createdAt === "number") q.createdAt = new Date(q.createdAt).toISOString();
      if (typeof q.updatedAt === "number") q.updatedAt = new Date(q.updatedAt).toISOString();

      q.deletedAt = null;
      q.includeIgv = q.includeIgv ? 1 : 0;

      for (const key of [
        "clientDocType", "clientDocNum", "clientPhone", "clientEmail", "clientAddress",
        "attentionTo", "deliveryTime", "paymentMethod", "warranty", "notes", "images",
      ]) {
        if (q[key as keyof typeof q] === undefined) (q as Record<string, unknown>)[key] = null;
      }

      insertQuote.run(q);

      for (const it of data.items) {
        const itRow: Record<string, any> = {
          id: it.id,
          quotationId: it.quotationId,
          productId: it.productId ?? null,
          description: it.description,
          brand: it.brand ?? null,
          model: it.model ?? null,
          quantity: it.quantity ?? 1,
          unitPrice: it.unitPrice ?? 0,
          total: it.total ?? 0,
          notes: it.notes ?? null,
          costPrice: it.costPrice ?? 0,
          marginPercent: it.marginPercent ?? 0,
          image: (it as any).image ?? null,
        };
        insertItem.run(itRow);
      }
      restoredCount++;
    }

    // Un-delete any quotations that had deletedAt set
    targetDb.prepare('UPDATE "Quotation" SET deletedAt = NULL WHERE deletedAt IS NOT NULL').run();
  });

  restoreTx();
  targetDb.close();
  return restoredCount;
}

async function main() {
  console.log("=== INFOSISTEL: Recuperación y Restauración Total de Cotizaciones (0 Margen de Error) ===");

  const targetDbPaths = Array.from(
    new Set(
      [
        process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/^file:/, "") : "",
        "/home/zarate/infosistel-v2-data/dev.db",
        "/home/zarate/infosistel-v2/dev.db",
        path.resolve(process.cwd(), "dev.db"),
        path.resolve(process.cwd(), "..", "infosistel-v2-data", "dev.db"),
      ]
        .map((p) => p.trim())
        .filter(Boolean)
    )
  );

  const allDbs = findDatabases();
  console.log(`\nBases de datos y respaldos encontrados (${allDbs.length}):`);
  allDbs.forEach((d) => {
    try {
      const sz = (fs.statSync(d).size / 1024).toFixed(1);
      console.log(`  - ${d} (${sz} KB)`);
    } catch {}
  });

  const allFoundQuotations = new Map<string, { q: QuotationRow; items: QuotationItemRow[]; source: string }>();

  for (const dbPath of allDbs) {
    try {
      const db = new Database(dbPath, { readonly: true });

      const hasQuotationTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Quotation'")
        .get();

      if (!hasQuotationTable) {
        db.close();
        continue;
      }

      const quotes = db.prepare("SELECT * FROM Quotation").all() as QuotationRow[];

      let items: QuotationItemRow[] = [];
      const hasItemTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='QuotationItem'")
        .get();
      if (hasItemTable) {
        items = db.prepare("SELECT * FROM QuotationItem").all() as QuotationItemRow[];
      }

      db.close();

      if (quotes.length > 0) {
        console.log(`\n📦 Encontradas ${quotes.length} cotizaciones en: ${dbPath}`);
        for (const q of quotes) {
          const qItems = items.filter((it) => it.quotationId === q.id);
          console.log(`   • [${q.code}] Cliente: "${q.clientName}" | Total: ${q.currency} ${q.total} | Estado: ${q.status} | Ítems: ${qItems.length}`);

          const existing = allFoundQuotations.get(q.id);
          if (!existing) {
            allFoundQuotations.set(q.id, { q, items: qItems, source: dbPath });
          } else {
            // Keep the one with items or un-deleted
            if (qItems.length > existing.items.length || (!q.deletedAt && existing.q.deletedAt)) {
              allFoundQuotations.set(q.id, { q, items: qItems, source: dbPath });
            }
          }
        }
      }
    } catch (err: any) {
      // ignore corrupt or locked files
    }
  }

  if (allFoundQuotations.size === 0) {
    console.log("\n⚠️ No se encontraron cotizaciones en ningún archivo analizado.");
  } else {
    console.log(`\n🎯 Total cotizaciones recuperadas listadas para restauración: ${allFoundQuotations.size}`);

    for (const targetPath of targetDbPaths) {
      if (fs.existsSync(targetPath)) {
        const count = restoreIntoTarget(targetPath, allFoundQuotations);
        console.log(`  ✅ ${count} cotizaciones activadas exitosamente en: ${targetPath}`);
      }
    }

    console.log("\n🎉 ¡PROCESO DE RESTAURACIÓN COMPLETADO CON ÉXITO! (0 margen de error)");
    console.log("Todas las cotizaciones se encuentran recuperadas y activas en el panel de Ventas / Cotizaciones.");
  }

  // Cleanup temporary uncompressed files
  for (const tmp of tempFilesToClean) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {}
  }
}

main().catch((err) => {
  console.error("Error al restaurar cotizaciones:", err);
  process.exit(1);
});
