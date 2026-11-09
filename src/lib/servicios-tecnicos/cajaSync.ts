/* =====================================================================
   Sincronización de Pagos de Servicios Técnicos con Caja (INFOSISTEL)
   Registra automáticamente cada adelanto, pago parcial o liquidación final
   en la tabla CashboxTransaction para que aparezca en /taller-control/caja
   con el método exacto (EFECTIVO, YAPE 1, YAPE 2) y todos los detalles.
   ===================================================================== */

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { aMetodoCaja, code } from "./logic";

/**
 * Convierte una fecha a UTC a medianoche basada en la zona horaria de Perú
 * para alinearse perfectamente con la lógica de fechas de Caja.
 */
function obtenerFechaCaja(fechaStr?: string | Date): Date {
  const d = fechaStr ? new Date(fechaStr) : new Date();
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.format(d).split("-").map(Number);
    const year = parts[0] || d.getFullYear();
    const month = parts[1] || d.getMonth() + 1;
    const day = parts[2] || d.getDate();
    return new Date(Date.UTC(year, month - 1, day));
  } catch {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
}

interface SincronizarParams {
  servicio: any;
  pago: any;
  cfg?: any;
}

/**
 * Registra un pago de servicio técnico como movimiento de INGRESO en Caja.
 * Devuelve el ID generado en CashboxTransaction para guardarlo como referencia.
 */
export async function sincronizarIngresoCaja({
  servicio,
  pago,
  cfg,
}: SincronizarParams): Promise<string | null> {
  if (!pago || !(Number(pago.monto) > 0)) return null;

  try {
    const metodoCaja = aMetodoCaja(pago.metodo);
    const osCode = cfg ? code(cfg, servicio.num) : `OS-${String(servicio.num).padStart(4, "0")}`;
    const clienteNombre = String(servicio.cliente?.nombre || "CLIENTE").trim();

    // Descripción clara para la tabla de movimientos (máx 200 car.)
    const description = `Servicio ${osCode} — ${clienteNombre}`.slice(0, 200);

    // Notas detalladas con tipo de equipo, concepto, N° de operación y celular (máx 500 car.)
    const eq = `${servicio.equipo?.tipo || "Equipo"} ${servicio.equipo?.marca || ""}${
      servicio.equipo?.modelo ? " " + servicio.equipo.modelo : ""
    }`.trim();

    const notasArray = [
      pago.nota || "Cobro de servicio",
      eq,
      pago.op ? `Op. #${pago.op}` : null,
      servicio.cliente?.cel ? `Cel: ${servicio.cliente.cel}` : null,
      servicio.falla ? `Falla: ${servicio.falla.slice(0, 60)}` : null,
    ].filter(Boolean);

    const notes = notasArray.join(" · ").slice(0, 500);

    const tx = await prisma.cashboxTransaction.create({
      data: {
        date: obtenerFechaCaja(pago.fecha),
        type: "INCOME",
        amount: Number(pago.monto),
        paymentMethod: metodoCaja,
        description,
        notes: notes || null,
      },
    });

    try {
      revalidatePath("/taller-control/caja");
      revalidatePath("/taller-control/papelera");
    } catch {
      // Ignorar si se ejecuta fuera de ciclo de request de Next.js
    }

    return tx.id;
  } catch (error) {
    console.error("Error sincronizando pago de servicio técnico con Caja:", error);
    return null;
  }
}

/**
 * Elimina un movimiento de Caja (soft delete hacia Papelera) si el pago fue anulado.
 */
export async function eliminarIngresoCaja(cajaId?: string | null): Promise<void> {
  if (!cajaId) return;
  try {
    await prisma.cashboxTransaction.update({
      where: { id: cajaId },
      data: { deletedAt: new Date() },
    });
    try {
      revalidatePath("/taller-control/caja");
      revalidatePath("/taller-control/papelera");
    } catch {}
  } catch (error) {
    console.error("Error eliminando movimiento en Caja:", error);
  }
}

/**
 * Elimina todos los movimientos de Caja asociados a los pagos de un servicio.
 */
export async function eliminarIngresosDeServicio(servicio: any): Promise<void> {
  if (!servicio || !Array.isArray(servicio.pagos)) return;
  for (const pago of servicio.pagos) {
    if (pago.cajaId) {
      await eliminarIngresoCaja(pago.cajaId);
    }
  }
}

/**
 * Sincroniza pagos históricos o existentes que aún no tengan ID de Caja asignado.
 */
export async function sincronizarPagosFaltantes(
  servicios: any[],
  cfg: any
): Promise<number> {
  let sincronizados = 0;
  for (const s of servicios || []) {
    for (const p of s.pagos || []) {
      if (!p.cajaId && Number(p.monto) > 0) {
        const id = await sincronizarIngresoCaja({ servicio: s, pago: p, cfg });
        if (id) {
          p.cajaId = id;
          sincronizados++;
        }
      }
    }
  }
  return sincronizados;
}
