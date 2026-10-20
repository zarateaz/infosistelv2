"use client";

import { useMemo, useState } from "react";
import { Calculator, Copy, Check, RotateCcw } from "lucide-react";

const IGV_RATE = 0.18;
const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";
const inputClass = "admin-field mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm text-fg";

type Method = "margen" | "recargo";
type SaleView = "con_igv" | "sin_igv";

function Row({
  k,
  v,
  strong,
  accent,
}: {
  k: string;
  v: string;
  strong?: boolean;
  accent?: "green" | "blue";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-2.5 text-sm last:border-0">
      <span className="text-fg-muted font-medium">{k}</span>
      <span
        className={`${
          strong ? "font-bold text-fg text-base" : "font-semibold text-fg"
        } ${accent === "green" ? "!text-emerald-600 dark:!text-emerald-400 font-bold" : ""} ${
          accent === "blue" ? "!text-blue-600 dark:!text-blue-400 font-bold" : ""
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
  const [costHasCredit, setCostHasCredit] = useState(false);
  const [method, setMethod] = useState<Method>("margen");
  const [percent, setPercent] = useState("15");
  const [extra, setExtra] = useState("0");
  const [qty, setQty] = useState("1");
  const [roundUp, setRoundUp] = useState(false);
  const [saleMode, setSaleMode] = useState<SaleView>("con_igv");
  const [copied, setCopied] = useState(false);

  const r = useMemo(() => {
    const rate = currency === "USD" ? num(fx) : 1;
    const buyPen = num(buy) * rate;

    // Costo de compra:
    // - Si deduce crédito fiscal comercial: descuenta el 18% a la compra.
    // - Si compra normal directo (lo que salió del bolsillo): el costo es el monto pagado.
    const netBuy = costHasCredit ? buyPen / (1 + IGV_RATE) : buyPen;
    const cost = netBuy + num(extra);
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

    // Precio con IGV: SIEMPRE incluye el 18% adicional de la factura
    let priceConIgv = priceSinIgv * (1 + IGV_RATE);
    if (roundUp && priceConIgv > 0) {
      priceConIgv = Math.ceil(priceConIgv);
    }

    const igvAmount = priceConIgv - priceSinIgv;
    const profit = priceSinIgv - cost;

    const activeFinalPrice = saleMode === "con_igv" ? priceConIgv : priceSinIgv;
    const activeTotalPrice = activeFinalPrice * q;

    return {
      cost,
      priceSinIgv,
      priceConIgv,
      activeFinalPrice,
      activeTotalPrice,
      igvAmount,
      profit,
      totalProfit: profit * q,
      realMargin: priceSinIgv > 0 ? (profit / priceSinIgv) * 100 : 0,
      realMarkup: cost > 0 ? (profit / cost) * 100 : 0,
      pct,
      q,
      invalid,
      valid: !invalid && cost > 0,
    };
  }, [currency, fx, buy, costHasCredit, method, percent, extra, qty, roundUp, saleMode]);

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
    setSaleMode("con_igv");
  };

  const copy = async () => {
    const isCon = saleMode === "con_igv";
    const label = isCon ? "Precio con IGV (Factura)" : "Precio sin IGV (Normal)";
    const text = `${product ? product + " — " : ""}${label}: ${money(r.activeFinalPrice)}${
      r.q > 1 ? ` | Total (${r.q} unid.): ${money(r.activeTotalPrice)}` : ""
    }`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Columna Izquierda: Datos de la compra */}
      <div className="admin-glass rounded-[var(--radius-lg)] p-6 lg:col-span-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-fg">Datos de la compra</h2>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-fg-muted hover:bg-bg-alt hover:text-fg transition-colors"
          >
            <RotateCcw size={13} /> Limpiar
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="pc-product">
              Producto (Opcional)
            </label>
            <input
              id="pc-product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className={inputClass}
              placeholder="Ej. Mouse Gamer, Teclado mecánico, Laptop..."
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
            <div>
              <label className={labelClass} htmlFor="pc-buy">
                Precio de compra (S/)
              </label>
              <input
                id="pc-buy"
                type="number"
                min={0}
                step={0.01}
                value={buy}
                onChange={(e) => setBuy(e.target.value)}
                className={inputClass}
                placeholder="Ej. 50.00"
              />
            </div>
          )}

          {currency === "USD" && (
            <div>
              <label className={labelClass} htmlFor="pc-buy">
                Precio de compra (US$)
              </label>
              <input
                id="pc-buy"
                type="number"
                min={0}
                step={0.01}
                value={buy}
                onChange={(e) => setBuy(e.target.value)}
                className={inputClass}
                placeholder="Ej. 15.00"
              />
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="pc-credit">
              Costo de adquisición
            </label>
            <select
              id="pc-credit"
              value={costHasCredit ? "credito" : "directo"}
              onChange={(e) => setCostHasCredit(e.target.value === "credito")}
              className={inputClass}
            >
              <option value="directo">Precio de compra directo (Monto pagado)</option>
              <option value="credito">Deducir 18% de IGV a la compra (Crédito fiscal)</option>
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

          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg sm:col-span-2 pt-1">
            <input
              type="checkbox"
              checked={roundUp}
              onChange={(e) => setRoundUp(e.target.checked)}
              className="h-4 w-4 rounded accent-accent"
            />
            Redondear el precio final al sol superior
          </label>
        </div>
      </div>

      {/* Columna Derecha: Resultado Nítido, Limpio y de Alto Contraste */}
      <div className="admin-glass rounded-[var(--radius-lg)] p-6 lg:col-span-2 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
              <Calculator size={18} className="text-accent" /> Resultado de Venta
            </h2>
          </div>

          {r.invalid && <p className="mt-4 text-sm font-semibold text-red-600">{r.invalid}</p>}

          {!r.valid && !r.invalid ? (
            <p className="mt-4 text-sm text-fg-muted">
              Ingresa el precio de compra a la izquierda para ver el resultado de venta.
            </p>
          ) : (
            !r.invalid && (
              <div className="mt-4 space-y-4">
                {/* Selector elegante para alternar entre Con IGV y Sin IGV */}
                <div className="flex rounded-xl border border-border/80 bg-bg-surface p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSaleMode("con_igv")}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                      saleMode === "con_igv"
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                        : "text-fg-muted hover:text-fg"
                    }`}
                  >
                    Con IGV (Factura +18%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleMode("sin_igv")}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                      saleMode === "sin_igv"
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                        : "text-fg-muted hover:text-fg"
                    }`}
                  >
                    Sin IGV (Venta normal)
                  </button>
                </div>

                {/* Tarjeta única principal con contraste impecable y números ultra legibles */}
                <div
                  className={`rounded-2xl p-5 text-center border transition-all shadow-sm ${
                    saleMode === "con_igv"
                      ? "border-blue-500/30 bg-blue-500/10"
                      : "border-emerald-500/30 bg-emerald-500/10"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className={`text-xs font-extrabold uppercase tracking-wider ${
                        saleMode === "con_igv"
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {saleMode === "con_igv"
                        ? "PRECIO FINAL CON FACTURA (CON IGV)"
                        : "PRECIO FINAL SIN FACTURA (SIN IGV)"}
                    </span>
                  </div>

                  {/* Número del precio con máximo contraste: color oscuro profundo en tema claro */}
                  <p className="mt-2 font-display text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                    {money(r.activeFinalPrice)}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-fg-muted">
                    {saleMode === "con_igv"
                      ? "Incluye 18% de IGV para emisión de factura"
                      : "Precio neto para venta directa o boleta"}
                  </p>

                  {r.q > 1 && (
                    <div className="mt-3 inline-block rounded-lg bg-bg-surface/80 px-3 py-1 border border-border/60">
                      <p className="text-xs font-bold text-fg">
                        Total por {r.q} unidades: {money(r.activeTotalPrice)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Desglose claro y transparente */}
                <div className="rounded-2xl border border-border/60 bg-bg-surface/90 px-4 py-2 shadow-sm">
                  <Row k="Costo de compra" v={money(r.cost)} />
                  <Row k="Utilidad estimada" v={money(r.profit)} strong accent="green" />
                  <Row k="Precio sin IGV (Base)" v={money(r.priceSinIgv)} />
                  <Row k="IGV 18% (Venta)" v={money(r.igvAmount)} />
                  <Row k="Precio con IGV (Factura)" v={money(r.priceConIgv)} strong accent="blue" />
                  {r.q > 1 && (
                    <Row k={`Utilidad total (${r.q} unid.)`} v={money(r.totalProfit)} strong accent="green" />
                  )}
                  <Row k="Margen real sobre venta" v={`${r.realMargin.toFixed(2)}%`} />
                  <Row k="Recargo real sobre costo" v={`${r.realMarkup.toFixed(2)}%`} />
                </div>
              </div>
            )
          )}
        </div>

        {/* Botón único de copiado */}
        {r.valid && !r.invalid && (
          <div className="mt-6">
            <button
              type="button"
              onClick={copy}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-md transition-all active:scale-[0.98] ${
                saleMode === "con_igv"
                  ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/30"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
              }`}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied
                ? "¡Precio copiado al portapapeles!"
                : `Copiar precio: ${money(r.activeFinalPrice)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
