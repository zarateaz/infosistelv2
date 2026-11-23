import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const UPLOAD_DIR = process.env.PRODUCT_IMAGES_DIR || path.join(process.cwd(), "public", "img", "products");

/**
 * Loads a catalog product's local photo (/img/products/<file>) as a small base64 JPEG,
 * for sending to the vision model. Returns null if it isn't a managed local image.
 */
export async function loadProductThumb(imagePath: string | null | undefined, size = 384): Promise<string | null> {
  if (!imagePath || !imagePath.startsWith("/img/products/")) return null;
  const file = path.basename(imagePath);
  if (!/^[\w-]+\.(webp|jpe?g|png)$/i.test(file)) return null;
  try {
    const buf = await readFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, file));
    const jpg = await sharp(buf)
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 70 })
      .toBuffer();
    return jpg.toString("base64");
  } catch {
    return null;
  }
}
