import jsPDF from "jspdf";
import autoTable, { applyPlugin } from "jspdf-autotable";
import { INFOSISTEL_LOGO_BASE64 } from "./infosistelLogoBase64";

try {
  applyPlugin(jsPDF);
} catch {
  // Handled safely
}

export interface QuotationPdfItem {
  id?: string;
  description: string;
  brand?: string | null;
  model?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string | null;
}

export interface QuotationPdfData {
  code: string;
  clientName: string;
  clientDocType?: string | null;
  clientDocNum?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientAddress?: string | null;
  attentionTo?: string | null;
  issueDate: Date | string;
  validDays: number;
  currency: string; // "PEN" | "USD"
  includeIgv: boolean;
  subtotal: number;
  discount?: number;
  igv: number;
  total: number;
  deliveryTime?: string | null;
  paymentMethod?: string | null;
  warranty?: string | null;
  notes?: string | null;
  items: QuotationPdfItem[];
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
  if (typeof window === "undefined") {
    return;
  }
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

function formatDate(dateVal: Date | string): string {
  if (typeof dateVal === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateVal);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function addDays(dateVal: Date | string, days: number): string {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "-";
  d.setDate(d.getDate() + days);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Convert number to Spanish words for Peruvian commercial documents
function numberToSpanishWords(amount: number, currency: string): string {
  const units = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const tens = [
    "",
    "DIEZ",
    "VEINTE",
    "TREINTA",
    "CUARENTA",
    "CINCUENTA",
    "SESENTA",
    "SETENTA",
    "OCHENTA",
    "NOVENTA",
  ];
  const teens = [
    "DIEZ",
    "ONCE",
    "DOCE",
    "TRECE",
    "CATORCE",
    "QUINCE",
    "DIECISÉIS",
    "DIECISIETE",
    "DIECIOCHO",
    "DIECINUEVE",
  ];
  const hundreds = [
    "",
    "CIENTO",
    "DOSCIENTOS",
    "TRESCIENTOS",
    "CUATROCIENTOS",
    "QUINIENTOS",
    "SEISCIENTOS",
    "SETECIENTOS",
    "OCHOCIENTOS",
    "NOVECIENTOS",
  ];

  function convertGroup(n: number): string {
    let output = "";
    if (n === 100) return "CIEN";
    if (n > 99) {
      output += hundreds[Math.floor(n / 100)] + " ";
      n %= 100;
    }
    if (n >= 10 && n <= 19) {
      output += teens[n - 10] + " ";
      return output.trim();
    }
    if (n >= 21 && n <= 29) {
      output += "VEINTI" + units[n - 20] + " ";
      return output.trim();
    }
    if (n >= 20) {
      output += tens[Math.floor(n / 10)] + " ";
      n %= 10;
      if (n > 0) output += "Y ";
    }
    if (n > 0) {
      output += units[n] + " ";
    }
    return output.trim();
  }

  const integerPart = Math.floor(Math.abs(amount));
  const decimalPart = Math.round((Math.abs(amount) - integerPart) * 100);
  const centsStr = String(decimalPart).padStart(2, "0") + "/100";

  let words = "";
  if (integerPart === 0) {
    words = "CERO";
  } else {
    const millions = Math.floor(integerPart / 1000000);
    const thousands = Math.floor((integerPart % 1000000) / 1000);
    const remainder = integerPart % 1000;

    if (millions > 0) {
      words += (millions === 1 ? "UN MILLÓN" : convertGroup(millions) + " MILLONES") + " ";
    }
    if (thousands > 0) {
      words += (thousands === 1 ? "MIL" : convertGroup(thousands) + " MIL") + " ";
    }
    if (remainder > 0) {
      words += convertGroup(remainder) + " ";
    }
  }

  const currencyName = currency === "USD" ? "DÓLARES AMERICANOS" : "SOLES";
  return `SON: ${words.trim()} CON ${centsStr} ${currencyName}`;
}

/**
 * Generates an executive, highly professional PDF quotation with official Infosistel branding.
 */
export function generateQuotationPDF(data: QuotationPdfData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const brandPrimary = [10, 95, 219] as const; // #0a5fdb
  const brandDark = [15, 23, 42] as const; // #0f172a
  const mutedGray = [100, 116, 139] as const; // #64748b
  const lightBg = [248, 250, 252] as const; // #f8fafc
  const cardBorder = [226, 232, 240] as const;

  const currSymbol = data.currency === "USD" ? "$" : "S/.";

  // Top Header: Logo on left
  try {
    doc.addImage(INFOSISTEL_LOGO_BASE64, "PNG", 14, 12, 50, 6.1);
  } catch (err) {
    console.warn("Could not add image logo, using text header:", err);
    doc.setTextColor(...brandPrimary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("INFOSISTEL", 14, 16);
  }

  // Company info below logo
  doc.setTextColor(...brandDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("TECNOLOGÍA · VENTA DE EQUIPOS · SERVICIO TÉCNICO · REPUESTOS", 14, 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...mutedGray);
  doc.text("RUC: 10444342247  |  Huancayo, Junín, Perú", 14, 27.5);
  doc.text("WhatsApp: (+51) 964 648 202  |  Correo: ecaballero@hotmail.com  |  Sitio Web: infosistel.pe", 14, 31.5);

  // Right Header Box (Quotation Details Card)
  const headerBoxWidth = 72;
  const headerBoxHeight = 27;
  const headerBoxX = pageWidth - 14 - headerBoxWidth;
  const headerBoxY = 10;

  doc.setFillColor(...lightBg);
  doc.setDrawColor(...brandPrimary);
  doc.setLineWidth(0.5);
  doc.roundedRect(headerBoxX, headerBoxY, headerBoxWidth, headerBoxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...brandPrimary);
  doc.text("COTIZACIÓN COMERCIAL", headerBoxX + headerBoxWidth / 2, headerBoxY + 6.5, {
    align: "center",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...brandDark);
  doc.text(data.code, headerBoxX + headerBoxWidth / 2, headerBoxY + 12.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...mutedGray);
  doc.text(`Fecha de emisión: ${formatDate(data.issueDate)}`, headerBoxX + 6, headerBoxY + 18);
  doc.text(`Válido hasta: ${addDays(data.issueDate, data.validDays)}`, headerBoxX + 6, headerBoxY + 22);
  doc.text(
    `Moneda: ${data.currency === "USD" ? "Dólares ($)" : "Soles (S/.)"}`,
    headerBoxX + 6,
    headerBoxY + 25.5
  );

  // Customer Information Box
  const clientBoxY = 40;
  const clientBoxHeight = 22;
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, clientBoxY, pageWidth - 28, clientBoxHeight, 2, 2, "FD");

  // Left Column of Client Info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...brandDark);
  doc.text("CLIENTE / RAZÓN SOCIAL:", 18, clientBoxY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientName || "Cliente Varios", 57, clientBoxY + 5.5);

  doc.setFont("helvetica", "bold");
  doc.text(`${data.clientDocType || "DOC"}:`, 18, clientBoxY + 11);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientDocNum || "Sin documento", 57, clientBoxY + 11);

  doc.setFont("helvetica", "bold");
  doc.text("DIRECCIÓN:", 18, clientBoxY + 16.5);
  doc.setFont("helvetica", "normal");
  const addressText = data.clientAddress || "Huancayo";
  doc.text(addressText.length > 40 ? addressText.slice(0, 40) + "..." : addressText, 57, clientBoxY + 16.5);

  // Right Column of Client Info
  const rightColX = pageWidth / 2 + 10;
  doc.setFont("helvetica", "bold");
  doc.text("ATENCIÓN:", rightColX, clientBoxY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(data.attentionTo || data.clientName || "-", rightColX + 22, clientBoxY + 5.5);

  doc.setFont("helvetica", "bold");
  doc.text("TELÉFONO:", rightColX, clientBoxY + 11);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientPhone || "-", rightColX + 22, clientBoxY + 11);

  doc.setFont("helvetica", "bold");
  doc.text("CORREO:", rightColX, clientBoxY + 16.5);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientEmail || "-", rightColX + 22, clientBoxY + 16.5);

  // Items Table
  const tableRows = data.items.map((it, idx) => {
    let desc = it.description;
    if (it.brand || it.model) {
      const extra = [it.brand, it.model].filter(Boolean).join(" - ");
      desc += `\nMarca/Modelo: ${extra}`;
    }
    if (it.notes) {
      desc += `\nNota: ${it.notes}`;
    }
    return [
      (idx + 1).toString(),
      it.quantity.toString(),
      desc,
      `${currSymbol} ${it.unitPrice.toFixed(2)}`,
      `${currSymbol} ${it.total.toFixed(2)}`,
    ];
  });

  safeRunAutoTable(doc, {
    startY: clientBoxY + clientBoxHeight + 5,
    head: [["#", "Cant.", "Descripción del Producto / Servicio", "P. Unitario", "Importe"]],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [10, 95, 219],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 15, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 110 },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 25, halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14, bottom: 25 },
  });

  // Calculate totals section Y
  let currentY = (doc as any).lastAutoTable?.finalY ?? 140;

  // If table ended too close to bottom, add a new page
  if (currentY + 86 > pageHeight - 15) {
    doc.addPage();
    currentY = 18;
  } else {
    currentY += 4;
  }

  // Amount in words
  const wordsText = numberToSpanishWords(data.total, data.currency);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...mutedGray);
  doc.text(wordsText, 14, currentY + 3);

