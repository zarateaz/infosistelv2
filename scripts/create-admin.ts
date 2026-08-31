/**
 * One-off CLI to create (or reset the password of) the admin account.
 * There is no self-service signup by design — admin accounts are
 * provisioned out-of-band by whoever runs this script, so it defaults to
 * "superadmin" (the Usuarios section is how a superadmin provisions
 * ordinary "admin" accounts afterward).
 *
 * Usage: npx tsx scripts/create-admin.ts <username> <password> [role]
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hashPassword } from "../src/lib/auth";

async function main() {
  const [username, password, role = "superadmin"] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: npx tsx scripts/create-admin.ts <username> <password> [role]");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }
  if (role !== "admin" && role !== "superadmin") {
    console.error('Role must be "admin" or "superadmin".');
    process.exit(1);
  }

  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const prisma = new PrismaClient({ adapter });

  const passwordHash = await hashPassword(password);
  const admin = await prisma.admin.upsert({
    where: { username },
    update: { passwordHash, role },
    create: { username, passwordHash, role },
  });

  console.log(`✓ Admin "${admin.username}" (${admin.role}) ready.`);
  await prisma.$disconnect();
}

main();
