/**
 * Núcleo de la unión de productos repetidos (sin sesión ni revalidación, para poder
 * probarlo aislado). Lo usa la acción mergeProducts de /taller-control/productos/duplicados.
 */
import type { PrismaClient } from "@/generated/prisma/client";

function parseGallery(images: string | null): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export interface MergeSummary {
  keepName: string;
  keepItem: number;
  removed: string[];
  totalStock: number;
}

export async function mergeProductsCore(prisma: PrismaClient, keepId: string, ids: string[]): Promise<MergeSummary> {
  return prisma.$transaction(async (tx) => {
      const keep = await tx.product.findUnique({ where: { id: keepId } });
      const removed = await tx.product.findMany({ where: { id: { in: ids } } });
      if (!keep) throw new Error("El producto a conservar ya no existe.");
      if (removed.length !== ids.length) throw new Error("Alguno de los productos ya fue unido o eliminado. Recarga la página.");

      const barcodes = new Set(removed.map((r) => r.barcode?.trim()).filter(Boolean));
      if (keep.barcode) barcodes.add(keep.barcode.trim());
      if (barcodes.size > 1) {
        throw new Error(
          `Tienen códigos de barras distintos (${[...barcodes].join(", ")}): son productos diferentes, no se pueden unir.`
        );
      }

      const totalStock = keep.stock + removed.reduce((acc, r) => acc + Math.max(0, r.stock), 0);
      const barcode = keep.barcode ?? removed.find((r) => r.barcode)?.barcode ?? null;
      const cover = keep.image ?? removed.find((r) => r.image)?.image ?? null;
      const gallery = Array.from(
        new Set([
          ...parseGallery(keep.images),
          ...removed.flatMap((r) => [r.image, ...parseGallery(r.images)]),
        ].filter((v): v is string => !!v && v !== cover))
      ).slice(0, 3);
      const costPrice = keep.costPrice && keep.costPrice > 0 ? keep.costPrice : Math.max(0, ...removed.map((r) => r.costPrice ?? 0));
      const description =
        keep.description?.trim() ? keep.description : removed.find((r) => r.description?.trim())?.description ?? keep.description;

      // Free the unique barcode before moving it to the kept product
      await tx.product.updateMany({ where: { id: { in: ids }, barcode: { not: null } }, data: { barcode: null } });

      await tx.stockMovement.updateMany({ where: { productId: { in: ids } }, data: { productId: keepId } });
      await tx.sale.updateMany({ where: { productId: { in: ids } }, data: { productId: keepId } });
      await tx.orderItem.updateMany({ where: { productId: { in: ids } }, data: { productId: keepId } });
      await tx.quotationItem.updateMany({ where: { productId: { in: ids } }, data: { productId: keepId } });

      await tx.product.update({
        where: { id: keepId },
        data: {
          stock: totalStock,
          barcode,
          image: cover,
          images: gallery.length > 0 ? JSON.stringify(gallery) : null,
          costPrice,
          description,
          searchHits: keep.searchHits + removed.reduce((acc, r) => acc + r.searchHits, 0),
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: keepId,
          quantity: 0,
          type: "AJUSTE",
          description: `Unión de repetidos: ${removed
            .map((r) => `#${r.itemNumber} (${r.stock} u.)`)
            .join(", ")} → #${keep.itemNumber}. Stock total: ${totalStock} u.`,
        },
      });

      await tx.product.deleteMany({ where: { id: { in: ids } } });

      return {
        keepName: keep.name,
        keepItem: keep.itemNumber,
        removed: removed.map((r) => `#${r.itemNumber} ${r.name}`),
        totalStock,
      };
    });
}
