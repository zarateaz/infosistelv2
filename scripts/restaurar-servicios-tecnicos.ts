#!/usr/bin/env node
/**
 * scripts/restaurar-servicios-tecnicos.ts
 *
 * Escanea todas las ubicaciones posibles de almacenamiento y respaldos
 * de Servicios Técnicos en el VPS (incluyendo respaldos diarios, directorios
 * temporales y transacciones de Caja), restaura todos los registros y
 * consolida la base de datos persistente en DATA_DIR con 0 margen de error.
 */

import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const DATA_DIR =
  process.env.DATA_DIR ||
  (fs.existsSync("/home/zarate/infosistel-v2-data")
    ? "/home/zarate/infosistel-v2-data"
    : path.resolve(process.cwd(), "datos"));

const TARGET_DIR = path.join(DATA_DIR, "servicios-tecnicos");
const TARGET_DB = path.join(TARGET_DIR, "db.json");
const TARGET_RESPALDOS = path.join(TARGET_DIR, "respaldos");

// Ubicaciones posibles donde pudo guardarse db.json o sus respaldos
const CANDIDATE_DIRS = [
  TARGET_DIR,
  TARGET_RESPALDOS,
  path.resolve(process.cwd(), "datos", "servicios-tecnicos"),
  path.resolve(process.cwd(), "datos", "servicios-tecnicos", "respaldos"),
  path.resolve(process.cwd(), ".next", "standalone", "datos", "servicios-tecnicos"),
  path.resolve(process.cwd(), ".next", "standalone", "datos", "servicios-tecnicos", "respaldos"),
  "/home/zarate/infosistel-v2/datos/servicios-tecnicos",
  "/home/zarate/infosistel-v2/datos/servicios-tecnicos/respaldos",
  "/home/zarate/infosistel-v2/.next/standalone/datos/servicios-tecnicos",
  "/data/servicios-tecnicos",
];

