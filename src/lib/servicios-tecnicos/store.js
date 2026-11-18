/* =====================================================================
   Guardado en el servidor (solo corre en el servidor).
   Usa un archivo JSON y una carpeta de fotos. Sirve tal cual en un VPS o
   hosting con Node.js. Si la página ya usa una base de datos (MySQL, etc.),
   solo hay que reemplazar leer() y escribir() de este archivo.
   ===================================================================== */
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { cfgPorDefecto } from './logic';

function resolverDirectorio() {
  if (process.env.SERVICIOS_TECNICOS_DIR) {
    return process.env.SERVICIOS_TECNICOS_DIR;
  }
  const vpsDataDir = '/home/zarate/infosistel-v2-data/servicios-tecnicos';
  try {
    if (fsSync.existsSync(vpsDataDir)) {
      return vpsDataDir;
    }
  } catch {}

  return path.resolve(process.env.TMPDIR || '/tmp', 'infosistel-servicios-tecnicos');
}

const DIR = resolverDirectorio();
const DB = path.join(DIR, 'db.json');
const FOTOS = path.join(DIR, 'fotos');
const RESPALDOS = path.join(DIR, 'respaldos');

/* Una sola escritura a la vez, para que dos PCs guardando al mismo tiempo no se pisen. */
let cola = Promise.resolve();
function enCola(fn) {
  const p = cola.then(fn, fn);
  cola = p.catch(() => {});
  return p;
}

async function buscarUltimoRespaldo() {
  const dirs = [RESPALDOS, '/home/zarate/infosistel-v2-data/servicios-tecnicos/respaldos'];
  for (const rDir of dirs) {
    try {
      if (!fsSync.existsSync(/*turbopackIgnore: true*/ rDir)) continue;
      const files = (await fs.readdir(/*turbopackIgnore: true*/ rDir)).filter((f) => f.startsWith('db-') && f.endsWith('.json')).sort().reverse();
      for (const f of files) {
        try {
          const content = JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ path.join(rDir, f), 'utf8'));
          if (content && Array.isArray(content.servicios) && content.servicios.length > 0) {
            return content;
          }
        } catch {}
      }
    } catch {}
  }
  return null;
}

async function leer() {
  try {
    const d = JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ DB, 'utf8'));
    let servicios = Array.isArray(d.servicios) ? d.servicios : [];

    // Si por algún motivo db.json se inició vacío, restaurar automáticamente del último respaldo
    if (servicios.length === 0) {
      const backup = await buscarUltimoRespaldo();
      if (backup && Array.isArray(backup.servicios) && backup.servicios.length > 0) {
        servicios = backup.servicios;
        // Restaurar en DB principal de forma asíncrona
        fs.writeFile(/*turbopackIgnore: true*/ DB, JSON.stringify({ ...d, servicios }, null, 2)).catch(() => {});
      }
    }

    return { cfg: { ...cfgPorDefecto(), ...(d.cfg || {}) }, servicios };
  } catch (e) {
    if (e.code === 'ENOENT') {
      const backup = await buscarUltimoRespaldo();
      if (backup) return backup;
      return { cfg: cfgPorDefecto(), servicios: [] };
    }
    throw e;
  }
}

async function escribir(d) {
  await fs.mkdir(RESPALDOS, { recursive: true });
  const tmp = DB + '.' + process.pid + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(d));
  await fs.rename(tmp, DB);
  // Un respaldo por día (se guardan los últimos 30)
  const hoy = new Date().toISOString().slice(0, 10);
  const resp = path.join(RESPALDOS, 'db-' + hoy + '.json');
  try { await fs.access(resp); } catch { await fs.copyFile(DB, resp); await limpiarRespaldos(); }
}

async function limpiarRespaldos() {
  const files = (await fs.readdir(RESPALDOS)).filter((f) => f.startsWith('db-')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 30))) await fs.unlink(path.join(RESPALDOS, f)).catch(() => {});
}

export function obtenerTodo() {
  return leer();
}

/** Lee los datos, aplica fn(datos) y guarda. Lo que devuelva fn es la respuesta. */
export function modificar(fn) {
  return enCola(async () => {
    const d = await leer();
    const r = await fn(d);
    await escribir(d);
    return r;
  });
}

/* ---------- Fotos ---------- */
const TIPOS_IMG = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function guardarFoto(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('La foto debe ser JPG, PNG o WEBP');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) throw new Error('La foto pesa más de 5 MB');
  await fs.mkdir(FOTOS, { recursive: true });
  const nombre = crypto.randomUUID() + '.' + TIPOS_IMG[m[1]];
  await fs.writeFile(path.join(FOTOS, nombre), buf);
  return '/api/servicios-tecnicos/fotos/' + nombre;
}

const NOMBRE_OK = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;
export async function leerFoto(nombre) {
  if (!NOMBRE_OK.test(nombre)) return null;
  try { return await fs.readFile(path.join(FOTOS, nombre)); } catch { return null; }
}

export async function borrarFotos(urls) {
  for (const u of urls || []) {
    const nombre = String(u).split('/').pop();
    if (NOMBRE_OK.test(nombre)) await fs.unlink(path.join(FOTOS, nombre)).catch(() => {});
  }
}
