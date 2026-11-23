"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  EyeOff,
  ImageIcon,
  Loader2,
  Merge,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { DuplicateGroup } from "@/lib/duplicateAudit";
import { ConfirmDialog } from "../../ConfirmDialog";
import { askAiAboutGroup, mergeProducts, type AiGroupVerdict } from "./actions";

const DISMISSED_KEY = "infosistel:duplicados-descartados";

const previewUrl = (url: string) =>
  url.startsWith("/") ? url : `/api/image-proxy?url=${encodeURIComponent(url)}`;

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(set: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {}
}

export function DuplicatesReview({ groups, totalProducts }: { groups: DuplicateGroup[]; totalProducts: number }) {
  const [tab, setTab] = useState<"seguro" | "revisar">("seguro");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    // localStorage only exists in the browser
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed());
  }, []);

  const visible = useMemo(
    () => groups.filter((g) => g.level === tab && (showDismissed ? dismissed.has(g.key) : !dismissed.has(g.key))),
    [groups, tab, dismissed, showDismissed]
  );
  const counts = useMemo(
    () => ({
      seguro: groups.filter((g) => g.level === "seguro" && !dismissed.has(g.key)).length,
      revisar: groups.filter((g) => g.level === "revisar" && !dismissed.has(g.key)).length,
      descartados: groups.filter((g) => dismissed.has(g.key)).length,
    }),
    [groups, dismissed]
  );
  const extraUnits = useMemo(
    () =>
      groups
        .filter((g) => g.level === "seguro" && !dismissed.has(g.key))
        .reduce((acc, g) => acc + g.products.length - 1, 0),
    [groups, dismissed]
  );

  function toggleDismiss(key: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      writeDismissed(next);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/taller-control/productos"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-fg-muted hover:text-accent"
          >
            <ArrowLeft size={14} /> Volver a Productos
          </Link>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            Productos repetidos
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Revisé los {totalProducts} productos de la tienda. Las variantes reales (64GB vs 128GB, negro vs blanco,
            5V vs 12V, marcas distintas o códigos de barras distintos) nunca se marcan como repetidas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Repetidos seguros</p>
          <p className="mt-1 font-display text-2xl font-black text-fg">{counts.seguro}</p>
          <p className="text-[11px] text-fg-muted">{extraUnits} registro(s) sobrante(s) para unir</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Para revisar</p>
          <p className="mt-1 font-display text-2xl font-black text-fg">{counts.revisar}</p>
          <p className="text-[11px] text-fg-muted">Muy parecidos — confirma tú o pregunta a la IA</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-bg-surface/80 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-fg-muted">Marcados como “no son repetidos”</p>
          <p className="mt-1 font-display text-2xl font-black text-fg">{counts.descartados}</p>
          <button
            type="button"
            onClick={() => setShowDismissed((v) => !v)}
            className="text-[11px] font-bold text-accent hover:underline"
          >
            {showDismissed ? "Ocultar descartados" : "Ver descartados"}
          </button>
        </div>
      </div>

      {flash && (
        <p
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${
            flash.kind === "ok"
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-800"
              : "border-red-500/40 bg-red-50 text-red-800"
          }`}
        >
          {flash.kind === "ok" && <CheckCircle2 size={16} />}
          {flash.text}
        </p>
      )}

      <div className="flex gap-2">
        {(["seguro", "revisar"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              tab === t ? "bg-accent text-accent-fg" : "border border-border text-fg-muted hover:text-fg"
            }`}
          >
            {t === "seguro" ? `Repetidos seguros (${counts.seguro})` : `Para revisar (${counts.revisar})`}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-10 text-center">
          <ShieldCheck size={32} className="text-emerald-600" />
          <p className="font-bold text-fg">
            {showDismissed ? "No hay grupos descartados aquí." : "¡Sin repetidos en esta sección!"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((g) => (
            <GroupCard
              key={g.key}
              group={g}
              dismissed={dismissed.has(g.key)}
              onToggleDismiss={() => toggleDismiss(g.key)}
              onResult={setFlash}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  dismissed,
  onToggleDismiss,
  onResult,
}: {
  group: DuplicateGroup;
  dismissed: boolean;
  onToggleDismiss: () => void;
  onResult: (r: { kind: "ok" | "error"; text: string }) => void;
}) {
  const router = useRouter();
  const [keepId, setKeepId] = useState(group.products[0].id);
  const [selected, setSelected] = useState<Set<string>>(new Set(group.products.map((p) => p.id)));
  const [confirming, setConfirming] = useState(false);
  const [merging, startMerge] = useTransition();
  const [ai, setAi] = useState<AiGroupVerdict | null>(null);
  const [asking, setAsking] = useState(false);

  const keep = group.products.find((p) => p.id === keepId)!;
  const toRemove = group.products.filter((p) => p.id !== keepId && selected.has(p.id));
  const totalStock = (keep.stock ?? 0) + toRemove.reduce((acc, p) => acc + Math.max(0, p.stock ?? 0), 0);

  async function handleAsk() {
    setAsking(true);
    setAi(null);
    const res = await askAiAboutGroup(group.products.map((p) => p.id));
    setAi(res);
    setAsking(false);
  }

  function doMerge() {
    startMerge(async () => {
      const res = await mergeProducts(
        keepId,
        toRemove.map((p) => p.id)
      );
      setConfirming(false);
      onResult(res.ok ? { kind: "ok", text: res.message ?? "Unidos." } : { kind: "error", text: res.error ?? "Error." });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div
      className={`rounded-2xl border-2 bg-bg-surface/90 p-4 shadow-sm ${
        group.level === "seguro" ? "border-red-500/30" : "border-amber-500/40"
      } ${dismissed ? "opacity-60" : ""}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-muted">
          <Copy size={13} />
          {group.products.length} productos {group.level === "seguro" ? "repetidos" : "muy parecidos"}
        </p>
        <p className="text-[11px] text-fg-muted">Marca con ★ el que quieres conservar</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.products.map((p) => {
          const isKeep = p.id === keepId;
          const isSelected = selected.has(p.id);
          return (
            <div
              key={p.id}
              className={`relative flex gap-3 rounded-xl border p-3 transition-colors ${
                isKeep ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20" : "border-border bg-bg"
              } ${!isKeep && !isSelected ? "opacity-50" : ""}`}
            >
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl(p.image)} alt="" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon size={20} className="text-fg-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-fg-muted">#{p.itemNumber}</p>
                <Link
                  href={`/taller-control/productos/${p.id}`}
                  className="line-clamp-2 text-xs font-bold text-fg hover:text-accent"
                  title={p.name}
                >
                  {p.name}
                </Link>
                <p className="mt-1 text-[11px] text-fg-muted">
                  Stock: <strong className="text-fg">{p.stock ?? 0}</strong> · S/. {p.price ?? "-"}
                  {p.costPrice ? ` · Costo S/. ${p.costPrice}` : ""}
                </p>
                {p.barcode && <p className="text-[11px] text-fg-muted">Cód: {p.barcode}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setKeepId(p.id)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                      isKeep ? "bg-emerald-600 text-white" : "border border-border text-fg-muted hover:text-fg"
                    }`}
                  >
                    {isKeep ? "★ Se conserva" : "Conservar este"}
                  </button>
                  {!isKeep && (
                    <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-fg-muted">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          })
                        }
                      />
                      unir
                    </label>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <details className="mt-3 text-[11px] text-fg-muted">
        <summary className="cursor-pointer font-bold">¿Por qué se detectó?</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {group.reasons.slice(0, 8).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </details>

      {ai && (
        <p
          className={`mt-3 rounded-xl border px-3 py-2 text-xs font-bold ${
            ai.error
              ? "border-red-500/40 bg-red-50 text-red-800"
              : ai.verdict === "mismo"
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-800"
              : ai.verdict === "distintos"
              ? "border-slate-400/40 bg-slate-50 text-slate-800"
              : "border-amber-500/40 bg-amber-50 text-amber-900"
          }`}
        >
          {ai.error
            ? ai.error
            : `IA: ${ai.verdict === "mismo" ? "Es el MISMO producto" : ai.verdict === "distintos" ? "Son productos DISTINTOS" : "No está segura"} — ${ai.reason}`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-3">
        <button
          type="button"
          disabled={toRemove.length === 0 || merging}
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Merge size={14} />
          Unir {toRemove.length > 0 ? `${toRemove.length + 1} en 1` : ""} (stock total {totalStock})
        </button>
        <button
          type="button"
          onClick={handleAsk}
          disabled={asking}
          className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-bold text-accent hover:bg-accent/20 disabled:opacity-50"
        >
          {asking ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {asking ? "Comparando fotos…" : "Preguntar a la IA"}
        </button>
        <button
          type="button"
          onClick={onToggleDismiss}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-bold text-fg-muted hover:text-fg"
        >
          {dismissed ? <RotateCcw size={14} /> : <EyeOff size={14} />}
          {dismissed ? "Volver a mostrar" : "No son repetidos"}
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Unir productos repetidos"
          message={`Se conservará "${keep.name}" (#${keep.itemNumber}). Los otros ${toRemove.length} se eliminarán y sus ventas, pedidos, cotizaciones e historial de stock pasarán al producto conservado.`}
          fields={[
            { label: "Se conserva", value: `#${keep.itemNumber} ${keep.name}` },
            { label: "Se unen", value: toRemove.map((p) => `#${p.itemNumber}`).join(", ") },
            { label: "Stock total", value: `${totalStock} u.` },
          ]}
          confirmLabel="Sí, unir"
          pendingLabel="Uniendo..."
          pending={merging}
          onConfirm={doMerge}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
