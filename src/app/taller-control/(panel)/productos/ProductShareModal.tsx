"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Phone,
  Sparkles,
  Download,
  Info,
  Layers,
  ArrowRight,
  Palette,
  Camera,
  FileImage,
  MessageCircle,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { CategoryIcon } from "@/components/tienda/categoryIcons";
import type { AdminProduct } from "./actions";

interface ProductShareModalProps {
  product: AdminProduct | null;
  onClose: () => void;
}

type FlyerTheme = "dark" | "light";
type ShareMode = "flyer" | "photo" | "text";

function formatPeruPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return `51${digits}`;
  if (digits.length === 11 && digits.startsWith("51")) return digits;
  return digits;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export function ProductShareModal({ product, onClose }: ProductShareModalProps) {
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);
  const [flyerTheme, setFlyerTheme] = useState<FlyerTheme>("dark");
  const [shareMode, setShareMode] = useState<ShareMode>("flyer");
  const [targetPhone, setTargetPhone] = useState("");
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(null);
  const [isGeneratingFlyer, setIsGeneratingFlyer] = useState(false);
  const [origin, setOrigin] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Lista de todas las fotos
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

  const currentPhoto = allImages[selectedImgIdx] || product?.image || null;

  // Enlace directo al producto
  const directProductUrl = origin && product
    ? `${origin}/p/${product.itemNumber}`
    : `https://infosistel.com.pe/p/${product?.itemNumber ?? 1}`;

  const currentPrice = product
    ? product.onSale && product.salePrice
      ? product.salePrice
      : product.price
    : 0;

  // Generador Canvas del Flyer HD (1080x1080)
  const generateFlyer = useCallback(async () => {
    if (!product) return;
    setIsGeneratingFlyer(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const isDark = flyerTheme === "dark";

      // 1. FONDO
      if (isDark) {
        // Fondo Oscuro Tech
        const bgGrad = ctx.createRadialGradient(540, 500, 100, 540, 540, 750);
        bgGrad.addColorStop(0, "#162036");
        bgGrad.addColorStop(0.6, "#0D1424");
        bgGrad.addColorStop(1, "#070B14");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1080, 1080);

        // Acentos de luz sutil en las esquinas
        ctx.fillStyle = "rgba(14, 165, 233, 0.08)";
        ctx.beginPath();
        ctx.arc(100, 100, 280, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(99, 102, 241, 0.08)";
        ctx.beginPath();
        ctx.arc(980, 980, 320, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Fondo Claro Tienda
        const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
        bgGrad.addColorStop(0, "#F8FAFC");
        bgGrad.addColorStop(0.5, "#F1F5F9");
        bgGrad.addColorStop(1, "#E2E8F0");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1080, 1080);
      }

      // 2. CABECERA CON MARCA
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      // Logo INFOSISTEL
      ctx.font = "900 44px 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
      ctx.fillStyle = isDark ? "#38BDF8" : "#0284C7";
      ctx.fillText("INFOSISTEL", 60, 70);

      // Subtítulo
      ctx.font = "700 16px system-ui, sans-serif";
      ctx.fillStyle = isDark ? "#94A3B8" : "#64748B";
      ctx.fillText("TECNOLOGÍA · CÓMPUTO · SERVICIO TÉCNICO", 60, 105);

      // Badge superior derecho (#Número de Ítem)
      ctx.textAlign = "right";
      const itemBadgeText = `#${product.itemNumber} · GARANTÍA OFICIAL`;
      ctx.font = "800 18px monospace";
      const badgeW = ctx.measureText(itemBadgeText).width + 36;
      roundRect(ctx, 1080 - 60 - badgeW, 60, badgeW, 40, 20);
      ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = isDark ? "#E2E8F0" : "#334155";
      ctx.fillText(itemBadgeText, 1080 - 78, 80);

      // 3. TARJETA CENTRAL DEL PRODUCTO (MARCO DE FOTO)
      const cardX = 60;
      const cardY = 135;
      const cardW = 960;
      const cardH = 540;

      roundRect(ctx, cardX, cardY, cardW, cardH, 32);
      ctx.fillStyle = isDark ? "#0F172A" : "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cargar y dibujar foto del producto
      if (currentPhoto) {
        try {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.src = currentPhoto;

          await new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
            } else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }
          });

          if (img.width > 0 && img.height > 0) {
            const pad = 36;
            const maxW = cardW - pad * 2;
            const maxH = cardH - pad * 2;
            const scale = Math.min(maxW / img.width, maxH / img.height);
            const drawW = img.width * scale;
            const drawH = img.height * scale;
            const drawX = cardX + (cardW - drawW) / 2;
            const drawY = cardY + (cardH - drawH) / 2;

            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          }
        } catch {
          // Si falla, continúa sin foto
        }
      }

      // Badge flotante de Stock dentro de la foto (esquina superior izquierda)
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const isStockOk = product.stock > 0;
      const stockMsg = isStockOk
        ? `✓ DISPONIBLE (${product.stock} UNID.)`
        : "TEMPORALMENTE AGOTADO";

      ctx.font = "900 17px system-ui, sans-serif";
      const stockBadgeW = ctx.measureText(stockMsg).width + 34;

      roundRect(ctx, cardX + 24, cardY + 24, stockBadgeW, 40, 20);
      ctx.fillStyle = isStockOk ? "#10B981" : "#EF4444";
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(stockMsg, cardX + 41, cardY + 44);

      // 4. INFORMACIÓN DEL PRODUCTO (DEBAJO DE LA FOTO)
      const infoY = 715;

      // Categoría
      ctx.font = "800 20px system-ui, sans-serif";
      ctx.fillStyle = isDark ? "#38BDF8" : "#0284C7";
      ctx.fillText(product.category.toUpperCase(), 60, infoY);

      // Nombre del producto (máximo 2 líneas grandes)
      ctx.font = "900 38px 'Plus Jakarta Sans', system-ui, sans-serif";
      ctx.fillStyle = isDark ? "#FFFFFF" : "#0F172A";

      const titleLines = wrapText(ctx, product.name, 960).slice(0, 2);
      let lineY = infoY + 44;
      for (const line of titleLines) {
        ctx.fillText(line, 60, lineY);
        lineY += 46;
      }

      // 5. CAJA DE PRECIO DESTACADA (GIGANTE)
      const priceBoxY = Math.max(lineY + 12, 855);
      const priceBoxW = 420;
      const priceBoxH = 85;

      roundRect(ctx, 60, priceBoxY, priceBoxW, priceBoxH, 24);
      if (isDark) {
        const pGrad = ctx.createLinearGradient(60, priceBoxY, 60 + priceBoxW, priceBoxY);
        pGrad.addColorStop(0, "#059669");
        pGrad.addColorStop(1, "#10B981");
        ctx.fillStyle = pGrad;
      } else {
        ctx.fillStyle = "#0284C7";
      }
      ctx.fill();

      // Monto en grande
      ctx.font = "900 46px 'Plus Jakarta Sans', system-ui, monospace";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(`S/. ${currentPrice.toFixed(2)}`, 85, priceBoxY + 42);

      // Si está en oferta, mostrar precio tachado o badge de oferta al lado
      if (product.onSale && product.salePrice) {
        ctx.font = "700 24px system-ui, sans-serif";
        ctx.fillStyle = isDark ? "#94A3B8" : "#64748B";
        ctx.fillText(`Antes: S/. ${product.price.toFixed(2)}`, 505, priceBoxY + 30);

        ctx.font = "900 22px system-ui, sans-serif";
        ctx.fillStyle = "#F59E0B";
        ctx.fillText("★ ¡OFERTA ESPECIAL!", 505, priceBoxY + 60);
      } else {
        ctx.font = "700 20px system-ui, sans-serif";
        ctx.fillStyle = isDark ? "#94A3B8" : "#64748B";
        ctx.fillText("PRECIO CONTADO / YAPE / EFECTIVO", 505, priceBoxY + 42);
      }

      // 6. PIE DE PÁGINA COMERCIAL (CONTACTO Y DIRECCIÓN)
      const footY = 975;
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(60, footY);
      ctx.lineTo(1020, footY);
      ctx.stroke();

      // Dirección
      ctx.font = "700 19px system-ui, sans-serif";
      ctx.fillStyle = isDark ? "#E2E8F0" : "#334155";
      ctx.fillText("📍 Huancayo · Tienda Infosistel", 60, footY + 45);

      // WhatsApp
      ctx.textAlign = "right";
      ctx.font = "900 22px system-ui, sans-serif";
      ctx.fillStyle = isDark ? "#4ADE80" : "#16A34A";
      ctx.fillText("📲 WhatsApp: +51 964 648 202", 1020, footY + 45);

      // Convertir a Blob PNG
      canvas.toBlob(
        (blob) => {
          if (blob) {
            setGeneratedBlob(blob);
            if (generatedPreviewUrl) URL.revokeObjectURL(generatedPreviewUrl);
            const url = URL.createObjectURL(blob);
            setGeneratedPreviewUrl(url);
          }
          setIsGeneratingFlyer(false);
        },
        "image/png",
        0.95
      );
    } catch {
      setIsGeneratingFlyer(false);
    }
  }, [product, currentPhoto, flyerTheme, currentPrice]);

  // Regenerar el flyer cuando cambie el producto, foto o tema
  useEffect(() => {
    generateFlyer();
  }, [generateFlyer]);

  if (!product) return null;

  // Texto limpio y profesional para WhatsApp (SIN emojis rotos ni símbolos extraños)
  const cleanWhatsAppText = (
`*INFOSISTEL - TECNOLOGÍA & SERVICIOS*
━━━━━━━━━━━━━━━━━━━━━━
*Producto:* ${product.name.trim()}
*Categoría:* ${product.category}
*Precio:* S/. ${currentPrice.toFixed(2)}${product.onSale ? " (¡En oferta!)" : ""}
*Disponibilidad:* ${product.stock > 0 ? `✓ En stock (${product.stock} u.)` : "Consúltame llegada"}
━━━━━━━━━━━━━━━━━━━━━━
*Ficha y fotos:* ${directProductUrl}
*Atención directa:* +51 964 648 202`
  );

  // Copiar imagen PNG al portapapeles para pegar directo con Ctrl+V en WhatsApp Web
  const handleCopyImageToClipboard = async () => {
    if (!generatedBlob) return;
    try {
      const item = new ClipboardItem({ "image/png": generatedBlob });
      await navigator.clipboard.write([item]);
      setCopiedAction("image");
      setTimeout(() => setCopiedAction(null), 3000);
    } catch {
      // Fallback: descargar si el navegador no permite escribir imágenes al clipboard
      handleDownloadFlyer();
    }
  };

  // Descargar archivo PNG
  const handleDownloadFlyer = () => {
    if (!generatedPreviewUrl) return;
    const a = document.createElement("a");
    a.href = generatedPreviewUrl;
    const safeName = product.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
    a.download = `INFOSISTEL_${product.itemNumber}_${safeName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setCopiedAction("download");
    setTimeout(() => setCopiedAction(null), 3000);
  };

  // Compartir imagen en WhatsApp mediante Web Share API (en celular envía la foto real)
  const handleShareImageMobile = async () => {
    if (!generatedBlob) return;
    const safeName = product.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
    const file = new File([generatedBlob], `INFOSISTEL_${product.itemNumber}_${safeName}.png`, {
      type: "image/png",
    });

    if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: product.name,
          text: `*${product.name}* - S/. ${currentPrice.toFixed(2)}\nInfosistel Huancayo · WhatsApp 964 648 202\n${directProductUrl}`,
        });
      } catch {
        // Cancelado por el usuario
      }
    } else {
      // Fallback si no soporta compartir archivos: abre WhatsApp con el texto y enlace con preview
      handleOpenGeneralWhatsApp();
    }
  };

  // Abrir WhatsApp con el enlace público con OpenGraph preview
  const handleOpenGeneralWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(cleanWhatsAppText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  // Enviar directo al WhatsApp de un celular específico
  const handleSendToPhone = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = formatPeruPhone(targetPhone);
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(cleanWhatsAppText)}`
      : `https://wa.me/?text=${encodeURIComponent(cleanWhatsAppText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  // Copiar texto
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(cleanWhatsAppText);
      setCopiedAction("text");
      setTimeout(() => setCopiedAction(null), 2500);
    } catch {}
  };

  const hasFileShare = typeof navigator !== "undefined" && !!navigator.canShare;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-bg-surface shadow-2xl"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-border/60 bg-bg-surface/95 px-4 py-3 sm:px-6 sm:py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-green-500 text-white shadow-md shadow-emerald-500/20">
              <Camera size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-black text-fg">
                  Tarjeta Visual & Compartir Producto
                </h2>
                <span className="rounded-md bg-fg/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-fg-muted">
                  #{product.itemNumber}
                </span>
              </div>
              <p className="text-xs text-fg-muted">
                Genera la imagen publicitaria en alta definición para WhatsApp, estados y clientes.
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

        {/* Contenido principal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Fila superior: Flyer Visual (Canvas HD) + Panel de Acciones */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            {/* Visualizador de la Tarjeta / Flyer (lg: 7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              {/* Controles del Flyer: Selector de estilo y fotos */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-xl border border-border/70 bg-bg-alt p-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setShareMode("flyer")}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${
                      shareMode === "flyer"
                        ? "bg-bg-surface text-fg shadow-sm"
                        : "text-fg-muted hover:text-fg"
                    }`}
                  >
                    <FileImage size={13} />
                    <span>Flyer HD con Precio</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareMode("photo")}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${
                      shareMode === "photo"
                        ? "bg-bg-surface text-fg shadow-sm"
                        : "text-fg-muted hover:text-fg"
                    }`}
                  >
                    <Camera size={13} />
                    <span>Solo Foto Original</span>
                  </button>
                </div>

                {shareMode === "flyer" && (
                  <div className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-bg-alt p-1 text-xs font-bold">
                    <span className="px-2 text-[10px] text-fg-muted uppercase">Tema:</span>
                    <button
                      type="button"
                      onClick={() => setFlyerTheme("dark")}
                      className={`rounded-lg px-2 py-0.5 transition-all ${
                        flyerTheme === "dark"
                          ? "bg-slate-900 text-cyan-400 shadow-sm"
                          : "text-fg-muted hover:text-fg"
                      }`}
                    >
                      Tech Oscuro
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlyerTheme("light")}
                      className={`rounded-lg px-2 py-0.5 transition-all ${
                        flyerTheme === "light"
                          ? "bg-white text-blue-600 shadow-sm border border-border/40"
                          : "text-fg-muted hover:text-fg"
                      }`}
                    >
                      Tienda Blanco
                    </button>
                  </div>
                )}
              </div>

              {/* Contenedor de la Imagen Renderizada */}
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl border-2 border-border/80 bg-slate-950 shadow-xl">
                {shareMode === "flyer" ? (
                  generatedPreviewUrl ? (
                    <img
                      src={generatedPreviewUrl}
                      alt={`Flyer de ${product.name}`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-white/50 gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                      <span className="text-xs font-semibold">Generando imagen en alta calidad...</span>
                    </div>
                  )
                ) : currentPhoto ? (
                  <div className="relative h-full w-full bg-bg-alt p-4">
                    <Image
                      src={currentPhoto}
                      alt={product.name}
                      fill
                      sizes="(min-width: 1024px) 500px, 100vw"
                      className="object-contain p-4"
                    />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-fg-muted opacity-40">
                    <CategoryIcon category={product.category} size={64} />
                  </div>
                )}

                {/* Badge flotante en la vista previa */}
                <div className="absolute right-3 top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-mono font-bold text-white backdrop-blur-md border border-white/10">
                  {shareMode === "flyer" ? "1080 × 1080 HD" : "Foto Original"}
                </div>
              </div>

              {/* Selector de fotos adicionales si tiene más de una */}
              {allImages.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
                  <span className="text-[11px] font-bold text-fg-muted shrink-0">Fotos ({allImages.length}):</span>
                  {allImages.map((img, idx) => (
                    <button
                      key={img + idx}
                      type="button"
                      onClick={() => setSelectedImgIdx(idx)}
                      className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                        selectedImgIdx === idx
                          ? "border-emerald-500 scale-105 shadow-sm"
                          : "border-border/60 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <Image src={img} alt="" fill sizes="48px" className="object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Panel de Acciones y WhatsApp (lg: 5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-accent">
                  {product.category}
                </span>
                <h3 className="mt-1 font-display text-lg font-black text-fg leading-snug">
                  {product.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-2.5">
                  <span className="font-display text-2xl font-black text-fg">
                    S/. {currentPrice.toFixed(2)}
                  </span>
                  {product.onSale && product.salePrice && (
                    <span className="text-xs font-bold text-fg-muted line-through">
                      S/. {product.price.toFixed(2)}
                    </span>
                  )}
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                    {product.stock > 0 ? `${product.stock} en stock` : "Agotado"}
                  </span>
                </div>
              </div>

              {/* ACCIONES PRINCIPALES DE LA IMAGEN */}
              <div className="space-y-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles size={14} /> Compartir Imagen al instante
                </span>

                {/* 1. Botón Copiar Imagen para pegar con Ctrl+V */}
                <button
                  type="button"
                  onClick={handleCopyImageToClipboard}
                  disabled={!generatedBlob}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/25 transition-all hover:brightness-105 active:scale-98 disabled:opacity-50"
                >
                  {copiedAction === "image" ? (
                    <>
                      <Check size={18} />
                      <span>¡Imagen Copiada! (Pega con Ctrl+V)</span>
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      <span>Copiar Imagen para WhatsApp</span>
                    </>
                  )}
                </button>

                {copiedAction === "image" && (
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 text-center animate-in fade-in">
                    ✓ Abre WhatsApp Web y presiona <strong>Ctrl + V</strong> para enviar la foto.
                  </p>
                )}

                {/* 2. Compartir imagen por menú de celular (si está en Android/iOS) */}
                {hasFileShare && (
                  <button
                    type="button"
                    onClick={handleShareImageMobile}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-2.5 text-xs font-black text-emerald-700 dark:text-emerald-300 transition-all hover:bg-emerald-500 hover:text-white"
                  >
                    <Share2 size={15} />
                    <span>Enviar Foto a WhatsApp (Móvil)</span>
                  </button>
                )}

                {/* 3. Descargar Imagen PNG */}
                <button
                  type="button"
                  onClick={handleDownloadFlyer}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-bg-surface px-4 py-2 text-xs font-bold text-fg transition-colors hover:bg-bg-alt shadow-sm"
                >
                  <Download size={14} />
                  <span>Descargar Tarjeta HD (PNG 1080×1080)</span>
                </button>
              </div>

              {/* ENVÍO DIRECTO A CELULAR */}
              <form onSubmit={handleSendToPhone} className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-fg-muted flex items-center gap-1">
                  <Phone size={12} /> O envía mensaje directo con enlace y vista previa:
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
                      className="admin-field w-full rounded-xl py-2 pl-11 pr-3 text-xs font-mono text-fg placeholder:text-fg-muted/60"
                    />
                  </div>
                  <button
                    type="submit"
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white transition-all hover:bg-emerald-700 active:scale-95"
                  >
                    <WhatsAppIcon size={14} />
                    <span>Enviar</span>
                  </button>
                </div>
              </form>

              {/* Botón Abrir WhatsApp General */}
              <button
                type="button"
                onClick={handleOpenGeneralWhatsApp}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-bg-surface py-2 text-xs font-bold text-fg-muted hover:text-fg hover:bg-bg-alt transition-colors"
              >
                <WhatsAppIcon size={14} />
                <span>Abrir WhatsApp Web (Elegir cualquier chat)</span>
              </button>
            </div>
          </div>

          {/* Fila inferior: Texto limpio con Enlace Oficial con Vista Previa */}
          <div className="border-t border-border/60 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-fg-muted flex items-center gap-1.5">
                <MessageCircle size={13} /> Texto del mensaje (con enlace que muestra foto en WhatsApp)
              </span>
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1 font-bold text-xs text-emerald-600 hover:underline"
              >
                {copiedAction === "text" ? <Check size={13} /> : <Copy size={13} />}
                {copiedAction === "text" ? "¡Texto copiado!" : "Copiar texto"}
              </button>
            </div>

            <div className="relative rounded-2xl border border-border/70 bg-bg-alt/70 p-3.5 text-xs font-mono text-fg leading-relaxed">
              <pre className="whitespace-pre-wrap select-all font-sans text-xs">
                {cleanWhatsAppText}
              </pre>

              <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-fg-muted">
                <span>Enlace público: <strong>{directProductUrl}</strong></span>
                <a
                  href={directProductUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                >
                  <ExternalLink size={11} /> Probar página pública
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Pie del modal */}
        <div className="flex items-center justify-between border-t border-border/60 bg-bg-alt/40 px-4 py-2.5 sm:px-6">
          <span className="text-[11px] text-fg-muted flex items-center gap-1">
            <Info size={12} /> La imagen se genera en formato PNG HD (1080×1080) listo para WhatsApp, Facebook e Instagram.
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