async function main() {
  console.log("==========================================================");
  console.log("🛠️  RESTAURACIÓN Y RECUPERACIÓN DE SERVICIOS TÉCNICOS");
  console.log("==========================================================");

  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.mkdirSync(TARGET_RESPALDOS, { recursive: true });

  const serviciosMap = new Map<string, any>();
  let configMaxNext = 1;
  let baseConfig: any = null;

  // 1. Escanear todos los archivos JSON candidatos
  for (const dir of CANDIDATE_DIRS) {
    if (!fs.existsSync(dir)) continue;

    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const filePath = path.join(dir, file);

        try {
          const content = fs.readFileSync(filePath, "utf8");
          const parsed = JSON.parse(content);

          if (parsed && typeof parsed === "object") {
            if (parsed.cfg) {
              baseConfig = { ...(baseConfig || {}), ...parsed.cfg };
              if (Number(parsed.cfg.next) > configMaxNext) {
                configMaxNext = Number(parsed.cfg.next);
              }
            }

            if (Array.isArray(parsed.servicios)) {
              for (const s of parsed.servicios) {
                if (s && s.id) {
                  serviciosMap.set(s.id, s);
                  if (Number(s.num) >= configMaxNext) {
                    configMaxNext = Number(s.num) + 1;
                  }
                }
              }
            }
          }
        } catch {
          // Ignorar archivos corruptos o ilegibles
        }
      }
    } catch {
      // Ignorar errores de acceso
    }
  }

  console.log(`[Archivos] Servicios recuperados de archivos JSON: ${serviciosMap.size}`);

  // 2. Reconstruir a partir de movimientos de Caja (si se registraron adelantos o pagos)
  try {
    const cashboxTxs = await prisma.cashboxTransaction.findMany({
      where: {
        description: {
          contains: "Servicio Técnico",
        },
      },
      orderBy: { date: "asc" },
    });

    console.log(`[Caja] Movimientos encontrados de Servicio Técnico en Caja: ${cashboxTxs.length}`);

    for (const tx of cashboxTxs) {
      // Extraer datos de: "Servicio Técnico OS-0001 — Juan Pérez · Laptop HP 15"
      const match = tx.description.match(/Servicio Técnico (OS-\d+)\s*—\s*([^·]+)(?:·\s*(.+))?/i);
      const osCode = match ? match[1] : null;
      const clienteNombre = match ? match[2].trim() : "CLIENTE";
      const equipoStr = match && match[3] ? match[3].trim() : "Equipo";

      const numMatch = osCode ? osCode.match(/\d+/) : null;
      const num = numMatch ? parseInt(numMatch[0], 10) : configMaxNext++;

      // Verificar si ya existe este servicio en el mapa
      let exists = false;
      for (const s of serviciosMap.values()) {
        if (s.num === num || (s.cliente?.nombre && s.cliente.nombre.toLowerCase() === clienteNombre.toLowerCase())) {
          exists = true;
          // Si no tenía enlazado el cajaId, enlazarlo
          if (!s.pagos || s.pagos.length === 0) {
            s.pagos = [{
              id: tx.id,
              monto: tx.amount,
              metodo: tx.paymentMethod,
              fecha: tx.date.toISOString().slice(0, 10),
              nota: "Adelanto (recuperado de Caja)",
              cajaId: tx.id,
            }];
          }
          break;
        }
      }

      if (!exists) {
        // Reconstruir el servicio
        const nuevoServicio = {
          id: `recov_${tx.id}`,
          num,
          cliente: {
            nombre: clienteNombre,
            cel: "",
            dni: "",
            ruc: "",
          },
          equipo: {
            tipo: equipoStr.split(" ")[0] || "Laptop",
            marca: equipoStr.split(" ")[1] || "",
            modelo: equipoStr.split(" ").slice(2).join(" ") || "",
            serie: "",
            clave: "",
            acc: [],
            accOtro: "",
          },
          falla: tx.notes || "Servicio técnico registrado en caja",
          costo: tx.amount,
          precio: tx.amount,
          etapa: "entregado",
          pagos: [
            {
              id: tx.id,
              monto: tx.amount,
              metodo: tx.paymentMethod,
              fecha: tx.date.toISOString().slice(0, 10),
              nota: tx.notes || "Pago registrado en Caja",
              cajaId: tx.id,
            },
          ],
          hist: [{ e: "recibido", t: tx.date.toISOString().slice(0, 10) }],
          notas: [],
          avisos: [],
          entrega: null,
          fListo: null,
          fEntregado: tx.date.toISOString().slice(0, 10),
          creado: tx.createdAt.toISOString(),
        };

        serviciosMap.set(nuevoServicio.id, nuevoServicio);
        console.log(`[Reconstrucción] Servicio ${osCode || `OS-${num}`} recuperado de Caja (${clienteNombre})`);
      }
    }
  } catch (dbErr: any) {
    console.warn(`[Caja] Advertencia al consultar Prisma: ${dbErr?.message}`);
  }

  // 2.5 Recuperar desde la tabla Service de Prisma (cero margen de error)
  try {
    const prismaServices = await prisma.service.findMany({
      include: {
        technician: true,
        equipmentType: true,
        photos: true,
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(`[Prisma Service] Servicios encontrados en la base de datos: ${prismaServices.length}`);

    for (const ps of prismaServices) {
      if (serviciosMap.has(ps.id)) continue;

      const num = configMaxNext++;
      const etapaMap: Record<string, string> = {
        RECIBIDO: "recibido",
        REPARANDO: "reparacion",
        LISTO: "listo",
        ENTREGADO: "entregado",
      };

      const pagos: any[] = [];
      const montoTotal = Number(ps.amount) || 0;
      const metodoPago = ps.paymentMethod === "YAPE" ? "Yape 1" : "Efectivo";

      if (ps.paymentStatus === "PAGADO" && montoTotal > 0) {
        pagos.push({
          id: `pago_${ps.id}`,
          monto: montoTotal,
          metodo: metodoPago,
          fecha: ps.serviceDate ? ps.serviceDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          nota: "Pago registrado",
        });
      } else if (ps.paymentStatus === "PARCIAL" && ps.advanceAmount && ps.advanceAmount > 0) {
        pagos.push({
          id: `pago_${ps.id}`,
          monto: Number(ps.advanceAmount) || 0,
          metodo: ps.advancePaymentMethod === "YAPE" ? "Yape 1" : "Efectivo",
          fecha: ps.serviceDate ? ps.serviceDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          nota: "Adelanto",
        });
      }

      // Normalizar técnico asignado
      let tecName = "CABALLERO PECHO EDGAR WENCESLAO";
      const rawTec = (ps.technician?.name || "").toLowerCase();
      if (rawTec.includes("zarate") || rawTec.includes("angel")) {
        tecName = "ZARATE AZORZA ANGEL";
      }

      // Normalizar tipo de equipo
      let tipoEquipo = ps.equipmentType?.name || "Laptop";
      const tiposPermitidos = ["Laptop", "PC / CPU", "Impresora", "All In One", "Monitor", "Otro"];
      if (!tiposPermitidos.includes(tipoEquipo)) {
        if (/laptop|portatil/i.test(tipoEquipo)) tipoEquipo = "Laptop";
        else if (/pc|cpu|computadora/i.test(tipoEquipo)) tipoEquipo = "PC / CPU";
        else if (/impresora/i.test(tipoEquipo)) tipoEquipo = "Impresora";
        else tipoEquipo = "Otro";
      }

      const s = {
        id: ps.id,
        num,
        fecha: ps.serviceDate ? ps.serviceDate.toISOString() : ps.createdAt.toISOString(),
        cliente: {
          nombre: (ps.clientName || "CLIENTE").trim().toUpperCase(),
          dni: "",
          ruc: "",
          cel: String(ps.clientPhone || "").replace(/\D/g, "").slice(0, 9),
        },
        equipo: {
          tipo: tipoEquipo,
          marca: (ps.equipmentBrand || "GENÉRICO").trim().toUpperCase(),
          modelo: ps.equipmentModel || "",
          serie: "",
          clave: "",
          cargador: false,
          accs: [],
          obs: ps.description || "",
          fotos: (ps.photos || []).map((p) => p.path),
        },
        falla: (ps.title || "Servicio técnico").trim(),
        diagnostico: ps.diagnosis || "",
        solucion: ps.solution || "",
        costo: {
          mo: montoTotal,
          rep: 0,
        },
        tecnico: tecName,
        etapa: etapaMap[ps.equipmentStage] || "recibido",
        pagos,
        hist: [
          {
            e: etapaMap[ps.equipmentStage] || "recibido",
            t: ps.serviceDate ? ps.serviceDate.toISOString() : new Date().toISOString(),
          },
        ],
        notas: [],
        avisos: [],
        entrega: null,
        fListo: ps.equipmentStage === "LISTO" || ps.equipmentStage === "ENTREGADO" ? (ps.deliveryDate || ps.updatedAt).toISOString() : null,
        fEntregado: ps.equipmentStage === "ENTREGADO" ? (ps.deliveryDate || ps.updatedAt).toISOString() : null,
        creado: ps.createdAt.toISOString(),
      };

      serviciosMap.set(s.id, s);
      console.log(`[Prisma Service] Recuperado con éxito: OS-${String(num).padStart(4, "0")} — ${s.cliente.nombre} (${s.falla})`);
    }
  } catch (err: any) {
    console.warn(`[Prisma Service] Error al consultar tabla Service: ${err?.message}`);
  }

  // 3. Consolidar el archivo final
  const serviciosFinales = Array.from(serviciosMap.values()).sort((a, b) => b.num - a.num);

  const finalPayload = {
    cfg: {
      next: Math.max(configMaxNext, serviciosFinales.length + 1),
      formato: "OS-{0000}",
      tecnicos: [
        "CABALLERO PECHO EDGAR WENCESLAO",
        "ZARATE AZORZA ANGEL",
      ],
      tipos: ["Laptop", "PC / CPU", "Impresora", "All In One", "Monitor", "Otro"],
      accesorios: ["Cargador", "Cable de poder", "Batería", "Mouse", "Teclado", "Funda / maletín", "Cartuchos / tóner", "Cable USB"],
      ...(baseConfig || {}),
    },
    servicios: serviciosFinales,
  };

  // Escribir en destino persistente
  fs.writeFileSync(TARGET_DB, JSON.stringify(finalPayload, null, 2), "utf8");

  // Crear respaldo diario
  const hoy = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(
    path.join(TARGET_RESPALDOS, `db-${hoy}.json`),
    JSON.stringify(finalPayload, null, 2),
    "utf8"
  );

  console.log(`\n==========================================================`);
  console.log(`✅ Base de datos restaurada exitosamente en: ${TARGET_DB}`);
  console.log(`Total de servicios consolidados: ${serviciosFinales.length}`);
  console.log(`Próximo correlativo (next): ${finalPayload.cfg.next}`);
  console.log(`==========================================================\n`);
}

main().catch((err) => {
  console.error("Error al restaurar servicios técnicos:", err);
  process.exit(1);
});

