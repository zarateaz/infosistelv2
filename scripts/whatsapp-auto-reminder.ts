#!/usr/bin/env node
/**
 * scripts/whatsapp-auto-reminder.ts
 *
 * Tarea automática programable en cron (Linux VPS) para enviar recordatorios
 * preventivos por WhatsApp 1 día antes a los clientes de internet.
 *
 * Uso manual / prueba:
 *   node --env-file=.env ./node_modules/.bin/tsx scripts/whatsapp-auto-reminder.ts
 *   node --env-file=.env ./node_modules/.bin/tsx scripts/whatsapp-auto-reminder.ts --dry-run
 *
 * En crontab:
 *   0 9 * * * cd /home/zarate/infosistel-v2 && node --env-file=.env ./node_modules/.bin/tsx scripts/whatsapp-auto-reminder.ts >> /home/zarate/infosistel-v2-data/whatsapp-reminder.log 2>&1
 */

import { runAutomatedInternetReminders } from "../src/lib/whatsappAutoNotifier";

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const phoneArg =
    process.argv.find((a) => a.startsWith("--phone="))?.split("=")[1] ||
    (process.argv.includes("--phone")
      ? process.argv[process.argv.indexOf("--phone") + 1]
      : undefined);

  const now = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "full",
    timeStyle: "medium",
  }).format(new Date());

  console.log(`\n======================================================`);
  console.log(`[INFOSISTEL] Recordatorios Automáticos de Internet`);
  console.log(`Fecha/Hora Perú: ${now}`);
  console.log(`Modo: ${isDryRun ? "SIMULACIÓN (--dry-run)" : "ENVÍO REAL"}`);
  if (phoneArg) console.log(`Filtro por teléfono: ${phoneArg}`);
  if (force) console.log(`Forzar envío (--force): SÍ (ignora si ya se avisó hoy o fecha no coincidente)`);
  console.log(`======================================================\n`);

  try {
    const res = await runAutomatedInternetReminders({
      dryRun: isDryRun,
      includeDueToday: true,
      targetPhone: phoneArg,
      force,
    });

    console.log(`Clientes totales revisados: ${res.totalClientsChecked}`);
    console.log(`Clientes elegibles (vencen mañana/hoy): ${res.eligibleTomorrow}`);
    console.log(`Mensajes enviados exitosamente: ${res.sentCount}`);
    console.log(`Omitidos (ya pagaron): ${res.skippedPaid}`);
    console.log(`Omitidos (ya se les avisó hoy): ${res.skippedAlreadySent}`);
    console.log(`Fallos / Gateway offline: ${res.failedCount}`);

    if (res.details.length > 0) {
      console.log(`\nDetalle por cliente:`);
      for (const d of res.details) {
        console.log(` - [${d.status}] ${d.clientName} (${d.whatsapp}) | Vence: ${d.dueDate} (${d.daysDiff === 1 ? "Mañana" : d.daysDiff === 0 ? "Hoy" : `${d.daysDiff} días`}) ${d.error ? `-> Error: ${d.error}` : ""}`);
      }
    }

    console.log(`\nProceso completado exitosamente.\n`);
  } catch (error: any) {
    console.error(`\n❌ Error fatal al ejecutar recordatorios:`, error);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

