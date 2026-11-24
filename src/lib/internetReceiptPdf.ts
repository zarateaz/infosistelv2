import jsPDF from "jspdf";
import { todayLima } from "@/lib/limaTime";
import autoTable, { applyPlugin } from "jspdf-autotable";
import type { InternetHistoryItem } from "@/app/taller-control/(panel)/cobranza-internet/cobranza";

try {
  applyPlugin(jsPDF);
} catch {
  // Handled safely
}

function safeRunAutoTable(doc: jsPDF, options: any) {
  try {
    if (typeof (doc as any).autoTable === "function") {
      (doc as any).autoTable(options);
      return;
    }
  } catch (e) {
    console.warn("doc.autoTable failed, falling back to direct function", e);
  }

  if (typeof autoTable === "function") {
    autoTable(doc, options);
  } else if (typeof (autoTable as any)?.default === "function") {
    (autoTable as any).default(doc, options);
  } else {
    throw new Error("No se pudo ejecutar autoTable en el documento PDF.");
  }
}

function safeSavePdf(doc: jsPDF, filename: string) {
  try {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  } catch {
    doc.save(filename);
  }
}

export interface InternetReceiptPDFData {
  receiptNumber: string; // 6 dígitos ej: "000142"
  clientName: string;
  clientCode?: string | null;
  whatsapp?: string | null;
  galeria?: string | null;
  router?: string | null;
  portNumber?: number | null;
  periodLabel: string; // ej: "Mayo 2026"
  dueDate?: string; // YYYY-MM-DD
  paidAt: string; // YYYY-MM-DD
  amount: number;
  method?: string; // "EFECTIVO" | "YAPE 1" | "YAPE 2"
  note?: string | null;
}

/**
 * Genera y descarga un comprobante / recibo individual de pago de internet
 * en formato A5 apaisado, con diseño corporativo oficial de INFOSISTEL y correlativo de 6 dígitos.
 */
