"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Download,
  Share2,
  Calendar,
  Building2,
  Router,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Banknote,
  Smartphone,
  CreditCard,
  Hash,
  ArrowUpDown,
  Filter,
  DollarSign,
  TrendingUp,
  AlertCircle,
  FileText,
  User,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import {
  buildInternetPaymentHistory,
  formatMonthKeyLabel,
  internetReceiptWhatsappLink,
  type InternetClientRow,
  type InternetHistoryItem,
} from "../cobranza-internet/cobranza";
import { toggleInternetClientMonth } from "../cobranza-internet/internetActions";
import { InternetPaymentModal } from "../cobranza-internet/InternetPaymentModal";
import {
  generateInternetHistoryReportPDF,
  generateInternetReceiptPDF,
} from "@/lib/internetReceiptPdf";

interface InternetListaClientProps {
  initialClients: InternetClientRow[];
}

export function InternetListaClient({ initialClients }: InternetListaClientProps) {
  const [clients, setClients] = useState<InternetClientRow[]>(initialClients);
  const [today, setToday] = useState<Date | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAGADO" | "VENCIDO" | "PENDIENTE">("ALL");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [galeriaFilter, setGaleriaFilter] = useState<string>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [onlyAccumulatedDebt, setOnlyAccumulatedDebt] = useState<boolean>(false);

  // Paginación simple
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal de cobro rápido para meses vencidos/pendientes
  const [payingTarget, setPayingTarget] = useState<{
    client: InternetClientRow;
    item: InternetHistoryItem;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setToday(new Date());
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Genera todo el historial aplanado de pagos mes a mes
  const fullHistory: InternetHistoryItem[] = useMemo(() => {
    if (!today) return [];
    return buildInternetPaymentHistory(clients, today);
  }, [clients, today]);

  // Identificar clientes con 2 o más meses de deuda vencida acumulada
  const clientsWithMultiMonthDebt = useMemo(() => {
    const overdueCountByClient = new Map<string, number>();
    for (const item of fullHistory) {
      if (item.status === "VENCIDO") {
        overdueCountByClient.set(item.clientId, (overdueCountByClient.get(item.clientId) || 0) + 1);
      }
    }
    const set = new Set<string>();
    for (const [clientId, count] of overdueCountByClient.entries()) {
      if (count >= 2) set.add(clientId);
    }
    return set;
  }, [fullHistory]);

  // Galerías únicas para el filtro
  const galerias = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) {
      if (c.galeria) set.add(c.galeria.trim());
    }
    return Array.from(set).sort();
  }, [clients]);

  // Años disponibles en el historial
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    for (const item of fullHistory) {
      if (item.yearMonth) {
        set.add(item.yearMonth.slice(0, 4));
      }
    }
    return Array.from(set).sort().reverse();
  }, [fullHistory]);

  // Filtrado de la tabla
  const filteredHistory = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return fullHistory.filter((item) => {
      // Filtro de texto
      if (term) {
        const matchesClient = item.clientName.toLowerCase().includes(term);
        const matchesCode = (item.clientCode || "").toLowerCase().includes(term);
        const matchesGaleria = (item.galeria || "").toLowerCase().includes(term);
        const matchesReceipt = item.receiptNumber.includes(term);
        const matchesPeriod = item.periodLabel.toLowerCase().includes(term);
        if (!matchesClient && !matchesCode && !matchesGaleria && !matchesReceipt && !matchesPeriod) {
          return false;
        }
      }

      // Filtro de estado
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }

      // Filtro de método de pago
      if (methodFilter !== "ALL" && item.method !== methodFilter) {
        return false;
      }

      // Filtro de galería
      if (galeriaFilter !== "ALL" && item.galeria !== galeriaFilter) {
        return false;
      }

      // Filtro de año
      if (yearFilter !== "ALL" && !item.yearMonth.startsWith(yearFilter)) {
        return false;
      }

      // Filtro de deudores acumulados (2+ meses atrasados)
      if (onlyAccumulatedDebt && !clientsWithMultiMonthDebt.has(item.clientId)) {
        return false;
      }

      return true;
    });
  }, [
    fullHistory,
    searchTerm,
    statusFilter,
    methodFilter,
    galeriaFilter,
    yearFilter,
    onlyAccumulatedDebt,
    clientsWithMultiMonthDebt,
  ]);

  // Totales y KPIs
  const stats = useMemo(() => {
    let totalCollected = 0;
    let totalOverdue = 0;
    let paidCount = 0;
    let overdueCount = 0;

    for (const item of filteredHistory) {
      if (item.status === "PAGADO") {
        totalCollected += item.amount;
        paidCount++;
      } else if (item.status === "VENCIDO") {
        totalOverdue += item.amount;
        overdueCount++;
      }
    }

    return {
      totalCollected,
      totalOverdue,
      paidCount,
      overdueCount,
      totalRecords: filteredHistory.length,
    };
  }, [filteredHistory]);

  // Paginación
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredHistory.length / pageSize) || 1;

  // Acciones: WhatsApp
  const handleSendWhatsapp = (item: InternetHistoryItem) => {
    if (item.status === "PAGADO") {
      const link = internetReceiptWhatsappLink({
        whatsapp: item.whatsapp,
        clientName: item.clientName,
        clientCode: item.clientCode,
        receiptNumber: item.receiptNumber,
        periodLabel: item.periodLabel,
        amount: item.amount,
        paidAt: item.paidAt || item.dueDate,
        method: item.method,
        galeria: item.galeria,
      });
      window.open(link, "_blank");
    } else {
      // Mensaje de cobro formal indicando el mes pendiente y correlativo de comprobante
      const clean = item.whatsapp.replace(/\D/g, "");
      const number = clean.length === 9 ? `51${clean}` : clean;
      const codeTxt = item.clientCode ? ` (${item.clientCode})` : "";
      const galTxt = item.galeria ? ` · ${item.galeria}` : "";
      const daysTxt = item.daysOverdue && item.daysOverdue > 0 ? `venció hace ${item.daysOverdue} días` : `venció`;

      const msg =
        `Hola ${item.clientName}${codeTxt}, te saludamos de INFOSISTEL INTERNET${galTxt}.\n\n` +
        `Te recordamos que mantienes pendiente el pago de tu servicio correspondiente al mes de *${item.periodLabel}* por el monto de *S/. ${item.amount.toFixed(2)}* (${daysTxt}).\n\n` +
        `Por favor envíanos tu comprobante o confirma tu pago por este medio para registrar tu Recibo N° #${item.receiptNumber} y mantener tu señal activa. Muchas gracias.`;

      window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, "_blank");
    }
  };

  // Acciones: Descargar PDF Individual
  const handleDownloadSinglePDF = (item: InternetHistoryItem) => {
    generateInternetReceiptPDF({
      receiptNumber: item.receiptNumber,
      clientName: item.clientName,
      clientCode: item.clientCode,
      whatsapp: item.whatsapp,
      galeria: item.galeria,
      router: item.router,
      portNumber: item.portNumber,
      periodLabel: item.periodLabel,
      dueDate: item.dueDate,
      paidAt: item.paidAt || item.dueDate,
      amount: item.amount,
      method: item.method || "EFECTIVO",
      note: item.note || null,
    });
    showToast(`✓ Recibo N° ${item.receiptNumber} descargado en PDF`);
  };

  // Acciones: Exportar Reporte Completo
  const handleExportReportPDF = () => {
    let title = "Reporte General de Cobranza de Internet";
    if (statusFilter !== "ALL") title += ` · Solo ${statusFilter}`;
    if (yearFilter !== "ALL") title += ` · Año ${yearFilter}`;
    if (galeriaFilter !== "ALL") title += ` · ${galeriaFilter}`;

    generateInternetHistoryReportPDF(filteredHistory, title);
    showToast(`✓ Reporte de ${filteredHistory.length} registros exportado en PDF`);
  };

  return (
    <div className="space-y-6">
      {/* Toast flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-bold text-white shadow-2xl animate-slide-up border border-slate-700">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── CABECERA PRINCIPAL ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
              <FileText size={22} />
            </span>
            <div>
              <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Internet Lista — Historial y Recibos
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Control histórico mes a mes, comprobantes con correlativo de 6 dígitos, envío por WhatsApp y descarga de PDF ante reclamos de clientes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/taller-control/cobranza-internet"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span>Ver Mapa y Clientes</span>
            <ArrowRight size={14} />
          </Link>

          <button
            type="button"
            onClick={handleExportReportPDF}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-sky-500/20 hover:bg-sky-700 active:scale-95 transition-all"
          >
            <Download size={15} />
            <span>Exportar Historial (PDF)</span>
          </button>
        </div>
      </div>

      {/* ─── TARJETAS DE INDICADORES (KPIS) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Recaudado */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-white to-white p-5 shadow-xs dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 dark:border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Total Recaudado
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <TrendingUp size={16} />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-black text-slate-900 dark:text-white">
            S/. {stats.totalCollected.toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {stats.paidCount} comprobante(s) emitidos y pagados
          </p>
        </div>

        {/* Total en Mora / Vencido */}
        <div className="relative overflow-hidden rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-white to-white p-5 shadow-xs dark:from-rose-950/30 dark:via-slate-900 dark:to-slate-900 dark:border-rose-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Deuda Vencida
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-300">
              <AlertTriangle size={16} />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-black text-rose-600 dark:text-rose-400">
            S/. {stats.totalOverdue.toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {stats.overdueCount} mes(es) vencidos sin abonar
          </p>
        </div>

        {/* Comprobantes Emitidos */}
        <div className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-white to-white p-5 shadow-xs dark:from-sky-950/30 dark:via-slate-900 dark:to-slate-900 dark:border-sky-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              Recibos Emitidos
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
              <Hash size={16} />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-black text-slate-900 dark:text-white">
            {stats.paidCount}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Con correlativo oficial de 6 dígitos
          </p>
        </div>

        {/* Deuda Acumulada 2+ Meses */}
        <div
          onClick={() => setOnlyAccumulatedDebt((prev) => !prev)}
          className={`relative overflow-hidden rounded-3xl border p-5 shadow-xs cursor-pointer transition-all ${
            onlyAccumulatedDebt
              ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30"
              : "border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-white to-white hover:border-amber-500/40 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 dark:border-amber-500/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Mora 2+ Meses
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <AlertCircle size={16} />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-black text-amber-600 dark:text-amber-400">
            {clientsWithMultiMonthDebt.size} clientes
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {onlyAccumulatedDebt ? "✓ Filtro activo (clic para quitar)" : "Deben 2 o más meses (clic para filtrar)"}
          </p>
        </div>
      </div>

      {/* ─── BARRA DE BÚSQUEDA Y FILTROS ─── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-6">
          {/* Buscador de texto */}
          <div className="sm:col-span-2 relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por cliente, código (ej: F04), stand o N° recibo..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-800/40 dark:text-white dark:focus:bg-slate-850"
            />
          </div>

          {/* Filtro Estado */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-800/40 dark:text-white"
            >
              <option value="ALL">Todos los estados</option>
              <option value="PAGADO">Solo Pagados</option>
              <option value="VENCIDO">Solo Vencidos (Mora)</option>
              <option value="PENDIENTE">Solo Pendientes</option>
            </select>
          </div>

          {/* Filtro Medio de Pago */}
          <div>
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-800/40 dark:text-white"
            >
              <option value="ALL">Todos los medios</option>
              <option value="EFECTIVO">EFECTIVO</option>
              <option value="YAPE 1">YAPE 1</option>
              <option value="YAPE 2">YAPE 2</option>
            </select>
          </div>

          {/* Filtro Galería */}
          <div>
            <select
              value={galeriaFilter}
              onChange={(e) => {
                setGaleriaFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-800/40 dark:text-white"
            >
              <option value="ALL">Todas las galerías</option>
              {galerias.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Año */}
          <div>
            <select
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-800/40 dark:text-white"
            >
              <option value="ALL">Todos los años</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Año {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Resumen de resultados filtrados */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div>
            Mostrando <strong className="text-slate-900 dark:text-white">{filteredHistory.length}</strong> registro(s) de cobranza
            {onlyAccumulatedDebt && (
              <span className="ml-2 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                Filtrado por mora acumulada (2+ meses)
              </span>
            )}
          </div>

          {(searchTerm || statusFilter !== "ALL" || methodFilter !== "ALL" || galeriaFilter !== "ALL" || yearFilter !== "ALL" || onlyAccumulatedDebt) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("ALL");
                setMethodFilter("ALL");
                setGaleriaFilter("ALL");
                setYearFilter("ALL");
                setOnlyAccumulatedDebt(false);
                setCurrentPage(1);
              }}
              className="font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>
      </div>

      {/* ─── TABLA DE HISTORIAL Y RECIBOS ─── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5">N° Recibo</th>
                <th className="px-4 py-3.5">Código & Cliente</th>
                <th className="px-4 py-3.5">Ubicación / Red</th>
                <th className="px-4 py-3.5">Período</th>
                <th className="px-4 py-3.5">F. Inicio</th>
                <th className="px-4 py-3.5">Vencimiento</th>
                <th className="px-4 py-3.5">F. Pago Real</th>
                <th className="px-4 py-3.5">Medio</th>
                <th className="px-4 py-3.5 text-right">Monto</th>
                <th className="px-4 py-3.5 text-center">Estado</th>
                <th className="px-4 py-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No se encontraron registros de cobranza para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isPaid = item.status === "PAGADO";
                  const isOverdue = item.status === "VENCIDO";
                  const isYape = item.method === "YAPE 1" || item.method === "YAPE 2";

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/40 ${
                        isOverdue ? "bg-rose-50/30 dark:bg-rose-950/10" : ""
                      }`}
                    >
                      {/* N° Recibo (6 dígitos) */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          <Hash size={11} className="text-slate-400" />
                          {item.receiptNumber}
                        </span>
                      </td>

                      {/* Código & Cliente */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {item.clientCode && (
                            <span className="shrink-0 rounded-md bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[11px] font-black text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                              {item.clientCode}
                            </span>
                          )}
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.clientName}
                          </span>
                        </div>
                        {item.whatsapp && (
                          <div className="mt-0.5 text-[10px] text-slate-400 font-mono">
                            +{item.whatsapp}
                          </div>
                        )}
                      </td>

                      {/* Ubicación / Red */}
                      <td className="px-4 py-3.5">
                        <div className="text-slate-700 dark:text-slate-300">
                          {item.galeria || "General"}
                        </div>
                        {item.router && (
                          <div className="text-[10px] text-slate-400">
                            {item.router} {item.portNumber ? `· Pto ${item.portNumber}` : ""}
                          </div>
                        )}
                      </td>

                      {/* Período */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {item.periodLabel}
                        </span>
                      </td>

                      {/* Fecha de Inicio */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {item.startDate}
                      </td>

                      {/* Fecha de Vencimiento */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={
                            isOverdue
                              ? "font-bold text-rose-600 dark:text-rose-400"
                              : "text-slate-600 dark:text-slate-300"
                          }
                        >
                          {item.dueDate}
                        </span>
                      </td>

                      {/* Fecha de Pago Real */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {item.paidAt ? (
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {item.paidAt}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Pendiente</span>
                        )}
                      </td>

                      {/* Medio de Pago */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {item.method ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {isYape ? (
                              <Smartphone size={11} className="text-purple-600 dark:text-purple-400" />
                            ) : (
                              <Banknote size={11} className="text-emerald-600 dark:text-emerald-400" />
                            )}
                            {item.method}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Monto */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-display text-xs font-black text-slate-900 dark:text-white">
                        S/. {item.amount.toFixed(2)}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 size={11} />
                            Pagado
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 dark:text-rose-300">
                            <AlertTriangle size={11} />
                            Vencido {item.daysOverdue ? `(+${item.daysOverdue}d)` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                            <Clock size={11} />
                            Pendiente
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Botón WhatsApp */}
                          <button
                            type="button"
                            onClick={() => handleSendWhatsapp(item)}
                            title={isPaid ? "Enviar Recibo por WhatsApp" : "Enviar Recordatorio de Cobranza"}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 active:scale-95 transition-all dark:bg-emerald-500/20 dark:text-emerald-300"
                          >
                            <Share2 size={14} />
                          </button>

                          {/* Botón Descargar PDF */}
                          {isPaid && (
                            <button
                              type="button"
                              onClick={() => handleDownloadSinglePDF(item)}
                              title="Descargar Recibo en PDF"
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 active:scale-95 transition-all dark:bg-sky-500/20 dark:text-sky-300"
                            >
                              <Download size={14} />
                            </button>
                          )}

                          {/* Botón Pagar si está vencido/pendiente */}
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => {
                                const targetClient = clients.find((c) => c.id === item.clientId);
                                if (targetClient) {
                                  setPayingTarget({ client: targetClient, item });
                                }
                              }}
                              title="Registrar Pago e Ingresar a Caja"
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 active:scale-95 transition-all"
                            >
                              <DollarSign size={12} />
                              <span>Pagar</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>
              Página <strong className="text-slate-900 dark:text-white">{currentPage}</strong> de{" "}
              <strong className="text-slate-900 dark:text-white">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 font-bold disabled:opacity-40 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 font-bold disabled:opacity-40 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de cobro rápido desde la tabla */}
      {payingTarget && (
        <InternetPaymentModal
          isOpen={Boolean(payingTarget)}
          client={payingTarget.client}
          monthKey={payingTarget.item.yearMonth}
          monthLabel={payingTarget.item.periodLabel}
          initialAmount={payingTarget.item.amount}
          initialMethod="YAPE 1"
          onClose={() => setPayingTarget(null)}
          onConfirm={async (payment) => {
            const res = await toggleInternetClientMonth(payingTarget.client.id, payingTarget.item.yearMonth, {
              paid: true,
              amount: payment.amount,
              method: payment.method,
              paidAt: payment.paidAt,
              note: payment.note,
              receiptNumber: payment.receiptNumber,
              syncToCashbox: payment.syncToCashbox,
            });

            if (res.ok) {
              showToast(
                `✓ Pago de ${payingTarget.item.periodLabel} registrado con Recibo #${res.receiptNumber ?? payment.receiptNumber}`
              );

              // Actualizar estado local del cliente para reflejo inmediato
              setClients((prev) =>
                prev.map((c) => {
                  if (c.id !== payingTarget.client.id) return c;
                  const currentMonths = c.paidMonths ? JSON.parse(c.paidMonths) : {};
                  currentMonths[payingTarget.item.yearMonth] = {
                    status: "paid",
                    paidAt: payment.paidAt,
                    amount: payment.amount,
                    method: payment.method,
                    note: payment.note,
                    receiptNumber: res.receiptNumber ?? payment.receiptNumber,
                  };
                  return {
                    ...c,
                    paidMonths: JSON.stringify(currentMonths),
                    nextPaymentDate: res.newNextPaymentDate ?? c.nextPaymentDate,
                  };
                })
              );
            }
            return { receiptNumber: res.receiptNumber };
          }}
        />
      )}
    </div>
  );
}

