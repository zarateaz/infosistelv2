/**
 * Fotos de REFERENCIA de cada producto: las fotos reales que el admin toma en la
 * tienda al escanear (producto en la mano, empaque, etiqueta de precio...).
 *
 * Sirven para que la IA compare una foto nueva contra fotos del MISMO tipo
 * (tomadas igual, con la misma luz) en vez de contra fotos de catálogo de internet,
 * que es donde se confundía con productos de empaque parecido.
 *
 * - No necesitan cambios en la base de datos: viven en disco, en
 *   <carpeta-persistente>/products-ref/<productId>/<uuid>.webp
 * - NO son públicas (la ruta /img/products solo sirve archivos sueltos).
 * - Se guardan primero como "pendientes" y solo se asignan a un producto cuando
 *   el admin CONFIRMA (guardar / sumar stock), para que un error de la IA nunca
 *   contamine las referencias.
 */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm, stat, unlink, writeFile, readFile, realpath } from "node:fs/promises";
import sharp from "sharp";

const MAX_REFS_PER_PRODUCT = 4;
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PRODUCT_ID_RE = /^[A-Za-z0-9_-]{6,40}$/;

let rootPromise: Promise<string> | null = null;

/** Resolves a PERSISTENT, non-public directory for reference photos. */
async function resolveRoot(): Promise<string> {
  if (process.env.PRODUCT_REF_DIR) return process.env.PRODUCT_REF_DIR;
  const uploadDir = process.env.PRODUCT_IMAGES_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "img", "products");
  try {
    // On the VPS public/img/products is a symlink to <DATA_DIR>/uploads/products → use <DATA_DIR>/uploads/products-ref
    const real = await realpath(/*turbopackIgnore: true*/ uploadDir);
    if (!real.split(path.sep).includes("public")) return path.join(/*turbopackIgnore: true*/ path.dirname(real), "products-ref");
  } catch {}
  const vpsData = "/home/zarate/infosistel-v2-data/uploads";
  try {
    if ((await stat(/*turbopackIgnore: true*/ vpsData)).isDirectory()) return path.join(/*turbopackIgnore: true*/ vpsData, "products-ref");
  } catch {}
  // Local development: outside /public so it is never served
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "products-ref");
}

function getRoot(): Promise<string> {
  rootPromise ??= resolveRoot();
  return rootPromise;
}

async function pendingDir() {
  const dir = path.join(/*turbopackIgnore: true*/ await getRoot(), "_pending");
  await mkdir(dir, { recursive: true });
  return dir;
}

async function productDir(productId: string) {
  if (!PRODUCT_ID_RE.test(productId)) throw new Error("invalid product id");
  return path.join(/*turbopackIgnore: true*/ await getRoot(), productId);
}

/** Saves one admin photo (raw image buffer) as a pending reference. Returns its token. */
export async function savePendingRefPhoto(buffer: Buffer): Promise<string | null> {
  try {
    const token = randomUUID();
    const webp = await sharp(buffer)
      .rotate()
      .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    await writeFile(path.join(/*turbopackIgnore: true*/ await pendingDir(), `${token}.webp`), webp);
    return token;
  } catch (err) {
    console.error("[refPhotos] savePendingRefPhoto failed:", err);
    return null;
  }
}

/** Moves confirmed pending photos to the product (keeps the newest MAX_REFS_PER_PRODUCT). */
export async function attachRefPhotos(productId: string, tokens: unknown): Promise<void> {
  if (!Array.isArray(tokens) || tokens.length === 0) return;
  try {
    const valid = tokens.filter((t): t is string => typeof t === "string" && TOKEN_RE.test(t)).slice(0, 6);
    if (valid.length === 0) return;
    const src = await pendingDir();
    const dst = await productDir(productId);
    await mkdir(dst, { recursive: true });
    for (const t of valid) {
      await rename(path.join(/*turbopackIgnore: true*/ src, `${t}.webp`), path.join(/*turbopackIgnore: true*/ dst, `${t}.webp`)).catch(() => {});
    }
    await pruneDir(dst);
    await cleanupPending();
  } catch (err) {
    console.error("[refPhotos] attachRefPhotos failed:", err);
  }
}

async function listWithTimes(dir: string): Promise<{ file: string; mtime: number }[]> {
  try {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".webp"));
    const withTimes = await Promise.all(
      files.map(async (f) => ({ file: f, mtime: (await stat(path.join(/*turbopackIgnore: true*/ dir, f))).mtimeMs }))
    );
    return withTimes.sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

async function pruneDir(dir: string) {
  const files = await listWithTimes(dir);
  await Promise.all(files.slice(MAX_REFS_PER_PRODUCT).map((f) => unlink(path.join(/*turbopackIgnore: true*/ dir, f.file)).catch(() => {})));
}

async function cleanupPending() {
  const dir = await pendingDir();
  const now = Date.now();
  const files = await listWithTimes(dir);
  await Promise.all(
    files.filter((f) => now - f.mtime > PENDING_TTL_MS).map((f) => unlink(path.join(/*turbopackIgnore: true*/ dir, f.file)).catch(() => {}))
  );
}

/** Newest reference photos of a product as small base64 JPEGs for the vision model. */
export async function loadRefThumbs(productId: string, max = 2, size = 448): Promise<string[]> {
  try {
    const dir = await productDir(productId);
    const files = (await listWithTimes(dir)).slice(0, max);
    const out: string[] = [];
    for (const f of files) {
      try {
        const jpg = await sharp(await readFile(path.join(/*turbopackIgnore: true*/ dir, f.file)))
          .resize(size, size, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 72 })
          .toBuffer();
        out.push(jpg.toString("base64"));
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}

/** Number of reference photos a product has. */
export async function countRefPhotos(productId: string): Promise<number> {
  try {
    return (await listWithTimes(await productDir(productId))).length;
  } catch {
    return 0;
  }
}

/** On merge: move the reference photos of the removed products to the kept one. */
export async function moveRefPhotos(fromIds: string[], toId: string): Promise<void> {
  try {
    const dst = await productDir(toId);
    await mkdir(dst, { recursive: true });
    for (const id of fromIds) {
      const src = await productDir(id);
      for (const f of await listWithTimes(src)) {
        await rename(path.join(/*turbopackIgnore: true*/ src, f.file), path.join(/*turbopackIgnore: true*/ dst, f.file)).catch(() => {});
      }
      await rm(src, { recursive: true, force: true }).catch(() => {});
    }
    await pruneDir(dst);
  } catch (err) {
    console.error("[refPhotos] moveRefPhotos failed:", err);
  }
}

/** On delete: remove a product's reference photos. */
export async function deleteRefPhotos(productId: string): Promise<void> {
  try {
    await rm(await productDir(productId), { recursive: true, force: true });
  } catch {}
}

/** Reads a pending (not yet confirmed) photo, e.g. to use it as a product photo fallback. */
export async function readPendingRefPhoto(token: string): Promise<Buffer | null> {
  if (!TOKEN_RE.test(token)) return null;
  try {
    return await readFile(path.join(/*turbopackIgnore: true*/ await pendingDir(), `${token}.webp`));
  } catch {
    return null;
  }
}
