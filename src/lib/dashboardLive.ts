import { prisma } from "@/lib/prisma";
import { PAYMENT_METHODS, type PaymentMethodType } from "@/lib/paymentMethods";
import { obtenerTodo } from "@/lib/servicios-tecnicos/store";
import { ACTIVAS, pendiente, ymd, parseD } from "@/lib/servicios-tecnicos/logic";
import {
  todayInLima,
  periodState,
  isDebtCategory,
  type DebtRow,
} from "@/app/taller-control/(panel)/deudas/deudas";
import { cobranzaState, daysUntil } from "@/app/taller-control/(panel)/cobranza-internet/cobranza";
import { dateToInputValue } from "@/app/taller-control/(panel)/caja/month";
import { fromCents, sharePercentages, toCents } from "@/lib/money";

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const LOW_STOCK_THRESHOLD = 3;

export interface AccountSnapshot {
  id: PaymentMethodType;
  balance: number;
  income: number;
  expense: number;
  count: number;
  todayNet: number;
  todayIncome: number;
  todayExpense: number;
  todayCount: number;
  sharePct: number;
}

export interface LiveTransactionDTO {
  id: string;
  date: string; // ISO string
  description: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  paymentMethod: string;
  notes: string | null;
}

export interface DashboardLiveSnapshot {
  generatedAt: string;
  todayStr: string;
  todayLabel: string;
  month: string;
  monthLabel: string;
  cashbox: {
    totalBalance: number;
    totalIncome: number;
    totalExpense: number;
    totalCount: number;
    todayNet: number;
    todayIncome: number;
    todayExpense: number;
    todayCount: number;
    accounts: Record<PaymentMethodType, AccountSnapshot>;
    transactions: LiveTransactionDTO[];
  };
  operations: {
    products: {
      total: number;
      lowStockCount: number;
      lowStockItems: {
        id: string;
        name: string;
        category: string;
        stock: number;
        price: number;
      }[];
    };
    orders: {
      total: number;
      revenue: number;
      recent: {
        id: string;
        customerName: string;
        total: number;
        date: string;
      }[];
    };
    repairs: {
      pending: number;
    };
    serviciosTecnicos: {
      activos: number;
      listos: number;
      porCobrar: number;
      cobradoHoy: number;
    };
    deudas: {
      pendientesCount: number;
      vencidasCount: number;
      pagadasCount: number;
      montoPendiente: number;
    };
    cobranzaInternet: {
      totalClientes: number;
      deudoresCount: number;
      alDiaCount: number;
    };
  };
}

