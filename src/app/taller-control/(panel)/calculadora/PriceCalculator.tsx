"use client";

import { useMemo, useState } from "react";
import { Calculator, Copy, Check, RotateCcw, ReceiptText, ShieldCheck } from "lucide-react";

const IGV_RATE = 0.18;
const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";
const inputClass = "admin-field mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm text-fg";

type Method = "margen" | "recargo";
type SaleView = "con_igv" | "sin_igv";

function Row({ k, v, strong, highlight }: { k: string; v: string; strong?: boolean; highlight?: "emerald" | "blue" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-fg-muted">{k}</span>
      <span
        className={`${
          strong ? "font-bold text-fg" : "font-semibold text-fg"
        } ${highlight === "emerald" ? "text-emerald-600 dark:text-emerald-400 font-bold" : ""} ${
          highlight === "blue" ? "text-blue-600 dark:text-blue-400 font-bold" : ""
        }`}
      >
        {v}
      </span>
    </div>
  );
}

const money = (n: number, symbol = "S/") =>
  `${symbol} ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const num = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function PriceCalculator() {
  const [product, setProduct] = useState("");
  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN");
  const [fx, setFx] = useState("3.75");
  const [buy, setBuy] = useState("");
  const [costHasCredit, setCostHasCredit] = useState(false); // Por defecto: costo directo pagado de bolsillo
  const [method, setMethod] = useState<Method>("margen");
  const [percent, setPercent] = useState("15");
  const [extra, setExtra] = useState("0");
  const [qty, setQty] = useState("1");
  const [roundUp, setRoundUp] = useState(false);
  const [activeSaleView, setActiveSaleView] = useState<SaleView>("con_igv");
  const [copiedMode, setCopiedMode] = useState<string | null>(null);

  const r = useMemo(() => {
    const rate = currency === "USD" ? num(fx) : 1;
    const buyPen = num(buy) * rate;
    // Si la empresa deduce crédito fiscal a la compra, descuenta el 18%.
    // Si no (estándar para comercio/taller), el costo es el monto pagado directo.
    const netBuy = costHasCredit ? buyPen / (1 + IGV_RATE) : buyPen;
    const cost = netBuy + num(extra); // costo neto unitario
    const pct = num(percent);
    const q = Math.max(1, Math.floor(num(qty)) || 1);

    let priceSinIgv = 0;
    let invalid = "";
    if (method === "margen") {
      if (pct >= 100) invalid = "El margen sobre venta debe ser menor a 100%.";
      else priceSinIgv = cost / (1 - pct / 100);
    } else {
      priceSinIgv = cost * (1 + pct / 100);
    }

    if (roundUp && priceSinIgv > 0) {
      priceSinIgv = Math.ceil(priceSinIgv);
    }

    // Precio con IGV SIEMPRE es mayor que precio sin IGV (agrega el 18% para factura)
    let priceConIgv = priceSinIgv * (1 + IGV_RATE);
    if (roundUp && priceConIgv > 0) {
      priceConIgv = Math.ceil(priceConIgv);
    }

    const igvAmount = priceConIgv - priceSinIgv;
    const profit = priceSinIgv - cost;

    return {
      cost,
      priceSinIgv,
      priceConIgv,
      igvAmount,
      profit,
      totalSinIgv: priceSinIgv * q,
      totalConIgv: priceConIgv * q,
      totalProfit: profit * q,
      realMargin: priceSinIgv > 0 ? (profit / priceSinIgv) * 100 : 0,
      realMarkup: cost > 0 ? (profit / cost) * 100 : 0,
      pct,
      q,
      invalid,
      valid: !invalid && cost > 0,
    };
  }, [currency, fx, buy, costHasCredit, method, percent, extra, qty, roundUp]);

  const reset = () => {
    setProduct("");
    setCurrency("PEN");
    setFx("3.75");
    setBuy("");
    setCostHasCredit(false);
    setMethod("margen");
    setPercent("15");
    setExtra("0");
    setQty("1");
    setRoundUp(false);
  };

  const copy = async (mode: SaleView) => {
    const isCon = mode === "con_igv";
    const targetPrice = isCon ? r.priceConIgv : r.priceSinIgv;
    const targetTotal = isCon ? r.totalConIgv : r.totalSinIgv;
    const label = isCon ? "Precio con IGV (Factura)" : "Precio sin IGV (Normal)";

    const text = `${product ? product + " — " : ""}${label}: ${money(targetPrice)}${
      r.q > 1 ? ` | Total (${r.q} unid.): ${money(targetTotal)}` : ""
    }`;
    await navigator.clipboard.writeText(text);
    setCopiedMode(mode);
    setTimeout(() => setCopiedMode(null), 1500);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="admin-glass rounded-[var(--radius-lg)] p-6 lg:col-span-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-fg">Datos de la compra</h2>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-fg-muted hover:bg-bg-alt hover:text-fg"
          >
            <RotateCcw size={13} /> Limpiar
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="pc-product">
              Producto
            </label>
            <input
              id="pc-product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className={inputClass}
              placeholder="Ej. Mouse Gamer Logitech / Laptop Lenovo"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="pc-currency">
              Moneda de compra
            </label>
            <select
              id="pc-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "PEN" | "USD")}
              className={inputClass}
            >
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>

          {currency === "USD" ? (
            <div>
              <label className={labelClass} htmlFor="pc-fx">
                Tipo de cambio (S/ por US$)
              </label>
              <input
                id="pc-fx"
                type="number"
                min={0}
                step={0.01}
                value={fx}
                onChange={(e) => setFx(e.target.value)}
                className={inputClass}
              />
            </div>
          ) : (
            <div className="hidden sm:block" />
          )}

          <div>
            <label className={labelClass} htmlFor="pc-buy">
              Precio de compra ({currency === "USD" ? "US$" : "S/"})
            </label>
            <input
              id="pc-buy"
              type="number"
              min={0}
              step={0.01}
              value={buy}
              onChange={(e) => setBuy(e.target.value)}
              className={inputClass}
              placeholder="0.00"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="pc-credit">
              Tipo de costo de compra
            </label>
            <select
              id="pc-credit"
              value={costHasCredit ? "credito" : "directo"}
              onChange={(e) => setCostHasCredit(e.target.value === "credito")}
              className={inputClass}
            >
              <option value="directo">Precio de compra directo (Estándar)</option>
              <option value="credito">Deducir crédito fiscal (-18% IGV compra)</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="pc-method">
              Método de cálculo
            </label>
            <select
              id="pc-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className={inputClass}
            >
              <option value="margen">Margen sobre venta</option>
              <option value="recargo">Recargo sobre costo</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="pc-percent">
              {method === "margen" ? "Margen sobre venta (%)" : "Recargo sobre costo (%)"}
            </label>
            <input
              id="pc-percent"
              type="number"
              min={0}
              step={0.1}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="pc-extra">
              Otros costos adicionales (S/)
            </label>
            <input
              id="pc-extra"
              type="number"
              min={0}
              step={0.01}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="pc-qty">
              Cantidad
            </label>
            <input
              id="pc-qty"
              type="number"
              min={1}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={inputClass}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg sm:col-span-2">
            <input
              type="checkbox"
              checked={roundUp}
              onChange={(e) => setRoundUp(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent,#2563eb)]"
            />
            Redondear precios finales al sol superior
          </label>
        </div>
      </div>

      {/* Panel de Resultado con ambos precios (Con IGV y Sin IGV) claros */}
      <div className="admin-glass rounded-[var(--radius-lg)] p-6 lg:col-span-2 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
              <Calculator size={18} className="text-accent" /> Resultado de Venta
            </h2>
          </div>

          {r.invalid && <p className="mt-4 text-sm font-medium text-red-600">{r.invalid}</p>}

          {!r.valid && !r.invalid ? (
            <p className="mt-4 text-sm text-fg-muted">Ingresa el precio de compra para ver el cálculo.</p>
          ) : (
            !r.invalid && (
              <>
                {/* Selector de vista destacada */}
                <div className="mt-4 flex rounded-xl border border-border/60 bg-bg-alt/50 p-1">
                  <button
                    type="button"
                    onClick={() => setActiveSaleView("con_igv")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                      activeSaleView === "con_igv"
                        ? "bg-accent text-white shadow-sm"
                        : "text-fg-muted hover:text-fg"
                    }`}
                  >
                    Con IGV (Factura)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSaleView("sin_igv")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                      activeSaleView === "sin_igv"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-fg-muted hover:text-fg"
                    }`}
                  >
                    Sin IGV (Normal)
                  </button>
                </div>

                {/* Tarjetas comparativas de precios: CON IGV (Mayor) vs SIN IGV (Menor) */}
                <div className="mt-4 grid grid-cols-1 gap-3">
                  {/* Tarjeta Con IGV */}
                  <div
                    className={`rounded-2xl p-4 transition-all border ${
                      activeSaleView === "con_igv"
                        ? "border-blue-500/40 bg-blue-500/10 ring-2 ring-blue-500/20"
                        : "border-border/40 bg-bg-surface/50 opacity-90"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ReceiptText size={15} className="text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                          Precio Con Factura (Con IGV 18%)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300">
                        Mayor (+18%)
                      </span>
                    </div>
                    <p className="mt-1 font-display text-3xl font-extrabold text-blue-900 dark:text-blue-100">
                      {money(r.priceConIgv)}
                    </p>
                    {r.q > 1 && (
                      <p className="mt-0.5 text-xs font-semibold text-fg-muted">
                        Total ({r.q} unid.): {money(r.totalConIgv)}
                      </p>
                    )}
                  </div>

                  {/* Tarjeta Sin IGV */}
                  <div
                    className={`rounded-2xl p-4 transition-all border ${
                      activeSaleView === "sin_igv"
                        ? "border-emerald-500/40 bg-emerald-500/10 ring-2 ring-emerald-500/20"
                        : "border-border/40 bg-bg-surface/50 opacity-90"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          Precio Venta Sin IGV (Normal / Boleta)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        Base imponible
                      </span>
                    </div>
                    <p className="mt-1 font-display text-3xl font-extrabold text-emerald-900 dark:text-emerald-100">
                      {money(r.priceSinIgv)}
                    </p>
                    {r.q > 1 && (
                      <p className="mt-0.5 text-xs font-semibold text-fg-muted">
                        Total ({r.q} unid.): {money(r.totalSinIgv)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Desglose detallado */}
                <div className="mt-4 rounded-xl border border-border/50 bg-bg-surface/40 px-3.5 py-2">
                  <Row k="Costo unitario" v={money(r.cost)} />
                  <Row k="Utilidad unitaria" v={money(r.profit)} strong highlight="emerald" />
                  <Row k="Venta sin IGV (Base)" v={money(r.priceSinIgv)} />
                  <Row k="IGV de venta (18%)" v={money(r.igvAmount)} />
                  <Row k="Precio con IGV (Factura)" v={money(r.priceConIgv)} strong highlight="blue" />
                  {r.q > 1 && <Row k={`Utilidad total (${r.q} unid.)`} v={money(r.totalProfit)} strong />}
                  <Row k="Margen real sobre venta" v={`${r.realMargin.toFixed(2)}%`} />
                  <Row k="Recargo real sobre costo" v={`${r.realMarkup.toFixed(2)}%`} />
                </div>
              </>
            )
          )}
        </div>

        {r.valid && !r.invalid && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => copy("con_igv")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 px-3 text-xs font-bold text-accent-fg transition-opacity hover:opacity-90 active:scale-95"
            >
              {copiedMode === "con_igv" ? <Check size={14} /> : <Copy size={14} />}
              {copiedMode === "con_igv" ? "¡Copiado!" : "Copiar con IGV"}
            </button>
            <button
              type="button"
              onClick={() => copy("sin_igv")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-500/20 active:scale-95"
            >
              {copiedMode === "sin_igv" ? <Check size={14} /> : <Copy size={14} />}
              {copiedMode === "sin_igv" ? "¡Copiado!" : "Copiar sin IGV"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
