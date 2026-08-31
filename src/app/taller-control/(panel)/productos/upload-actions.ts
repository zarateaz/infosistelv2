"use server";

import { chmod, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import sharp from "sharp";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";

// PRODUCT_IMAGES_DIR lets the VPS point this at a location outside
// .next/standalone (symlinked into its public/img/products at deploy time
// — see scripts/deploy-vps.sh), so uploaded photos survive every rebuild
// exactly like data/dev.db does. Unset in local dev: writes straight into
// the repo's own public/img/products.
//
// The `turbopackIgnore` comments below on every fs call using this are
// deliberate: because it comes from an env var, Turbopack's build-time
// output tracer can't statically resolve it and — without the hint —
// falls back to tracing (and bundling into .next/standalone) the ENTIRE
// project as a worst case. The ignore comment tells it this path is
// intentionally resolved at runtime, outside anything it needs to trace.
const UPLOAD_DIR = process.env.PRODUCT_IMAGES_DIR || path.join(process.cwd(), "public", "img", "products");
const PUBLIC_PREFIX = "/img/products/";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB raw, before re-encoding

export interface UploadImageResult {
  path?: string;
  error?: string;
}

export async function uploadProductImage(dataUrl: string): Promise<UploadImageResult> {
  const ip = getClientIP(await headers());
  const rateCheck = checkRateLimit(rateLimitKey("upload-image", ip), 30, 10 * 60 * 1000);
  if (!rateCheck.allowed) {
    return { error: "Demasiadas imágenes subidas seguidas. Espera un momento e intenta de nuevo." };
  }

  const match = /^data:image\/(?:png|jpeg|webp);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return { error: "Formato de imagen no válido (usa PNG, JPEG o WEBP)." };
  }
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { error: "La imagen es muy grande (máximo 8MB)." };
  }

  // mkdir's default mode (0o777) is also reduced by the process umask — a
  // restrictive umask here would make the directory itself untraversable by
  // nginx's worker user, independent of the per-file chmod below.
  await mkdir(/*turbopackIgnore: true*/ UPLOAD_DIR, { recursive: true, mode: 0o755 });
  await chmod(/*turbopackIgnore: true*/ UPLOAD_DIR, 0o755).catch(() => {});
  const filename = `${randomUUID()}.webp`;

  try {
    // Re-encoding through sharp (not just saving the raw upload) does two
    // things at once: normalizes every product photo to one format/size,
    // and acts as content validation — a renamed non-image file fails here
    // instead of ever reaching disk as something with an .webp extension.
    const processed = await sharp(buffer)
      .rotate() // applies EXIF orientation, then strips EXIF (metadata is dropped by default on re-encode)
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const filePath = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, filename);
    await writeFile(filePath, processed);
    // writeFile's default mode (0o666) is reduced by the process umask —
    // on a hardened VPS with a restrictive umask (e.g. 077) that leaves the
    // file unreadable by nginx's worker user, which serves this directory
    // directly (see nginx.conf's /img/products/ alias). Force it explicitly
    // so uploads work regardless of the host's umask.
    await chmod(filePath, 0o644);
  } catch {
    return { error: "No se pudo procesar la imagen. Intenta con otro archivo." };
  }

  return { path: `${PUBLIC_PREFIX}${filename}` };
}

/** Same pipeline as uploadProductImage, but the source is a URL from an
 *  external product lookup (e.g. upcitemdb) instead of a file the admin
 *  picked — used by the barcode scanner to fill in a photo automatically
 *  when the manufacturer/listing already has one, so it isn't always a
 *  manual one-by-one step. Best-effort: any failure just leaves the
 *  product without a photo, same as if this had never been attempted. */
export async function downloadProductImageFromUrl(url: string): Promise<UploadImageResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "URL de imagen inválida." };
  }
  if (parsed.protocol !== "https:") {
    return { error: "Solo se acepta HTTPS." };
  }

  let buffer: Buffer;
  try {
    const res = await fetch(parsed, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { error: "No se pudo descargar la imagen del proveedor." };
    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > MAX_UPLOAD_BYTES) return { error: "Imagen externa demasiado grande." };
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) return { error: "Imagen externa demasiado grande." };
    buffer = Buffer.from(arrayBuffer);
  } catch {
    return { error: "No se pudo descargar la imagen del proveedor." };
  }

  // mkdir's default mode (0o777) is also reduced by the process umask — a
  // restrictive umask here would make the directory itself untraversable by
  // nginx's worker user, independent of the per-file chmod below.
  await mkdir(/*turbopackIgnore: true*/ UPLOAD_DIR, { recursive: true, mode: 0o755 });
  await chmod(/*turbopackIgnore: true*/ UPLOAD_DIR, 0o755).catch(() => {});
  const filename = `${randomUUID()}.webp`;

  try {
    const processed = await sharp(buffer)
      .rotate()
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const filePath = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, filename);
    await writeFile(filePath, processed);
    await chmod(filePath, 0o644);
  } catch {
    return { error: "El archivo descargado no es una imagen válida." };
  }

  return { path: `${PUBLIC_PREFIX}${filename}` };
}

/** Best-effort cleanup when a product's image is replaced or the product is
 *  deleted — only ever touches files under our own managed upload dir
 *  (randomUUID filenames), never a path someone typed by hand. */
export async function deleteProductImageIfManaged(imagePath: string | null): Promise<void> {
  if (!imagePath?.startsWith(PUBLIC_PREFIX)) return;
  const filename = imagePath.slice(PUBLIC_PREFIX.length);
  if (!/^[0-9a-f-]{36}\.webp$/.test(filename)) return;

  try {
    await unlink(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, filename));
  } catch {
    // Already gone, or a permissions hiccup — not worth failing the
    // product save/delete over a stale file on disk.
  }
}
