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

    console.log(`Clientes totales en base de datos: ${res.totalClientsChecked}`);
    console.log(`Clientes con deuda o vencimiento (elegibles): ${res.eligibleTotal}`);
    console.log(`  - Deudores (vencidos): ${res.eligibleOverdue}`);
    console.log(`  - Vencen hoy o mañana: ${res.eligibleTodayOrTomorrow}`);
    console.log(`Mensajes enviados exitosamente: ${res.sentCount}`);
    console.log(`Omitidos (ya pagaron / al día): ${res.skippedPaid}`);
    console.log(`Omitidos (ya se les avisó hoy): ${res.skippedAlreadySent}`);
    console.log(`Fallos / Gateway offline: ${res.failedCount}`);

    if (res.details.length > 0) {
      console.log(`\nDetalle por cliente:`);
      for (const d of res.details) {
        const timeLabel =
          d.daysDiff === 1
            ? "Vence mañana"
            : d.daysDiff === 0
              ? "Vence HOY"
              : d.daysDiff < 0
                ? `Vencido hace ${Math.abs(d.daysDiff)} días`
                : `Vence en ${d.daysDiff} días`;
        console.log(
          ` - [${d.status}] ${d.clientName} (${d.whatsapp}) | ${d.unpaidMonthsCount} mes(es) | Deuda: S/. ${d.totalDebt.toFixed(2)} | ${timeLabel} ${d.error ? `-> Error: ${d.error}` : ""}`
        );
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