export function generateInternetReceiptPDF(data: InternetReceiptPDFData) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a5", // 210mm x 148mm
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 148

  // Fondo blanco y marco perimetral
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Barra lateral izquierda decorativa
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 8, pageHeight, "F");
  doc.setFillColor(2, 132, 199); // sky-600
  doc.rect(0, 0, 8, 45, "F");

  // ─── CABECERA ─────────────────────────────────────────────────────────────
  // Logo / Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text("INFO", 16, 20);
  doc.setTextColor(2, 132, 199);
  doc.text("SISTEL", 38, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Telecomunicaciones · Redes & Soporte Técnico", 16, 26);
  doc.text("WhatsApp Soporte: +51 964 648 202", 16, 31);

  // Recuadro del Recibo (Derecha)
  const boxX = pageWidth - 78;
  const boxY = 12;
  const boxW = 68;
  const boxH = 26;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("RECIBO DE CAJA / INTERNET", boxX + boxW / 2, boxY + 7, { align: "center" });

  doc.setFontSize(16);
  doc.setTextColor(2, 132, 199);
  const formattedRec = data.receiptNumber.padStart(6, "0");
  doc.text(`N° ${formattedRec}`, boxX + boxW / 2, boxY + 17, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Emisión: ${data.paidAt}`, boxX + boxW / 2, boxY + 23, { align: "center" });

  // Línea divisoria
  doc.setDrawColor(226, 232, 240);
  doc.line(16, 42, pageWidth - 10, 42);

  // ─── DATOS DEL CLIENTE Y SERVICIO (DOS COLUMNAS) ───────────────────────────
  const col1X = 16;
  const col2X = 115;
  let curY = 50;

  // Tarjeta Cliente
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(col1X, curY, 92, 38, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(2, 132, 199);
  doc.text("DATOS DEL CLIENTE", col1X + 4, curY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const clientTitle = data.clientName.length > 32 ? data.clientName.slice(0, 32) + "..." : data.clientName;
  doc.text(clientTitle, col1X + 4, curY + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Código: ${data.clientCode || "Sin código"}`, col1X + 4, curY + 19);
  doc.text(`WhatsApp: ${data.whatsapp || "No registrado"}`, col1X + 4, curY + 24);
  doc.text(`Ubicación: ${data.galeria || "General / No especificada"}`, col1X + 4, curY + 29);
  const routerText = data.router ? `${data.router}${data.portNumber ? ` · Puerto ${data.portNumber}` : ""}` : "Conexión asignada";
  doc.text(`Red: ${routerText}`, col1X + 4, curY + 34);

  // Tarjeta Servicio y Pago
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(col2X, curY, 85, 38, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(2, 132, 199);
  doc.text("DETALLE DEL SERVICIO Y PAGO", col2X + 4, curY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Concepto:", col2X + 4, curY + 13);
  doc.setFont("helvetica", "bold");
  doc.text("Servicio de Internet Mensual", col2X + 32, curY + 13);

  doc.setFont("helvetica", "normal");
  doc.text("Período Cancelado:", col2X + 4, curY + 19);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(data.periodLabel, col2X + 32, curY + 19);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Fecha de Pago:", col2X + 4, curY + 24);
  doc.text(data.paidAt, col2X + 32, curY + 24);

  doc.text("Medio de Pago:", col2X + 4, curY + 29);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(2, 132, 199);
  doc.text(data.method || "EFECTIVO", col2X + 32, curY + 29);

  if (data.note) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Nota: ${data.note.slice(0, 32)}`, col2X + 4, curY + 34);
  }

  // ─── FILA TOTAL Y ESTADO ──────────────────────────────────────────────────
  curY += 44;

  // Caja Total
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(187, 247, 208); // emerald-200
  doc.roundedRect(col1X, curY, 110, 26, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text("TOTAL CANCELADO:", col1X + 6, curY + 10);

  doc.setFontSize(18);
  doc.text(`S/. ${data.amount.toFixed(2)}`, col1X + 6, curY + 21);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Moneda: Soles (PEN) · Incluye servicio del período", col1X + 45, curY + 21);

  // Sello PAGADO
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.roundedRect(col2X + 25, curY + 4, 60, 18, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("PAGADO CONFORME", col2X + 55, curY + 14, { align: "center" });

  doc.setFontSize(7);
  doc.text("VERIFICADO POR INFOSISTEL", col2X + 55, curY + 19, { align: "center" });

  // ─── PIE DE PÁGINA ────────────────────────────────────────────────────────
  doc.setDrawColor(226, 232, 240);
  doc.line(16, pageHeight - 16, pageWidth - 10, pageHeight - 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Este comprobante constituye constancia formal de pago para control administrativo y sustento de cobranza.",
    16,
    pageHeight - 10
  );
  doc.text("INFOSISTEL · Huancayo, Junín", pageWidth - 10, pageHeight - 10, { align: "right" });

  const safeFilename = `Recibo_Internet_${data.receiptNumber}_${(data.clientName || "cliente").replace(/\s+/g, "_")}.pdf`;
  safeSavePdf(doc, safeFilename);
}

/**
 * Genera un reporte PDF con la tabla completa o filtrada del historial de pagos de internet.
 */
export function generateInternetHistoryReportPDF(
  items: InternetHistoryItem[],
  filterTitle: string = "Historial Completo de Cobranza y Recibos"
) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4", // 297 x 210 mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Cabecera institucional
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("INFOSISTEL — SISTEMA DE COBRANZA DE INTERNET", 14, 16);

  doc.setFontSize(11);
  doc.setTextColor(2, 132, 199);
  doc.text(filterTitle, 14, 23);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  const now = new Date();
  const dateFormatted = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  doc.text(`Generado el: ${dateFormatted} · Total registros: ${items.length}`, 14, 28);

  // Estadísticas rápidas
  const totalPaid = items.filter((i) => i.status === "PAGADO").reduce((sum, i) => sum + i.amount, 0);
  const totalOverdue = items.filter((i) => i.status === "VENCIDO").reduce((sum, i) => sum + i.amount, 0);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text(`Total Recaudado: S/. ${totalPaid.toFixed(2)}`, pageWidth - 14, 20, { align: "right" });
  doc.setTextColor(185, 28, 28);
  doc.text(`Total en Mora / Vencido: S/. ${totalOverdue.toFixed(2)}`, pageWidth - 14, 26, { align: "right" });

  const tableHeaders = [
    [
      "N° RECIBO",
      "CÓD.",
      "CLIENTE",
      "UBICACIÓN / STAND",
      "PERÍODO",
      "F. VENC.",
      "F. PAGO",
      "MEDIO",
      "MONTO",
      "ESTADO",
    ],
  ];

  const tableBody = items.map((item) => {
    return [
      item.receiptNumber ? `#${item.receiptNumber}` : "-",
      item.clientCode || "-",
      item.clientName,
      item.galeria || "-",
      item.periodLabel,
      item.dueDate,
      item.paidAt || "-",
      item.method || "-",
      `S/. ${item.amount.toFixed(2)}`,
      item.status === "VENCIDO" && item.daysOverdue
        ? `VENCIDO (+${item.daysOverdue}d)`
        : item.status,
    ];
  });

  safeRunAutoTable(doc, {
    head: tableHeaders,
    body: tableBody,
    startY: 33,
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      valign: "middle",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { halign: "center", fontStyle: "bold", cellWidth: 22 },
      1: { halign: "center", fontStyle: "bold", cellWidth: 18 },
      2: { cellWidth: 50 },
      3: { cellWidth: 40 },
      4: { halign: "center", cellWidth: 26 },
      5: { halign: "center", cellWidth: 22 },
      6: { halign: "center", cellWidth: 22 },
      7: { halign: "center", cellWidth: 22 },
      8: { halign: "right", fontStyle: "bold", cellWidth: 24 },
      9: { halign: "center", fontStyle: "bold", cellWidth: 28 },
    },
    didParseCell: (hookData: any) => {
      if (hookData.section === "body" && hookData.column.index === 9) {
        const text = String(hookData.cell.raw);
        if (text.startsWith("PAGADO")) {
          hookData.cell.styles.textColor = [22, 101, 52];
          hookData.cell.styles.fillColor = [240, 253, 244];
        } else if (text.startsWith("VENCIDO")) {
          hookData.cell.styles.textColor = [185, 28, 28];
          hookData.cell.styles.fillColor = [254, 242, 242];
        } else {
          hookData.cell.styles.textColor = [180, 83, 9];
          hookData.cell.styles.fillColor = [254, 252, 232];
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 16 },
  });

  safeSavePdf(doc, `Reporte_Internet_Lista_INFOSISTEL_${todayLima(now)}.pdf`);
}

