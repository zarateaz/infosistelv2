import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface MonthlyProductSummary {
  pName: string;
  category: string;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageUnitPrice: number;
  percentageOfTotal: number;
}

export interface MonthlyReportExportData {
  year: number;
  month: number;
  monthName: string;
  totalUnits: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  salesCount: number;
  topProduct: MonthlyProductSummary | null;
  products: MonthlyProductSummary[];
}

export interface CashboxReportTransaction {
  id: string;
  date: Date;
  description: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  paymentMethod: string;
  notes: string | null;
}

export interface CashboxReportExportData {
  month: string;
  monthLabel: string;
  responsible?: string;
  transactions: CashboxReportTransaction[];
}

function safeRunAutoTable(doc: jsPDF, options: any) {
  if (typeof autoTable === "function") {
    autoTable(doc, options);
  } else if (typeof (autoTable as any)?.default === "function") {
    (autoTable as any).default(doc, options);
  } else if (typeof (doc as any).autoTable === "function") {
    (doc as any).autoTable(options);
  } else {
    throw new Error("No se pudo ejecutar autoTable en el documento PDF.");
  }
}

function safeSavePdf(doc: jsPDF, filename: string) {
  try {
    doc.save(filename);
  } catch {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Generates an executive, beautifully formatted PDF report for monthly sales.
 * Highly optimized, crisp vector layout, Infosistel corporate styling.
 */
export function generateMonthlySalesReportPDF(data: MonthlyReportExportData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Colors
  const primaryBlue = [10, 95, 219] as const;
  const mutedGray = [100, 116, 139] as const;
  const emeraldGreen = [16, 185, 129] as const;
  const lightBg = [248, 250, 252] as const;

  // Header Banner
  doc.setFillColor(...primaryBlue);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INFOSISTEL", 14, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("TECNOLOGÍA · SERVICIO TÉCNICO · REPUESTOS", 14, 18);
  doc.text("Contacto: 964 648 202 · infosistel.pe", 14, 23);

  // Document Title on Right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("REPORTE MENSUAL DE VENTAS", pageWidth - 14, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`PERÍODO: ${data.monthName.toUpperCase()} ${data.year}`, pageWidth - 14, 20, {
    align: "right",
  });

  // Generation timestamp
  const now = new Date();
  const genDate = now.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
  doc.setFontSize(8);
  doc.text(`Fecha de emisión: ${genDate}`, 14, 34);

  // Summary Metrics Section (4 cards in a row)
  const cardY = 38;
  const cardHeight = 20;
  const cardGap = 4;
  const cardWidth = (pageWidth - 28 - cardGap * 3) / 4;

  const metrics = [
    {
      title: "UNIDADES VENDIDAS",
      value: `${data.totalUnits} u.`,
      sub: `${data.salesCount} transacciones`,
      color: primaryBlue,
    },
    {
      title: "INGRESOS TOTALES",
      value: `S/. ${data.totalRevenue.toFixed(2)}`,
      sub: "Total facturado",
      color: primaryBlue,
    },
    {
      title: "GANANCIA NETA",
      value: `S/. ${data.totalProfit.toFixed(2)}`,
      sub: `Margen: ${data.totalRevenue > 0 ? ((data.totalProfit / data.totalRevenue) * 100).toFixed(1) : 0}%`,
      color: emeraldGreen,
    },
    {
      title: "PRODUCTO ESTRELLA",
      value: data.topProduct ? `${data.topProduct.totalQuantity} u.` : "-",
      sub: data.topProduct
        ? data.topProduct.pName.length > 16
          ? data.topProduct.pName.slice(0, 16) + "..."
          : data.topProduct.pName
        : "Sin ventas",
      color: primaryBlue,
    },
  ];

  metrics.forEach((m, index) => {
    const x = 14 + index * (cardWidth + cardGap);
    doc.setFillColor(...lightBg);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
    doc.text(m.title, x + 3.5, cardY + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.value, x + 3.5, cardY + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
    doc.text(m.sub, x + 3.5, cardY + 17);
  });

  // Table of Products Sold
  const tableRows =
    data.products.length > 0
      ? data.products.map((p, idx) => [
          (idx + 1).toString(),
          p.pName,
          p.category || "General",
          `${p.totalQuantity} u.`,
          `S/. ${p.averageUnitPrice.toFixed(2)}`,
          `S/. ${p.totalRevenue.toFixed(2)}`,
          `S/. ${p.totalProfit.toFixed(2)}`,
          `${p.percentageOfTotal.toFixed(1)}%`,
        ])
      : [
          [
            "-",
            "No se registraron ventas en este período",
            "-",
            "0 u.",
            "S/. 0.00",
            "S/. 0.00",
            "S/. 0.00",
            "0%",
          ],
        ];

  safeRunAutoTable(doc, {
    startY: cardY + cardHeight + 8,
    head: [
      [
        "#",
        "Producto",
        "Categoría",
        "Cant.",
        "P. Unit. Prom.",
        "Total Venta",
        "Ganancia",
        "% Total",
      ],
    ],
    body: tableRows,
    foot: [
      [
        "",
        "TOTALES DEL MES",
        "",
        `${data.totalUnits} u.`,
        "-",
        `S/. ${data.totalRevenue.toFixed(2)}`,
        `S/. ${data.totalProfit.toFixed(2)}`,
        "100%",
      ],
    ],
    theme: "striped",
    headStyles: {
      fillColor: [10, 95, 219],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "left",
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8.5,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 55 },
      2: { cellWidth: 26 },
      3: { cellWidth: 15, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 22, halign: "right", fontStyle: "bold" },
      6: { cellWidth: 22, halign: "right", textColor: [16, 185, 129] },
      7: { cellWidth: 15, halign: "right" },
    },
    margin: { left: 14, right: 14, bottom: 20 },
    didDrawPage: (pageData: any) => {
      const str = `Página ${pageData.pageNumber}`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
      doc.text("Infosistel · Sistema de Control y Gestión de Ventas", 14, pageHeight - 8);
      doc.text(str, pageWidth - 14, pageHeight - 8, { align: "right" });
    },
  });

  const filename = `Reporte_Ventas_INFOSISTEL_${data.monthName}_${data.year}.pdf`;
  safeSavePdf(doc, filename);
}

