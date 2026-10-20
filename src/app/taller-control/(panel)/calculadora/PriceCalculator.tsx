"use client";

import { useMemo, useState } from "react";
import { Calculator, Copy, Check, RotateCcw } from "lucide-react";

const IGV = 0.18;
const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";
const inputClass = "admin-field mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm text-fg";

type Method = "margen" | "recargo";

const money = (n: number, symbol = "S/") => `${symbol} ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function PriceCalculator() {
  const [product, setProduct] = useState("");
  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN");
  const [fx, setFx] = useState("3.75");
  const [buy, setBuy] = useState("");
  const [includesIgv, setIncludesIgv] = useState(true);
  const [method, setMethod] = useState<Method>("margen");
  const [percent, setPercent] = useState("15");
  const [extra, setExtra] = useState("0");
  const [qty, setQty] = useState("1");
  const [roundUp, setRoundUp] = useState(false);
  const [copied, setCopied] = useState(false);

  const r = useMemo(() => {
    const rate = currency === "USD" ? num(fx) : 1;
    const buyPen = num(buy) * rate;
    const netBuy = includesIgv ? buyPen / (1 + IGV) : buyPen;
    const cost = netBuy + num(extra); // costo neto unitario
    const pct = num(percent);
    const q = Math.max(1, Math.floor(num(qty)) || 1);

    let sale = 0;
    let invalid = "";
    if (method === "margen") {
      if (pct >= 100) invalid = "El margen sobre venta debe ser menor a 100%.";
      else sale = cost / (1 - pct / 100);
    } else {
      sale = cost * (1 + pct / 100);
    }

    let final = sale * (1 + IGV);
    if (roundUp) final = Math.ceil(final);
    // Con redondeo, se recalcula hacia atrás para que utilidad e IGV cuadren con el precio final.
    const saleNet = final / (1 + IGV);
    const igvAmount = final - saleNet;
    const profit = saleNet - cost;

    return {
      cost,
      saleNet,
      igvAmount,
      profit,
      final,
      total: final * q,
      totalProfit: profit * q,
      realMargin: saleNet > 0 ? (profit / saleNet) * 100 : 0,
      realMarkup: cost > 0 ? (profit / cost) * 100 : 0,
      pct,
      q,
      invalid,
      valid: !invalid && cost > 0,
    };
  }, [currency, fx, buy, includesIgv, method, percent, extra, qty, roundUp]);

  const reset = () => {
    setProduct(""); setCurrency("PEN"); setFx("3.75"); setBuy(""); setIncludesIgv(true);
    setMethod("margen"); setPercent("15"); setExtra("0"); setQty("1"); setRoundUp(false);
  };

  const copy = async () => {
    const text = `${product ? product + " — " : ""}Precio final: ${money(r.final)}${r.q > 1 ? ` | Total (${r.q} unid.): ${money(r.total)}` : ""}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const Row = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-fg-muted">{k}</span>
      <span className={strong ? "font-bold text-fg" : "font-semibold text-fg"}>{v}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="admin-glass rounded-[var(--radius-lg)] p-6 lg:col-span-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-fg">Datos de la compra</h2>
          <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-fg-muted hover:bg-bg-alt hover:text-fg">
            <RotateCcw size={13} /> Limpiar
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="pc-product">Producto</label>
            <input id="pc-product" value={product} onChange={(e) => setProduct(e.target.value)} className={inputClass} placeholder="Ej. Laptop Lenovo IdeaPad" />
          </div>
          <div>
            <label className={labelClass} htmlFor="pc-currency">Moneda de compra</label>
            <select id="pc-currency" value={currency} onChange={(e) => setCurrency(e.target.value as "PEN" | "USD")} className={inputClass}>
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
          {currency === "USD" ? (
            <div>
              <label className={labelClass} htmlFor="pc-fx">Tipo de cambio (S/ por US$)</label>
              <input id="pc-fx" type="number" min={0} step={0.01} value={fx} onChange={(e) => setFx(e.target.value)} className={inputClass} />
            </div>
          ) : (
            <div className="hidden sm:block" />
          )}
          <div>
            <label className={labelClass} htmlFor="pc-buy">Precio de compra ({currency === "USD" ? "US$" : "S/"})</label>
            <input id="pc-buy" type="number" min={0} step={0.01} value={buy} onChange={(e) => setBuy(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="pc-igv">¿La compra incluye IGV?</label>
            <select id="pc-igv" value={includesIgv ? "si" : "no"} onChange={(e) => setIncludesIgv(e.target.value === "si")} className={inputClass}>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="pc-method">Método de cálculo</label>
            <select id="pc-method" value={method} onChange={(e) => setMethod(e.target.value as Method)} className={inputClass}>
              <option value="margen">Margen sobre venta</option>
              <option value="recargo">Recargo sobre costo</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="pc-percent">{method === "margen" ? "Margen sobre venta (%)" : "Recargo sobre costo (%)"}</label>
            <input id="pc-percent" type="number" min={0} step={0.1} value={percent} onChange={(e) => setPercent(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="pc-extra">Otros costos sin IGV (S/)</label>
            <input id="pc-extra" type="number" min={0} step={0.01} value={extra} onChange={(e) => setExtra(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="pc-qty">Cantidad</label>
            <input id="pc-qty" type="number" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} className={inputClass} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg sm:col-span-2">
            <input type="checkbox" checked={roundUp} onChange={(e) => setRoundUp(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent,#2563eb)]" />
            Redondear el precio final al sol superior
          </label>
        </div>
      </div>

      <div className="admin-glass rounded-[var(--radius-lg)] p-6 lg:col-span-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
          <Calculator size={18} className="text-accent" /> Resultado
        </h2>

        {r.invalid && <p className="mt-4 text-sm font-medium text-red-600">{r.invalid}</p>}

        {!r.valid && !r.invalid ? (
          <p className="mt-4 text-sm text-fg-muted">Ingresa el precio de compra para ver el cálculo.</p>
        ) : (
          !r.invalid && (
            <>
              <div className="mt-4 rounded-2xl bg-accent/10 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-fg-muted">Precio final (con IGV)</p>
                <p className="mt-1 font-display text-3xl font-bold text-fg">{money(r.final)}</p>
                {r.q > 1 && <p className="mt-1 text-sm font-semibold text-fg-muted">Total ({r.q} unid.): {money(r.total)}</p>}
              </div>

              <div className="mt-4">
                <Row k="Método" v={method === "margen" ? "Margen sobre venta" : "Recargo sobre costo"} />
                <Row k="Porcentaje aplicado" v={`${r.pct.toFixed(2)}%`} />
                <Row k="Costo neto unitario" v={money(r.cost)} />
                <Row k="Venta sin IGV" v={money(r.saleNet)} />
                <Row k="IGV de venta (18%)" v={money(r.igvAmount)} />
                <Row k="Utilidad unitaria" v={money(r.profit)} strong />
                {r.q > 1 && <Row k={`Utilidad total (${r.q} unid.)`} v={money(r.totalProfit)} strong />}
                <Row k="Margen real sobre venta" v={`${r.realMargin.toFixed(2)}%`} />
                <Row k="Recargo real sobre costo" v={`${r.realMarkup.toFixed(2)}%`} />
              </div>

              <button type="button" onClick={copy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-bold text-accent-fg hover:opacity-90">
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "¡Copiado!" : "Copiar precio"}
              </button>
            </>
          )
        )}
      </div>
    </div>
  );
}
