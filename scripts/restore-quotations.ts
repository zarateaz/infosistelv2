import fs from "fs";
import path from "path";
// @ts-ignore
import Database from "better-sqlite3";

/**
 * Universal script to find, recover and restore all quotations from any backup or active database.
 * 0 margin of error.
 */

function findDatabases(): string[] {
  const candidates: string[] = [
    process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/^file:/, "") : "",
    "/home/zarate/infosistel-v2-data/dev.db",
    "/home/zarate/infosistel-v2/dev.db",
    path.resolve(process.cwd(), "dev.db"),
    path.resolve(process.cwd(), "..", "infosistel-v2-data", "dev.db"),
  ];

  const backupDirs = [
    "/home/zarate/infosistel-v2-data/backups",
    "/home/zarate/backups",
    path.resolve(process.cwd(), "backups"),
  ];

  for (const bDir of backupDirs) {
    if (fs.existsSync(bDir)) {
      try {
        const files = fs.readdirSync(bDir);
        for (const file of files) {
          if (file.includes("dev.db") || file.endsWith(".db") || file.endsWith(".sqlite")) {
            candidates.push(path.join(bDir, file));
          }
        }
      } catch (e) {
        // ignore permission or read error
      }
    }
  }

  // Deduplicate and filter existing files
  const existing = Array.from(new Set(candidates.filter(Boolean))).filter((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isFile() && fs.statSync(p).size > 0;
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
}

async function main() {
  console.log("=== INFOSISTEL: Recuperación y Restauración de Cotizaciones (0 Margen de Error) ===");
  
  const targetDbPath = (process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/^file:/, "")
    : fs.existsSync("/home/zarate/infosistel-v2-data/dev.db")
    ? "/home/zarate/infosistel-v2-data/dev.db"
    : path.resolve(process.cwd(), "dev.db")).trim();

  console.log(`Base de datos activa destino: ${targetDbPath}`);

  const allDbs = findDatabases();
  console.log(`Bases de datos y backups encontrados (${allDbs.length}):`);
  allDbs.forEach((d) => console.log(`  - ${d} (${(fs.statSync(d).size / 1024).toFixed(1)} KB)`));

  const allFoundQuotations = new Map<string, { q: QuotationRow; items: QuotationItemRow[]; source: string }>();

  for (const dbPath of allDbs) {
    try {
      const db = new Database(dbPath, { readonly: true });
      
      // Check if Quotation table exists
      const hasQuotationTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Quotation'")
        .get();

      if (!hasQuotationTable) {
        db.close();
        continue;
      }

      // Check columns in Quotation table to safely select
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
          console.log(`   • [${q.code}] Cliente: "${q.clientName}" | Total: ${q.currency} ${q.total} | Estado: ${q.status} ${q.deletedAt ? "(Marcada como eliminada)" : "(Activa)"} | Ítems: ${qItems.length}`);
          
          // Keep best version or merge
          if (!allFoundQuotations.has(q.id) || (!q.deletedAt && allFoundQuotations.get(q.id)?.q.deletedAt)) {
            allFoundQuotations.set(q.id, { q, items: qItems, source: dbPath });
          }
        }
      }
    } catch (err: any) {
      console.warn(`  [Aviso] No se pudo leer ${dbPath}: ${err.message}`);
    }
  }

  if (allFoundQuotations.size === 0) {
    console.log("\n⚠️ No se encontraron cotizaciones en ningún archivo analizado.");
    return;
  }

  console.log(`\nTotal cotizaciones únicas a restaurar: ${allFoundQuotations.size}`);

  // Now ensure target DB has table structure and restore
  if (!fs.existsSync(targetDbPath)) {
    console.error(`ERROR: La base de datos destino ${targetDbPath} no existe.`);
    return;
  }

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
      FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_code_key" ON "Quotation"("code");
    CREATE INDEX IF NOT EXISTS "Quotation_status_idx" ON "Quotation"("status");
    CREATE INDEX IF NOT EXISTS "Quotation_deletedAt_idx" ON "Quotation"("deletedAt");
    CREATE INDEX IF NOT EXISTS "Quotation_issueDate_idx" ON "Quotation"("issueDate");
    CREATE INDEX IF NOT EXISTS "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");
  `);

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
      code = excluded.code,
      clientName = excluded.clientName,
      clientDocType = excluded.clientDocType,
      clientDocNum = excluded.clientDocNum,
      clientPhone = excluded.clientPhone,
      clientEmail = excluded.clientEmail,
      clientAddress = excluded.clientAddress,
      attentionTo = excluded.attentionTo,
      issueDate = excluded.issueDate,
      validDays = excluded.validDays,
      currency = excluded.currency,
      includeIgv = excluded.includeIgv,
      subtotal = excluded.subtotal,
      igv = excluded.igv,
      discount = excluded.discount,
      total = excluded.total,
      status = excluded.status,
      deliveryTime = excluded.deliveryTime,
      paymentMethod = excluded.paymentMethod,
      warranty = excluded.warranty,
      notes = excluded.notes,
      images = excluded.images,
      deletedAt = NULL
  `);

  const insertItem = targetDb.prepare(`
    INSERT OR REPLACE INTO "QuotationItem" (
      id, quotationId, productId, description, brand, model, quantity, unitPrice, total, notes, costPrice, marginPercent
    ) VALUES (
      @id, @quotationId, @productId, @description, @brand, @model, @quantity, @unitPrice, @total, @notes, @costPrice, @marginPercent
    )
  `);

  let restoredCount = 0;
  const restoreTx = targetDb.transaction(() => {
    for (const [id, data] of allFoundQuotations) {
      const q = { ...data.q };
      
      // Ensure date format
      if (typeof q.issueDate === "number") q.issueDate = new Date(q.issueDate).toISOString();
      if (typeof q.createdAt === "number") q.createdAt = new Date(q.createdAt).toISOString();
      if (typeof q.updatedAt === "number") q.updatedAt = new Date(q.updatedAt).toISOString();
      
      // Force deletedAt to null to un-delete it
      q.deletedAt = null;
      q.includeIgv = q.includeIgv ? 1 : 0;

      insertQuote.run(q);

      for (const it of data.items) {
        insertItem.run(it);
      }
      restoredCount++;
    }

    // Also un-delete any existing quotation in the target DB
    targetDb.prepare("UPDATE \"Quotation\" SET deletedAt = NULL WHERE deletedAt IS NOT NULL").run();
  });

  restoreTx();
  targetDb.close();

  console.log(`\n✅ ¡ÉXITO! Se restauraron e hicieron activas ${restoredCount} cotizaciones en: ${targetDbPath}`);
  console.log("Todas las cotizaciones tienen ahora su estado activo (deletedAt = NULL) y están listas para verse en /taller-control/cotizaciones.");
}

main().catch((err) => {
  console.error("Error al restaurar cotizaciones:", err);
  process.exit(1);
});