export async function getDashboardLiveSnapshot(): Promise<DashboardLiveSnapshot> {
  const todayStr = todayInLima();
  const currentMonth = todayStr.slice(0, 7);
  const [yearNum, monthNum] = currentMonth.split("-").map(Number);
  const monthStart = new Date(Date.UTC(yearNum, monthNum - 1, 1));
  const monthEnd = new Date(Date.UTC(yearNum, monthNum, 1));

  const [ty, tm, td] = todayStr.split("-");
  const todayLabel = `${td}/${tm}/${ty}`;
  const monthLabel = `${MONTH_NAMES_ES[monthNum - 1] ?? currentMonth} de ${yearNum}`;

  const [
    monthTxRows,
    productCount,
    lowStockCount,
    lowStockItems,
    orderCount,
    revenueAgg,
    recentOrderRows,
    pendingRepairCount,
    debtRows,
    internetRows,
    serviciosData,
  ] = await Promise.all([
    prisma.cashboxTransaction.findMany({
      where: { date: { gte: monthStart, lt: monthEnd }, deletedAt: null },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.product.count(),
    prisma.product.count({ where: { stock: { lte: LOW_STOCK_THRESHOLD } } }),
    prisma.product.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD } },
      select: { id: true, name: true, category: true, stock: true, price: true },
      orderBy: { stock: "asc" },
      take: 30,
    }),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.order.findMany({
      select: { id: true, customerName: true, total: true, date: true },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.repair.count({ where: { progress: { lt: 100 } } }),
    prisma.debt.findMany({
      where: { active: true },
      include: { payments: true },
    }),
    prisma.internetClient.findMany({
      select: { id: true, nextPaymentDate: true },
    }),
    obtenerTodo().catch(() => ({ servicios: [] })),
  ]);

  // ── 1. Cálculos exactos de las 3 cuentas de Caja ──
  const accounts: Record<PaymentMethodType, AccountSnapshot> = {
    EFECTIVO: {
      id: "EFECTIVO",
      balance: 0,
      income: 0,
      expense: 0,
      count: 0,
      todayNet: 0,
      todayIncome: 0,
      todayExpense: 0,
      todayCount: 0,
      sharePct: 0,
    },
    "YAPE 1": {
      id: "YAPE 1",
      balance: 0,
      income: 0,
      expense: 0,
      count: 0,
      todayNet: 0,
      todayIncome: 0,
      todayExpense: 0,
      todayCount: 0,
      sharePct: 0,
    },
    "YAPE 2": {
      id: "YAPE 2",
      balance: 0,
      income: 0,
      expense: 0,
      count: 0,
      todayNet: 0,
      todayIncome: 0,
      todayExpense: 0,
      todayCount: 0,
      sharePct: 0,
    },
  };

  const accountCents: Record<
    PaymentMethodType,
    { income: number; expense: number; count: number; todayIncome: number; todayExpense: number; todayCount: number }
  > = {
    EFECTIVO: { income: 0, expense: 0, count: 0, todayIncome: 0, todayExpense: 0, todayCount: 0 },
    "YAPE 1": { income: 0, expense: 0, count: 0, todayIncome: 0, todayExpense: 0, todayCount: 0 },
    "YAPE 2": { income: 0, expense: 0, count: 0, todayIncome: 0, todayExpense: 0, todayCount: 0 },
  };

  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  let todayIncomeCents = 0;
  let todayExpenseCents = 0;
  let todayCount = 0;

  for (const t of monthTxRows) {
    const isInc = t.type === "INCOME";
    const isToday = dateToInputValue(t.date) === todayStr;
    const amtCents = toCents(t.amount);

    if (isInc) totalIncomeCents += amtCents;
    else totalExpenseCents += amtCents;

    if (isToday) {
      todayCount++;
      if (isInc) todayIncomeCents += amtCents;
      else todayExpenseCents += amtCents;
    }

    const m = t.paymentMethod as PaymentMethodType;
    if (accountCents[m]) {
      accountCents[m].count++;
      if (isInc) accountCents[m].income += amtCents;
      else accountCents[m].expense += amtCents;

      if (isToday) {
        accountCents[m].todayCount++;
        if (isInc) accountCents[m].todayIncome += amtCents;
        else accountCents[m].todayExpense += amtCents;
      }
    }
  }

  for (const m of PAYMENT_METHODS) {
    const c = accountCents[m];
    accounts[m].count = c.count;
    accounts[m].income = fromCents(c.income);
    accounts[m].expense = fromCents(c.expense);
    accounts[m].balance = fromCents(c.income - c.expense);
    accounts[m].todayCount = c.todayCount;
    accounts[m].todayIncome = fromCents(c.todayIncome);
    accounts[m].todayExpense = fromCents(c.todayExpense);
    accounts[m].todayNet = fromCents(c.todayIncome - c.todayExpense);
  }

  const totalIncome = fromCents(totalIncomeCents);
  const totalExpense = fromCents(totalExpenseCents);
  const totalBalance = fromCents(totalIncomeCents - totalExpenseCents);
  const todayIncome = fromCents(todayIncomeCents);
  const todayExpense = fromCents(todayExpenseCents);
  const todayNet = fromCents(todayIncomeCents - todayExpenseCents);

  const shares = sharePercentages(PAYMENT_METHODS.map((m) => accounts[m].balance));
  PAYMENT_METHODS.forEach((m, idx) => {
    accounts[m].sharePct = shares[idx];
  });

  // ── 2. Servicios Técnicos ──
  const serviciosList = Array.isArray(serviciosData?.servicios) ? serviciosData.servicios : [];
  let stActivos = 0;
  let stListos = 0;
  let stPorCobrarCents = 0;
  let stCobradoHoyCents = 0;

  for (const s of serviciosList) {
    if (ACTIVAS.includes(s.etapa)) stActivos++;
    if (s.etapa === "listo" || s.etapa === "noreparable") stListos++;
    stPorCobrarCents += toCents(pendiente(s));
    for (const p of s.pagos || []) {
      if (p.fecha && ymd(parseD(p.fecha)) === todayStr) {
        stCobradoHoyCents += toCents(Number(p.monto) || 0);
      }
    }
  }
  const stPorCobrar = fromCents(stPorCobrarCents);
  const stCobradoHoy = fromCents(stCobradoHoyCents);

  // ── 3. Deudas y Obligaciones del Mes ──
  let deudasPendientes = 0;
  let deudasVencidas = 0;
  let deudasPagadas = 0;
  let deudasMontoPendienteCents = 0;

  for (const r of debtRows) {
    const row: DebtRow = {
      id: r.id,
      name: r.name,
      category: isDebtCategory(r.category) ? r.category : "OTROS",
      payee: r.payee,
      location: r.location,
      reference: r.reference,
      payTo: r.payTo,
      phone: r.phone,
      dueDay: r.dueDay,
      amount: r.amount,
      isVariable: r.isVariable,
      startMonth: r.startMonth,
      endMonth: r.endMonth,
      notes: r.notes,
      active: r.active,
      payments: r.payments.map((p) => ({
        id: p.id,
        period: p.period,
        amount: p.amount,
        paidAt: dateToInputValue(p.paidAt),
        method: p.method,
        note: p.note,
        inCashbox: Boolean(p.cashboxTransactionId),
      })),
    };
    const st = periodState(row, currentMonth, todayStr);
    if (st.status === "NO_APLICA") continue;
    if (st.status === "PAGADO") {
      deudasPagadas++;
    } else {
      deudasPendientes++;
      deudasMontoPendienteCents += toCents(row.amount);
      if (st.status === "VENCIDO") deudasVencidas++;
    }
  }
  const deudasMontoPendiente = fromCents(deudasMontoPendienteCents);

  // ── 4. Cobranza Internet ──
  const [nowY, nowM, nowD] = todayStr.split("-").map(Number);
  const limaTodayDate = new Date(nowY, nowM - 1, nowD);
  let deudoresInternet = 0;
  for (const c of internetRows) {
    const nextStr = dateToInputValue(c.nextPaymentDate);
    const st = cobranzaState(daysUntil(nextStr, limaTodayDate));
    if (st !== "ok") deudoresInternet++;
  }

  return {
    generatedAt: new Date().toISOString(),
    todayStr,
    todayLabel,
    month: currentMonth,
    monthLabel,
    cashbox: {
      totalBalance,
      totalIncome,
      totalExpense,
      totalCount: monthTxRows.length,
      todayNet,
      todayIncome,
      todayExpense,
      todayCount,
      accounts,
      transactions: monthTxRows.map((t) => ({
        id: t.id,
        date: t.date.toISOString(),
        description: t.description,
        type: t.type as "INCOME" | "EXPENSE",
        amount: t.amount,
        paymentMethod: t.paymentMethod,
        notes: t.notes,
      })),
    },
    operations: {
      products: {
        total: productCount,
        lowStockCount,
        lowStockItems,
      },
      orders: {
        total: orderCount,
        revenue: revenueAgg._sum.total ?? 0,
        recent: recentOrderRows.map((o) => ({
          id: o.id,
          customerName: o.customerName,
          total: o.total,
          date: o.date.toISOString(),
        })),
      },
      repairs: {
        pending: pendingRepairCount,
      },
      serviciosTecnicos: {
        activos: stActivos,
        listos: stListos,
        porCobrar: stPorCobrar,
        cobradoHoy: stCobradoHoy,
      },
      deudas: {
        pendientesCount: deudasPendientes,
        vencidasCount: deudasVencidas,
        pagadasCount: deudasPagadas,
        montoPendiente: deudasMontoPendiente,
      },
      cobranzaInternet: {
        totalClientes: internetRows.length,
        deudoresCount: deudoresInternet,
        alDiaCount: internetRows.length - deudoresInternet,
      },
    },
  };
}