  // Totals Box on Right
  const totalsBoxWidth = 70;
  const totalsBoxX = pageWidth - 14 - totalsBoxWidth;
  const totalsBoxY = currentY + 6;

  doc.setFillColor(...lightBg);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(totalsBoxX, totalsBoxY, totalsBoxWidth, 23, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...brandDark);
  doc.text("SUBTOTAL:", totalsBoxX + 4, totalsBoxY + 5);
  doc.text(`${currSymbol} ${data.subtotal.toFixed(2)}`, totalsBoxX + totalsBoxWidth - 4, totalsBoxY + 5, {
    align: "right",
  });

  if ((data.discount ?? 0) > 0) {
    doc.text("DESCUENTO:", totalsBoxX + 4, totalsBoxY + 9.5);
    doc.setTextColor(220, 38, 38);
    doc.text(
      `-${currSymbol} ${(data.discount ?? 0).toFixed(2)}`,
      totalsBoxX + totalsBoxWidth - 4,
      totalsBoxY + 9.5,
      { align: "right" }
    );
    doc.setTextColor(...brandDark);
  }

  const igvLabel = data.includeIgv ? "I.G.V. (18%):" : "I.G.V. (Exonerado):";
  doc.text(igvLabel, totalsBoxX + 4, totalsBoxY + 14);
  doc.text(`${currSymbol} ${data.igv.toFixed(2)}`, totalsBoxX + totalsBoxWidth - 4, totalsBoxY + 14, {
    align: "right",
  });

