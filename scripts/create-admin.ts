import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";

const prisma = new PrismaClient();

async function main() {
  const username = "zarate";
  const password = "2026@sistel1";

  const passwordHash = await hashPassword(password);

  const admin = await prisma.admin.upsert({
    where: { username },
    update: {
      passwordHash,
      totpEnabled: false,
      totpSecret: null
    },
    create: {
      username,
      passwordHash,
      role: "superadmin",
    },
  });

  console.log(`User ${admin.username} created/updated successfully with ID ${admin.id}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
