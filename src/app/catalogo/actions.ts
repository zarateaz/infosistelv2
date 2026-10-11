"use server";

import { prisma } from "@/lib/prisma";

export interface CatalogoProduct {
  id: string;
  itemNumber: number;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  image: string | null;
  images: string | null;
  barcode: string | null;
  isFeatured: boolean;
  onSale: boolean;
  salePrice: number | null;
}

export interface CatalogoCategory {
  id: string;
  name: string;
  count: number;
}

export async function getCatalogoData(): Promise<{
  products: CatalogoProduct[];
  categories: CatalogoCategory[];
}> {
  const [products, rawCategories] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        itemNumber: true,
        name: true,
        category: true,
        description: true,
        price: true,
        stock: true,
        image: true,
        images: true,
        barcode: true,
        isFeatured: true,
        onSale: true,
        salePrice: true,
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const categoryCounts = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categories: CatalogoCategory[] = rawCategories.map((c) => ({
    id: c.id,
    name: c.name,
    count: categoryCounts[c.name] || 0,
  }));

  return {
    products,
    categories,
  };
}
