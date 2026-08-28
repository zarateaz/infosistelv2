"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface SaleStatBucket {
  total: number;
  profit: number;
  count: number;
}

export interface SaleStats {
  day: SaleStatBucket;
  week: SaleStatBucket;
  month: SaleStatBucket;
}

function bucket(agg: { _sum: { price: number | null; profit: number | null }; _count: number }): SaleStatBucket {
  return { total: agg._sum.price ?? 0, profit: agg._sum.profit ?? 0, count: agg._count };
}

export async function getSaleStats(): Promise<SaleStats> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [day, week, month] = await Promise.all([
    prisma.sale.aggregate({ where: { date: { gte: startOfDay } }, _sum: { price: true, profit: true }, _count: true }),
    prisma.sale.aggregate({ where: { date: { gte: startOfWeek } }, _sum: { price: true, profit: true }, _count: true }),
    prisma.sale.aggregate({ where: { date: { gte: startOfMonth } }, _sum: { price: true, profit: true }, _count: true }),
  ]);

  return { day: bucket(day), week: bucket(week), month: bucket(month) };
}

export interface AdminSale {
  id: string;
  pName: string;
  category: string | null;
  quantity: number;
  price: number;
  profit: number;
  date: Date;
}

export async function getRecentSales(limit = 30): Promise<AdminSale[]> {
  return prisma.sale.findMany({
    orderBy: { date: "desc" },
    take: limit,
    select: { id: true, pName: true, category: true, quantity: true, price: true, profit: true, date: true },
  });
}

export async function deleteSale(id: string): Promise<void> {
  await prisma.sale.delete({ where: { id } });
  revalidatePath("/taller-control/ventas");
}
