"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
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

  await mkdir(/*turbopackIgnore: true*/ UPLOAD_DIR, { recursive: true });
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
    await writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, filename), processed);
  } catch {
    return { error: "No se pudo procesar la imagen. Intenta con otro archivo." };
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
