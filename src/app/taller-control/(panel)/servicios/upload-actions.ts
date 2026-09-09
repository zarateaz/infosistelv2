"use server";

import { chmod, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import sharp from "sharp";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";

// Same convention as productos/upload-actions.ts's PRODUCT_IMAGES_DIR — an
// env override lets the VPS point this outside .next/standalone so evidence
// photos survive every rebuild; unset in local dev, it just writes into the
// repo's own public/img/servicios.
const UPLOAD_DIR = process.env.SERVICE_PHOTOS_DIR || path.join(process.cwd(), "public", "img", "servicios");
const PUBLIC_PREFIX = "/img/servicios/";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface UploadImageResult {
  path?: string;
  error?: string;
}

export async function uploadServicePhoto(dataUrl: string): Promise<UploadImageResult> {
  const ip = getClientIP(await headers());
  const rateCheck = checkRateLimit(rateLimitKey("upload-service-photo", ip), 40, 10 * 60 * 1000);
  if (!rateCheck.allowed) {
    return { error: "Demasiadas fotos subidas seguidas. Espera un momento e intenta de nuevo." };
  }

  const match = /^data:image\/(?:png|jpeg|webp);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return { error: "Formato de imagen no válido (usa PNG, JPEG o WEBP)." };
  }
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { error: "La imagen es muy grande (máximo 8MB)." };
  }

  await mkdir(/*turbopackIgnore: true*/ UPLOAD_DIR, { recursive: true, mode: 0o755 });
  await chmod(/*turbopackIgnore: true*/ UPLOAD_DIR, 0o755).catch(() => {});
  const filename = `${randomUUID()}.webp`;

  try {
    const processed = await sharp(buffer)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const filePath = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, filename);
    await writeFile(filePath, processed);
    await chmod(filePath, 0o644);
  } catch {
    return { error: "No se pudo procesar la imagen. Intenta con otro archivo." };
  }

  return { path: `${PUBLIC_PREFIX}${filename}` };
}

/** Best-effort cleanup on service/photo delete — only ever touches files
 *  under our own managed upload dir (randomUUID filenames). */
export async function deleteServicePhotoFileIfManaged(imagePath: string | null): Promise<void> {
  if (!imagePath?.startsWith(PUBLIC_PREFIX)) return;
  const filename = imagePath.slice(PUBLIC_PREFIX.length);
  if (!/^[0-9a-f-]{36}\.webp$/.test(filename)) return;

  try {
    await unlink(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, filename));
  } catch {
    // Already gone, or a permissions hiccup — not worth failing the
    // service save/delete over a stale file on disk.
  }
}
