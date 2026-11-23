import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

// Same lookup order as src/app/img/products/[...slug]/route.ts
function candidateDirs(): string[] {
  return [
    process.env.PRODUCT_IMAGES_DIR,
    "/home/zarate/infosistel-v2-data/uploads/products",
    path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "img", "products"),
  ].filter((d): d is string => typeof d === "string" && d.length > 0);
}

/**
 * Loads a catalog product's local photo (/img/products/<file>) as a small base64 JPEG,
 * for sending to the vision model. Returns null if it isn't a managed local image.
 */
export async function loadProductThumb(imagePath: string | null | undefined, size = 384): Promise<string | null> {
  if (!imagePath || !imagePath.startsWith("/img/products/")) return null;
  const file = path.basename(imagePath);
  if (!/^[\w-]+\.(webp|jpe?g|png)$/i.test(file)) return null;
  for (const dir of candidateDirs()) {
    try {
      const buf = await readFile(path.join(/*turbopackIgnore: true*/ dir, file));
      const jpg = await sharp(buf)
        .resize(size, size, { fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 70 })
        .toBuffer();
      return jpg.toString("base64");
    } catch {}
  }
  return null;
}
