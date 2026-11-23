import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import { findDuplicateGroups } from "@/lib/duplicateAudit";
import { DuplicatesReview } from "./DuplicatesReview";

export const metadata = {
  title: "Productos repetidos",
};

export default async function DuplicatesPage() {
  await requireSession();
  const products = await prisma.product.findMany({
    select: {
      id: true,
      itemNumber: true,
      name: true,
      barcode: true,
      category: true,
      price: true,
      costPrice: true,
      stock: true,
      image: true,
      images: true,
      description: true,
    },
    orderBy: { itemNumber: "asc" },
  });
  const groups = findDuplicateGroups(products);

  return <DuplicatesReview groups={groups} totalProducts={products.length} />;
}
