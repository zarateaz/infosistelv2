import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";

/**
 * Crea o actualiza una cuenta administradora.
 *
 * V2.5.4 — sin cuentas ni contraseñas por defecto: usuario y contraseña se
 * pasan explícitamente por argumento. Si faltan, el script falla.
 * V2.1.1 — la contraseña debe tener al menos 12 caracteres.
 *
 * Uso:
 *   npx tsx scripts/create-admin.ts <usuario> <contraseña>
 *
 * Si la cuenta ya existe, se actualiza la contraseña, se conserva el estado
 * de MFA y se incrementa tokenVersion para invalidar sesiones anteriores.
 */
async function main() {
  const [username, password] = process.argv.slice(2);

  if (!username || !password) {
    console.error("Uso: npx tsx scripts/create-admin.ts <usuario> <contraseña>");
    console.error("No hay valores por defecto: usuario y contraseña son obligatorios.");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("La contraseña debe tener al menos 12 caracteres (OWASP ASVS V2.1.1).");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const admin = await prisma.admin.upsert({
    where: { username },
    update: {
      passwordHash,
      role: "superadmin",
      // Invalida cualquier JWT emitido antes del cambio de contraseña.
      tokenVersion: { increment: 1 },
    },
    create: {
      username,
      passwordHash,
      role: "superadmin",
    },
  });

  console.log(`Usuario ${admin.username} creado/actualizado correctamente (ID ${admin.id}).`);
  console.log("MFA no se modifica: actívalo desde /taller-control/seguridad.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
