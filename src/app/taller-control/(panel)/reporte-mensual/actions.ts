"use server";

import { prisma } from "@/lib/prisma";
import { fromCents, round2, toCents } from "@/lib/money";

export interface MonthlyProductRow {
  productId: string | null;
  pName: string;
  category: string;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageUnitPrice: number;
  salesCount: number;
  percentageOfTotal: number;
}

export interface MonthlySaleItem {
  id: string;
  pName: string;
  category: string | null;
  quantity: number;
  price: number;
  costPrice: number;
  profit: number;
  date: Date;
  invoice: { id: string; estado: string; pdfUrl: string | null } | null;
}

export interface MonthlyReportPayload {
  year: number;
  month: number;
  monthName: string;
  totalUnits: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  salesCount: number;
  topProduct: MonthlyProductRow | null;
  products: MonthlyProductRow[];
  salesList: MonthlySaleItem[];
}

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export async function getMonthlySalesReport(
  targetYear?: number,
  targetMonth?: number // 1-12
): Promise<MonthlyReportPayload> {
  const now = new Date();
  const year = targetYear ?? now.getFullYear();
  const month = targetMonth ?? now.getMonth() + 1;

  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  // Fetch all active sales within the month
  const sales = await prisma.sale.findMany({
    where: {
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
      deletedAt: null,
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      productId: true,
      pName: true,
      category: true,
      quantity: true,
      price: true,
      costPrice: true,
      profit: true,
      date: true,
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, estado: true, pdfUrl: true },
      },
    },
  });

  let totalUnits = 0;
  let totalRevenueCents = 0;
  let totalCostCents = 0;
  let totalProfitCents = 0;

  // Group by product name / id
  const productMap = new Map<
    string,
    {
      productId: string | null;
      pName: string;
      category: string;
      totalQuantity: number;
      totalRevenueCents: number;
      totalCostCents: number;
      totalProfitCents: number;
      salesCount: number;
    }
  >();

  for (const s of sales) {
    const priceCents = toCents(s.price);
    const costCents = toCents(s.costPrice);
    const profitCents = toCents(s.profit);

    totalUnits += s.quantity;
    totalRevenueCents += priceCents;
    totalCostCents += costCents;
    totalProfitCents += profitCents;

    const key = (s.productId ?? s.pName).toLowerCase().trim();
    const existing = productMap.get(key);

    if (existing) {
      existing.totalQuantity += s.quantity;
      existing.totalRevenueCents += priceCents;
      existing.totalCostCents += costCents;
      existing.totalProfitCents += profitCents;
      existing.salesCount += 1;
    } else {
      productMap.set(key, {
        productId: s.productId,
        pName: s.pName,
        category: s.category || "General",
        totalQuantity: s.quantity,
        totalRevenueCents: priceCents,
        totalCostCents: costCents,
        totalProfitCents: profitCents,
        salesCount: 1,
      });
    }
  }

  const totalRevenue = fromCents(totalRevenueCents);
  const totalCost = fromCents(totalCostCents);
  const totalProfit = fromCents(totalProfitCents);

  // Calculate percentages and averages
  const products: MonthlyProductRow[] = Array.from(productMap.values()).map((p) => {
    const rev = fromCents(p.totalRevenueCents);
    return {
      productId: p.productId,
      pName: p.pName,
      category: p.category,
      totalQuantity: p.totalQuantity,
      totalRevenue: rev,
      totalCost: fromCents(p.totalCostCents),
      totalProfit: fromCents(p.totalProfitCents),
      salesCount: p.salesCount,
      averageUnitPrice: p.totalQuantity > 0 ? round2(rev / p.totalQuantity) : 0,
      percentageOfTotal: totalRevenueCents > 0 ? round2((p.totalRevenueCents / totalRevenueCents) * 100) : 0,
    };
  });

  // Sort products by total quantity sold descending
  products.sort((a, b) => b.totalQuantity - a.totalQuantity);

  const topProduct = products.length > 0 ? products[0] : null;

  const salesList: MonthlySaleItem[] = sales.map(({ invoices, ...s }) => ({
    ...s,
    invoice: invoices[0] ?? null,
  }));

  return {
    year,
    month,
    monthName: MONTH_NAMES_ES[month - 1] ?? "Mes",
    totalUnits,
    totalRevenue,
    totalCost,
    totalProfit,
    salesCount: sales.length,
    topProduct,
    products,
    salesList,
  };
}
