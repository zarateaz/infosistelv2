/**
 * scripts/lab/vps/sembrar-datos-lab.ts
 *
 * Siembra datos FICTICIOS para la demo del laboratorio:
 *   - admin de laboratorio (usuario/contraseña de .env)
 *   - 1 producto con costPrice (para demostrar que no se filtra)
 *   - 1 pedido con teléfono cifrado (AES-256-GCM + índice ciego)
 *   - 1 reparación con DNI cifrado
 *
 * No usar en producción. Los datos son inventados (987654321 / 12345678).
 */
import { prisma } from "../../../src/lib/prisma";
import { hashPassword } from "../../../src/lib/auth";
import { encryptPII, blindIndex } from "../../../src/lib/crypto";
import { randomBytes } from "node:crypto";

async function main() {
  const username = process.env.LAB_ADMIN_USER || "labadmin";
  const password = process.env.LAB_ADMIN_PASSWORD || randomBytes(8).toString("hex");

  const passwordHash = await hashPassword(password);
  await prisma.admin.upsert({
    where: { username },
    update: { passwordHash, role: "superadmin", totpEnabled: false, totpSecret: null },
    create: { username, passwordHash, role: "superadmin" },
  });

  await prisma.category.upsert({
    where: { name: "PERIFÉRICOS" },
    update: {},
    create: { name: "PERIFÉRICOS" },
  });

  const product = await prisma.product.upsert({
    where: { itemNumber: 9001 },
    update: {
      description: "Producto ficticio del laboratorio para la prueba de mínimo privilegio.",
    },
    create: {
      itemNumber: 9001,
      name: "Mouse Inalámbrico (Lab)",
      category: "PERIFÉRICOS",
      description: "Producto ficticio del laboratorio para la prueba de mínimo privilegio.",
      price: 50,
      costPrice: 30,
      stock: 20,
      isFeatured: true,
    },
  });

  const phone = "987654321";
  let order = await prisma.order.findFirst({ where: { customerName: "Cliente Lab" } });
  if (!order) {
    order = await prisma.order.create({
      data: {
        customerName: "Cliente Lab",
        customerPhone: encryptPII(phone),
        customerPhoneIndex: blindIndex(phone),
        total: product.price,
        items: {
          create: [
            {
              productId: product.id,
              name: product.name,
              category: product.category,
              quantity: 1,
              unitPrice: product.price,
            },
          ],
        },
      },
    });
  }

  const dni = "12345678";
  const repair = await prisma.repair.upsert({
    where: { code: "LAB-001" },
    update: {
      dniEncrypted: encryptPII(dni),
      dniIndex: blindIndex(dni),
    },
    create: {
      code: "LAB-001",
      dniEncrypted: encryptPII(dni),
      dniIndex: blindIndex(dni),
      equipment: "Laptop de laboratorio",
      problem: "Equipo ficticio para demostrar cifrado de PII en reposo.",
      progress: 40,
      statusText: "En diagnóstico",
    },
  });

  console.log("");
  console.log("=== DATOS DE LABORATORIO ===");
  console.log(`Admin:      ${username} / ${password}`);
  console.log(`Producto:   id=${product.id} itemNumber=${product.itemNumber} precio=${product.price} costPrice=${product.costPrice}`);
  console.log(`Pedido:     id=${order.id} telefono_plano=${phone} total=${order.total}`);
  console.log(`Reparación: code=${repair.code} dni_plano=${dni}`);
  console.log("");
  console.log("Para la prueba de PII en el VPS:");
  console.log(`  sqlite3 \"$DATABASE_URL\" \"SELECT customerPhone, customerPhoneIndex FROM \\\"Order\\\";\"`);
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