  // Final Total Highlight
  doc.setFillColor(...brandPrimary);
  doc.roundedRect(totalsBoxX + 2, totalsBoxY + 16.5, totalsBoxWidth - 4, 5.5, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL GENERAL:", totalsBoxX + 4, totalsBoxY + 20.5);
  doc.text(
    `${currSymbol} ${data.total.toFixed(2)}`,
    totalsBoxX + totalsBoxWidth - 4,
    totalsBoxY + 20.5,
    { align: "right" }
  );

  // Commercial Terms & Bank Accounts (2 boxes on Left)
  const infoBoxesY = totalsBoxY + 26;
  const halfWidth = (pageWidth - 28 - 4) / 2;

  // Box 1: Commercial Conditions
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(14, infoBoxesY, halfWidth, 26, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...brandPrimary);
  doc.text("CONDICIONES COMERCIALES", 18, infoBoxesY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...brandDark);
  doc.text(`• Validez de la oferta: ${data.validDays} días calendario`, 18, infoBoxesY + 9.5);
  doc.text(`• Tiempo de entrega: ${data.deliveryTime || "Inmediata / según stock"}`, 18, infoBoxesY + 13.5);
  doc.text(`• Forma de pago: ${data.paymentMethod || "Contado contra entrega / Transferencia"}`, 18, infoBoxesY + 17.5);
  doc.text(`• Garantía: ${data.warranty || "12 meses de garantía oficial Infosistel"}`, 18, infoBoxesY + 21.5);
  if (data.notes) {
    doc.text(`• Obs: ${data.notes.slice(0, 42)}`, 18, infoBoxesY + 25);
  }

  // Box 2: Bank Accounts
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(14 + halfWidth + 4, infoBoxesY, halfWidth, 26, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...brandPrimary);
  doc.text("CUENTAS BANCARIAS PARA DEPÓSITO", 18 + halfWidth + 4, infoBoxesY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...brandDark);
  doc.text("• BCP Soles: 355-98765432-0-12 (CCI: 002-3550098765432012-34)", 18 + halfWidth + 4, infoBoxesY + 9.5);
  doc.text("• BBVA Soles: 0011-0234-0200987654", 18 + halfWidth + 4, infoBoxesY + 13.5);
  doc.text("• Interbank Soles: 200-3001234567", 18 + halfWidth + 4, infoBoxesY + 17.5);
  doc.text("• Yape / Plin: 964 648 202 (Infosistel / Carlos Zárate)", 18 + halfWidth + 4, infoBoxesY + 21.5);
  doc.text("• Titular: INFOSISTEL", 18 + halfWidth + 4, infoBoxesY + 25);

  // Box 3: Company Location & Contact ("Visítanos en Huancayo" - Replaces signatures)
  const visitBoxY = infoBoxesY + 28.5;
  const visitBoxWidth = pageWidth - 28;
  const visitBoxHeight = 22.5;

  doc.setFillColor(...lightBg);
  doc.setDrawColor(...cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, visitBoxY, visitBoxWidth, visitBoxHeight, 2, 2, "FD");

  // Title with brand primary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...brandPrimary);
  doc.text("VISÍTANOS EN HUANCAYO", 18, visitBoxY + 5);

  // Left Column: Dirección
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...brandDark);
  doc.text("Dirección:", 18, visitBoxY + 9.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...brandDark);
  doc.text("• Av. Giráldez 274, Semisótano Stand S25, Huancayo", 18, visitBoxY + 13.5);
  doc.text("• Av. Giráldez 274, 1er Nivel Stand B-10, Huancayo", 18, visitBoxY + 17.5);

  // Right Column: Teléfono, Correo, Horario
  const visitCol2X = 110;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...brandDark);
  doc.text("Teléfono / WhatsApp:", visitCol2X, visitBoxY + 9.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("+51 964 648 202", visitCol2X + 28, visitBoxY + 9.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.text("Correo electrónico:", visitCol2X, visitBoxY + 13.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("ecaballero@hotmail.com", visitCol2X + 28, visitBoxY + 13.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.text("Horario de atención:", visitCol2X, visitBoxY + 17.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("Lun. a sáb., 9:00 am – 7:00 pm", visitCol2X + 28, visitBoxY + 17.5);

  // Page Numbers and Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...mutedGray);
    doc.text(
      "Infosistel · Tecnología · Servicio Técnico · Cotización Oficial emitida vía infosistel.pe",
      14,
      pageHeight - 6
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 6, { align: "right" });
  }

  const cleanCode = data.code.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Cotizacion_INFOSISTEL_${cleanCode}.pdf`;
  safeSavePdf(doc, filename);
  return doc;
}
