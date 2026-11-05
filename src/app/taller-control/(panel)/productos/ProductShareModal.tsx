"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Phone,
  Sparkles,
  ShoppingBag,
  Images,
  Download,
  Info,
  Layers,
  ArrowRight,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { CategoryIcon } from "@/components/tienda/categoryIcons";
import type { AdminProduct } from "./actions";

interface ProductShareModalProps {
  product: AdminProduct | null;
  onClose: () => void;
}

type TemplateType = "comercial" | "vecino" | "rapido";

function formatPeruPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return `51${digits}`;
  if (digits.length === 11 && digits.startsWith("51")) return digits;
  return digits;
}

export function ProductShareModal({ product, onClose }: ProductShareModalProps) {
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);
  const [targetPhone, setTargetPhone] = useState("");
  const [template, setTemplate] = useState<TemplateType>("comercial");
  const [copiedField, setCopiedField] = useState<"message" | "link" | "photo" | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Reset state when product changes
  useEffect(() => {
    setSelectedImgIdx(0);
    setCopiedField(null);
  }, [product?.id]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Extraer todas las fotos disponibles (portada + fotos adicionales de images)
  const allImages = useMemo(() => {
    if (!product) return [];
    const list: string[] = [];
    if (product.image) list.push(product.image);

    if (product.images) {
      try {
        const parsed = JSON.parse(product.images);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === "string" && item && !list.includes(item)) {
              list.push(item);
            }
          }
        }
      } catch {
        if (typeof product.images === "string" && product.images.startsWith("/") && !list.includes(product.images)) {
          list.push(product.images);
        }
      }
    }
    return list;
  }, [product]);

  if (!product) return null;

  const currentPhoto = allImages[selectedImgIdx] || product.image || null;

  // Enlace directo al catálogo público
  const storeUrl = origin
    ? `${origin}/tienda?q=${encodeURIComponent(product.name)}&p=${product.itemNumber}`
    : `https://www.infosistel.com.pe/tienda?q=${encodeURIComponent(product.name)}&p=${product.itemNumber}`;

  const currentPrice = product.onSale && product.salePrice ? product.salePrice : product.price;

  // Generación de mensajes según plantilla
  const generatedMessage = useMemo(() => {
    const priceText = product.onSale && product.salePrice
      ? `S/. ${product.salePrice.toFixed(2)} (Antes S/. ${product.price.toFixed(2)} - ¡OFERTA!)`
      : `S/. ${product.price.toFixed(2)}`;

    const stockText = product.stock > 0
      ? `✅ ${product.stock} unid. disponibles en tienda`
      : `⚠️ Temporalmente agotado (consulta próxima llegada)`;

    if (template === "vecino") {
      return (
`¡Hola vecino/amigo! 👋 Te paso la información que me consultaste:

📦 *${product.name.trim()}*
💰 *Precio especial:* S/. ${currentPrice.toFixed(2)}${product.onSale ? " (¡Está en oferta!)" : ""}
📊 *Disponibilidad:* ${product.stock > 0 ? "Tenemos stock listo para entrega inmediata" : "Consúltame llegada"}

📍 Puedes pasar a recogerlo por el local o si gustas te lo aparto. ¡Avisame con confianza! 🤝
📲 *Infosistel* · WhatsApp: 964 648 202
🌐 Ver producto: ${storeUrl}`
      );
    }

    if (template === "rapido") {
      return (
`📦 *${product.name.trim()}*
🏷️ Categoría: ${product.category}
💰 *Precio:* ${priceText}
📊 *Stock:* ${product.stock > 0 ? `${product.stock} u.` : "Agotado"}
🌐 *Ver en catálogo:* ${storeUrl}
📲 Pedidos WhatsApp: +51 964 648 202`
      );
    }

    // Default: Ficha comercial completa
    const desc = product.description?.trim();
    const descSnippet = desc ? `\n📝 *Detalles:* ${desc.slice(0, 180)}${desc.length > 180 ? "..." : ""}` : "";
    const barcodeSnippet = product.barcode ? `\n🔖 *Código:* \`${product.barcode}\`` : "";

    return (
`⚡ *INFOSISTEL - TECNOLOGÍA & SERVICIOS*
━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *${product.name.trim()}*
🏷️ *Categoría:* ${product.category}${barcodeSnippet}
💰 *Precio:* ${priceText}
📊 *Disponibilidad:* ${stockText}${descSnippet}
━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 *Ubicación:* Local comercial Infosistel - Huancayo
🌐 *Ver ficha y comprar:* ${storeUrl}
📲 *Pedidos y consultas directas:* +51 964 648 202`
    );
  }, [product, template, storeUrl, currentPrice]);

  // Manejo de copiado al portapapeles
  const handleCopy = async (text: string, field: "message" | "link" | "photo") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2500);
    } catch {
      // Fallback manual si el navegador bloquea
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  // Abrir WhatsApp genérico (elegir chat en WhatsApp)
  const handleOpenGeneralWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(generatedMessage)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  // Abrir WhatsApp con número específico
  const handleSendToSpecificPhone = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = formatPeruPhone(targetPhone);
    if (!cleanPhone) {
      handleOpenGeneralWhatsApp();
      return;
    }
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(generatedMessage)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  // Compartir nativo en móviles si está disponible
  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: generatedMessage,
          url: storeUrl,
        });
      } catch {
        // Usuario canceló el share
      }
    }
  };

  const hasNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-bg-surface shadow-2xl"
      >
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b border-border/60 bg-bg-surface/90 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <WhatsAppIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-black text-fg">
                  Compartir Producto
                </h2>
                <span className="rounded-md bg-fg/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-fg-muted">
                  #{product.itemNumber}
                </span>
              </div>
              <p className="text-xs text-fg-muted">
                Envía por WhatsApp, copia la ficha o comparte fotos con clientes y vecinos.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-bg-alt hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Bloque Superior: Galería de Fotos + Resumen del Producto */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-start">
            {/* Visor de Galería (sm: 5 columnas) */}
            <div className="sm:col-span-5 flex flex-col gap-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border/70 bg-bg-alt shadow-inner">
                {currentPhoto ? (
                  <Image
                    src={currentPhoto}
                    alt={product.name}
                    fill
                    sizes="(min-width: 640px) 300px, 100vw"
                    className="object-contain p-2"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-fg-muted/40">
                    <CategoryIcon category={product.category} size={48} strokeWidth={1.5} />
                    <span className="mt-2 text-xs font-semibold">Sin imagen</span>
                  </div>
                )}

                {/* Badge de Stock flotante */}
                <div className="absolute left-2.5 top-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm ${
                      product.stock === 0
                        ? "bg-red-600"
                        : product.stock <= 3
                        ? "bg-amber-500"
                        : "bg-emerald-600"
                    }`}
                  >
                    {product.stock === 0 ? "Agotado" : `${product.stock} en stock`}
                  </span>
                </div>

                {/* Indicador de fotos */}
                {allImages.length > 1 && (
                  <div className="absolute right-2.5 top-2.5 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                    {selectedImgIdx + 1} / {allImages.length}
                  </div>
                )}
              </div>

              {/* Tiras de Miniaturas (si hay más de 1 foto) */}
              {allImages.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {allImages.map((img, idx) => (
                    <button
                      key={img + idx}
                      type="button"
                      onClick={() => setSelectedImgIdx(idx)}
                      className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                        selectedImgIdx === idx
                          ? "border-emerald-500 shadow-sm scale-105"
                          : "border-border/60 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <Image src={img} alt={`Foto ${idx + 1}`} fill sizes="48px" className="object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Acciones de la foto seleccionada */}
              {currentPhoto && (
                <div className="flex items-center justify-between gap-1.5 pt-1 text-[11px] text-fg-muted">
                  <a
                    href={currentPhoto}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-fg-muted hover:text-fg transition-colors"
                  >
                    <ExternalLink size={12} /> Ver tamaño real
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(currentPhoto.startsWith("http") ? currentPhoto : `${origin}${currentPhoto}`, "photo")}
                    className="inline-flex items-center gap-1 font-semibold text-fg-muted hover:text-emerald-600 transition-colors"
                  >
                    {copiedField === "photo" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copiedField === "photo" ? "Link copiado" : "Copiar link de foto"}
                  </button>
                </div>
              )}
            </div>

            {/* Ficha Rápida del Producto (sm: 7 columnas) */}
            <div className="sm:col-span-7 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
                  <CategoryIcon category={product.category} size={14} />
                  <span>{product.category}</span>
                </div>
                <h3 className="mt-1 font-display text-lg font-black text-fg leading-snug">
                  {product.name}
                </h3>

                {product.description && (
                  <p className="mt-1.5 text-xs text-fg-muted line-clamp-3 leading-relaxed">
                    {product.description}
                  </p>
                )}

                {/* Precios */}
                <div className="mt-3 flex items-baseline gap-2.5">
                  <span className="font-display text-2xl font-black text-fg">
                    S/. {currentPrice.toFixed(2)}
                  </span>
                  {product.onSale && product.salePrice && (
                    <span className="text-xs font-bold text-fg-muted line-through">
                      S/. {product.price.toFixed(2)}
                    </span>
                  )}
                  {product.onSale && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-600">
                      <Sparkles size={11} /> ¡OFERTA!
                    </span>
                  )}
                </div>
              </div>

              {/* Botón Principal Gigante: Compartir en WhatsApp */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOpenGeneralWhatsApp}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/25 transition-all hover:brightness-105 active:scale-[0.98]"
                >
                  <WhatsAppIcon size={20} />
                  <span>Compartir en WhatsApp (Elegir chat)</span>
                </button>
              </div>

              {/* Input rápido para enviar a un número específico (vecino o cliente directo) */}
              <form onSubmit={handleSendToSpecificPhone} className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-fg-muted flex items-center gap-1">
                  <Phone size={12} /> O envía directo al WhatsApp de un cliente / vecino:
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-fg-muted">
                      +51
                    </span>
                    <input
                      type="tel"
                      value={targetPhone}
                      onChange={(e) => setTargetPhone(e.target.value)}
                      placeholder="964 648 202"
                      className="admin-field w-full rounded-xl py-2 pl-11 pr-3 text-sm font-mono text-fg placeholder:text-fg-muted/60"
                    />
                  </div>
                  <button
                    type="submit"
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition-all hover:bg-emerald-700 active:scale-95"
                  >
                    <span>Enviar</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Selector de Plantilla de Mensaje */}
          <div className="border-t border-border/60 pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-fg-muted flex items-center gap-1.5">
                <Layers size={13} /> Formato del mensaje:
              </span>

              <div className="inline-flex rounded-xl border border-border/80 bg-bg-alt p-1">
                <button
                  type="button"
                  onClick={() => setTemplate("comercial")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    template === "comercial"
                      ? "bg-bg-surface text-fg shadow-sm"
                      : "text-fg-muted hover:text-fg"
                  }`}
                >
                  💼 Ficha Comercial
                </button>
                <button
                  type="button"
                  onClick={() => setTemplate("vecino")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    template === "vecino"
                      ? "bg-bg-surface text-fg shadow-sm"
                      : "text-fg-muted hover:text-fg"
                  }`}
                >
                  🤝 Vecino / Amigable
                </button>
                <button
                  type="button"
                  onClick={() => setTemplate("rapido")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    template === "rapido"
                      ? "bg-bg-surface text-fg shadow-sm"
                      : "text-fg-muted hover:text-fg"
                  }`}
                >
                  ⚡ Corto y Directo
                </button>
              </div>
            </div>

            {/* Vista previa tipo Burbuja de WhatsApp */}
            <div className="mt-3 relative rounded-2xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 text-xs text-fg leading-relaxed">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <span className="flex items-center gap-1">
                  <WhatsAppIcon size={12} /> Vista previa del texto
                </span>
                <span>Listo para WhatsApp</span>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs text-fg select-all">
                {generatedMessage}
              </pre>

              {/* Botones de acción debajo de la vista previa */}
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-500/20">
                <button
                  type="button"
                  onClick={() => handleCopy(generatedMessage, "message")}
                  className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-bg-surface px-3 py-1.5 text-xs font-bold text-fg shadow-sm transition-all hover:bg-bg-alt active:scale-95"
                >
                  {copiedField === "message" ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span className="text-emerald-600">¡Texto Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copiar mensaje</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(storeUrl, "link")}
                  className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-bg-surface px-3 py-1.5 text-xs font-bold text-fg shadow-sm transition-all hover:bg-bg-alt active:scale-95"
                >
                  {copiedField === "link" ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span className="text-emerald-600">¡Enlace Copiado!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={14} />
                      <span>Copiar link de tienda</span>
                    </>
                  )}
                </button>

                {hasNativeShare && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-bg-surface px-3 py-1.5 text-xs font-bold text-fg shadow-sm transition-all hover:bg-bg-alt active:scale-95"
                  >
                    <Share2 size={14} />
                    <span>Compartir con aplicaciones</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer del Modal */}
        <div className="flex items-center justify-between border-t border-border/60 bg-bg-alt/50 px-4 py-3 sm:px-6">
          <span className="text-[11px] text-fg-muted flex items-center gap-1">
            <Info size={12} /> Compatible con WhatsApp Web y aplicación móvil.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/80 bg-bg-surface px-4 py-1.5 text-xs font-bold text-fg transition-colors hover:bg-bg-alt"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