/**
 * Generates an executive, printable PDF report for the Cashbox (Caja) monthly records.
 */
export function generateCashboxReportPDF(data: CashboxReportExportData) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const primaryBlue = [10, 95, 219] as const;
  const mutedGray = [100, 116, 139] as const;
  const emeraldGreen = [16, 185, 129] as const;
  const redExpense = [220, 38, 38] as const;
  const lightBg = [248, 250, 252] as const;

  // Header Banner
  doc.setFillColor(...primaryBlue);
  doc.rect(0, 0, pageWidth, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INFOSISTEL", 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("REPORTE MENSUAL DE CAJA CHICA Y MOVIMIENTOS", 14, 17);
  doc.text(`Responsable: ${data.responsible || "Administración"} · Cel: 964 648 202`, 14, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`CONTROL DE CAJA — ${data.monthLabel.toUpperCase()}`, pageWidth - 14, 13, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Período: ${data.month}`, pageWidth - 14, 20, { align: "right" });

  // Calculate totals
  let running = 0;
  let totalIncome = 0;
  let totalExpense = 0;
  let cashIncome = 0;
  let yapeIncome = 0;
  let cashExpense = 0;
  let yapeExpense = 0;

  const rows = data.transactions.map((t) => {
    const isInc = t.type === "INCOME";
    if (isInc) {
      totalIncome += t.amount;
      if (t.paymentMethod === "EFECTIVO") cashIncome += t.amount;
      else yapeIncome += t.amount;
      running += t.amount;
    } else {
      totalExpense += t.amount;
      if (t.paymentMethod === "EFECTIVO") cashExpense += t.amount;
      else yapeExpense += t.amount;
      running -= t.amount;
    }

    const d = new Date(t.date);
    const dateFormatted = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

    return [
      dateFormatted,
      t.description,
      isInc ? "INGRESO" : "GASTO",
      t.paymentMethod,
      isInc ? `S/. ${t.amount.toFixed(2)}` : "-",
      !isInc ? `S/. ${t.amount.toFixed(2)}` : "-",
      `S/. ${running.toFixed(2)}`,
      t.notes || "",
    ];
  });

  const finalBalance = running;

  // Summary Metrics Section (4 cards)
  const cardY = 32;
  const cardHeight = 18;
  const cardGap = 4;
  const cardWidth = (pageWidth - 28 - cardGap * 3) / 4;

  const metrics = [
    {
      title: "TOTAL INGRESOS",
      value: `S/. ${totalIncome.toFixed(2)}`,
      sub: `Efectivo: S/. ${cashIncome.toFixed(2)} · Yape: S/. ${yapeIncome.toFixed(2)}`,
      color: emeraldGreen,
    },
    {
      title: "TOTAL EGRESOS",
      value: `S/. ${totalExpense.toFixed(2)}`,
      sub: `Efectivo: S/. ${cashExpense.toFixed(2)} · Yape: S/. ${yapeExpense.toFixed(2)}`,
      color: redExpense,
    },
    {
      title: "SALDO NETO DEL MES",
      value: `S/. ${finalBalance.toFixed(2)}`,
      sub: finalBalance >= 0 ? "Balance positivo" : "Balance negativo",
      color: primaryBlue,
    },
    {
      title: "MOVIMIENTOS REGISTRADOS",
      value: `${data.transactions.length} registros`,
      sub: `${data.monthLabel}`,
      color: primaryBlue,
    },
  ];

  metrics.forEach((m, index) => {
    const x = 14 + index * (cardWidth + cardGap);
    doc.setFillColor(...lightBg);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
    doc.text(m.title, x + 3.5, cardY + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.value, x + 3.5, cardY + 10.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
    doc.text(m.sub, x + 3.5, cardY + 15);
  });

  const tableBody =
    rows.length > 0
      ? rows
      : [["-", "Sin movimientos registrados en este período", "-", "-", "-", "-", "S/. 0.00", ""]];

  safeRunAutoTable(doc, {
    startY: cardY + cardHeight + 6,
    head: [
      [
        "Fecha",
        "Concepto / Descripción",
        "Tipo",
        "Método",
        "Ingreso",
        "Egreso",
        "Saldo",
        "Notas",
      ],
    ],
    body: tableBody,
    foot: [
      [
        "",
        "TOTALES DEL PERÍODO",
        "",
        "",
        `S/. ${totalIncome.toFixed(2)}`,
        `S/. ${totalExpense.toFixed(2)}`,
        `S/. ${finalBalance.toFixed(2)}`,
        "",
      ],
    ],
    theme: "striped",
    headStyles: {
      fillColor: [10, 95, 219],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8.5,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: 85 },
      2: { cellWidth: 20, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 25, halign: "right", textColor: [16, 185, 129] },
      5: { cellWidth: 25, halign: "right", textColor: [220, 38, 38] },
      6: { cellWidth: 25, halign: "right", fontStyle: "bold" },
      7: { cellWidth: 42 },
    },
    margin: { left: 14, right: 14, bottom: 15 },
    didDrawPage: (pageData: any) => {
      const str = `Página ${pageData.pageNumber}`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
      doc.text("Infosistel · Control de Caja", 14, pageHeight - 6);
      doc.text(str, pageWidth - 14, pageHeight - 6, { align: "right" });
    },
  });

  const filename = `Reporte_Caja_INFOSISTEL_${data.month}.pdf`;
  safeSavePdf(doc, filename);
}
