"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import {
  Search,
  X,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Sparkles,
  Flame,
  PackageCheck,
  Plus,
  Minus,
  Trash2,
  QrCode,
  ExternalLink,
  Clock,
  CheckCircle2,
  ShoppingBag,
  Eye,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import type { CatalogoProduct, CatalogoCategory } from "@/app/catalogo/actions";
import { CategoryIcon } from "@/components/tienda/categoryIcons";
import { CinematicIntro } from "./CinematicIntro";

/**
 * Motor Acústico Háptico Suave (Web Audio API)
 * Sonido aterciopelado tipo gota de agua / burbuja táctil,
 * limpio, profesional y agradable al tacto.
 */
class KioskAudioEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.ctx) {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxClass) {
          this.ctx = new AudioCtxClass();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Toque suave táctil (Waterdrop / Bubble Tap)
  tap(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(2.0, now);

      osc.type = "sine";
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);

      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {}
  }

  // Tecla del teclado virtual en pantalla
  key(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.03);

      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }

  // Éxito / Agregar a cotización
  success(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 1046.5, delay: 0, dur: 0.12, vol: 0.03 },
        { freq: 1567.98, delay: 0.05, dur: 0.16, vol: 0.035 },
      ];
      notes.forEach(({ freq, delay, dur, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + delay);
        gain.gain.setValueAtTime(vol, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + dur);
      });
    } catch {}
  }

  // Abrir ventana / modal
  open(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.07);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {}
  }

  // Cerrar ventana / modal
  close(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.06);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {}
  }

  // Sonido de bienvenida al entrar al catálogo
  cinematicIntro(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const chords = [
        { f: 523.25, d: 0.04, dur: 0.4, v: 0.02 },
        { f: 659.25, d: 0.1, dur: 0.45, v: 0.025 },
        { f: 783.99, d: 0.18, dur: 0.5, v: 0.03 },
        { f: 1046.5, d: 0.25, dur: 0.6, v: 0.035 },
      ];
      chords.forEach(({ f, d, dur, v }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now + d);
        gain.gain.setValueAtTime(v, now + d);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + d + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + d);
        osc.stop(now + d + dur);
      });
    } catch {}
  }
}

const kioskAudio = new KioskAudioEngine();

interface CartItem {
  product: CatalogoProduct;
  quantity: number;
}

interface CatalogoKioskProps {
  initialProducts: CatalogoProduct[];
  initialCategories: CatalogoCategory[];
  isAdminPreview?: boolean;
}

export function CatalogoKiosk({
  initialProducts,
  initialCategories,
  isAdminPreview = false,
}: CatalogoKioskProps) {
  const [products] = useState<CatalogoProduct[]>(initialProducts);
  const [categories] = useState<CatalogoCategory[]>(initialCategories);
  const [activeCategory, setActiveCategory] = useState("TODOS");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "featured" | "onsale" | "instock">("all");

  // Pantalla de Bienvenida
  const [showWelcome, setShowWelcome] = useState(true);

  // Opciones de Kiosco / Pantallas
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  // Modo Vitrina Automática (Showroom Autoplay)
  const [isAutoplayActive, setIsAutoplayActive] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  // Modales y drawers
  const [detailProduct, setDetailProduct] = useState<CatalogoProduct | null>(null);
  const [productQrDataUrl, setProductQrDataUrl] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [quoteTicketQr, setQuoteTicketQr] = useState<string>("");
  const [ticketNumber, setTicketNumber] = useState<string>("");

  // Inactividad para volver a la pantalla de bienvenida (90s)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Saludo dinámico según la hora en Huancayo
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: "¡Buenos días!", icon: "☀️", sub: "Bienvenido a INFOSISTEL" };
    if (hour >= 12 && hour < 19) return { text: "¡Buenas tardes!", icon: "⛅", sub: "Bienvenido a INFOSISTEL" };
    return { text: "¡Buenas noches!", icon: "🌙", sub: "Bienvenido a INFOSISTEL" };
  }, []);

  // Reloj digital para la tienda
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cerrar bienvenida y entrar al catálogo
  const handleEnterCatalog = useCallback(
    (targetCategory?: string) => {
      kioskAudio.cinematicIntro(soundEnabled);
      if (targetCategory) {
        setActiveCategory(targetCategory);
      }
      setShowWelcome(false);
    },
    [soundEnabled]
  );

  // Productos destacados o en oferta para el banner de vitrina
  const showcaseProducts = useMemo(() => {
    const featured = products.filter((p) => p.isFeatured || p.onSale);
    return featured.length > 0 ? featured : products.slice(0, 5);
  }, [products]);

  // Rotación del banner hero
  useEffect(() => {
    if (showcaseProducts.length === 0) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % showcaseProducts.length);
    }, isAutoplayActive ? 4500 : 7000);
    return () => clearInterval(interval);
  }, [showcaseProducts.length, isAutoplayActive]);

  // Fullscreen nativo
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    kioskAudio.tap(soundEnabled);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, [soundEnabled]);

  // Detector de inactividad
  const resetIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isAutoplayActive) {
      setIsAutoplayActive(false);
    }
    if (!detailProduct && !isCartOpen && !showWelcome) {
      idleTimerRef.current = setTimeout(() => {
        setShowWelcome(true);
      }, 90000);
    }
  }, [isAutoplayActive, detailProduct, isCartOpen, showWelcome]);

  useEffect(() => {
    const events = ["mousedown", "mousemove", "touchstart", "touchmove", "keydown"];
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdle]);

  // Generar QR para el producto seleccionado
  useEffect(() => {
    if (!detailProduct) {
      setProductQrDataUrl("");
      return;
    }
    const finalPrice =
      detailProduct.onSale && detailProduct.salePrice ? detailProduct.salePrice : detailProduct.price;
    const waText = `Hola INFOSISTEL, vi en la pantalla de su tienda el producto: ${detailProduct.name} (Código: INF-${detailProduct.itemNumber}) por S/ ${finalPrice.toFixed(2)}. ¿Tienen stock disponible?`;
    const waUrl = `https://wa.me/51964648202?text=${encodeURIComponent(waText)}`;

    QRCode.toDataURL(waUrl, {
      width: 280,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setProductQrDataUrl)
      .catch(() => {});
  }, [detailProduct]);

  // Filtrado de productos en tiempo real
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Categoría
      if (
        activeCategory !== "TODOS" &&
        p.category.trim().toUpperCase() !== activeCategory.trim().toUpperCase()
      ) {
        return false;
      }
      // Filtros
      if (filterType === "featured" && !p.isFeatured) return false;
      if (filterType === "onsale" && !p.onSale) return false;
      if (filterType === "instock" && p.stock <= 0) return false;

      // Búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        const matchCat = p.category.toLowerCase().includes(q);
        const matchBarcode = p.barcode?.toLowerCase().includes(q);
        const matchCode = `inf-${p.itemNumber}`.includes(q);
        return matchName || matchDesc || matchCat || matchBarcode || matchCode;
      }
      return true;
    });
  }, [products, activeCategory, filterType, searchQuery]);

  // Carrito / Cotización
  const addToCart = (product: CatalogoProduct) => {
    kioskAudio.success(soundEnabled);
    setCart((prev) => {
      const exists = prev.find((item) => item.product.id === product.id);
      if (exists) {
        if (exists.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    kioskAudio.key(soundEnabled);
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            if (nextQty > item.product.stock) return item;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    kioskAudio.close(soundEnabled);
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    kioskAudio.close(soundEnabled);
    setCart([]);
    setQuoteTicketQr("");
    setTicketNumber("");
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const price =
        item.product.onSale && item.product.salePrice ? item.product.salePrice : item.product.price;
      return acc + price * item.quantity;
    }, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Generar Ticket QR
  const handleGenerateTicket = async () => {
    if (cart.length === 0) return;
    kioskAudio.success(soundEnabled);
    const num = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
    setTicketNumber(num);

    const itemsSummary = cart
      .map((i) => {
        const p = i.product.onSale && i.product.salePrice ? i.product.salePrice : i.product.price;
        return `• ${i.product.name} (x${i.quantity}) - S/${(p * i.quantity).toFixed(2)}`;
      })
      .join("\n");

    const message = `📋 COTIZACIÓN INFOSISTEL (#${num})\n\n${itemsSummary}\n\n💰 TOTAL: S/ ${cartTotal.toFixed(2)}\n\n(Generado desde el catálogo en tienda)`;
    const waUrl = `https://wa.me/51964648202?text=${encodeURIComponent(message)}`;

    try {
      const qr = await QRCode.toDataURL(waUrl, {
        width: 300,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQuoteTicketQr(qr);
    } catch {}
  };

  // Teclado virtual táctil
  const keyboardRows = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ];

  const handleVirtualKey = (key: string) => {
    kioskAudio.key(soundEnabled);
    setSearchQuery((prev) => prev + key);
  };

  const handleVirtualBackspace = () => {
    kioskAudio.key(soundEnabled);
    setSearchQuery((prev) => prev.slice(0, -1));
  };

  const handleVirtualSpace = () => {
    kioskAudio.key(soundEnabled);
    setSearchQuery((prev) => prev + " ");
  };

  const handleVirtualClear = () => {
    kioskAudio.close(soundEnabled);
    setSearchQuery("");
  };

  const activeHero = showcaseProducts[heroIndex] || products[0];

  return (
    <div
      className={`relative flex flex-col w-full select-none bg-white text-slate-900 font-sans ${
        isAdminPreview
          ? "h-[850px] rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
          : "min-h-screen"
      }`}
    >
      {/* PANTALLA DE BIENVENIDA PROFESIONAL EN BLANCO PURO */}
      {showWelcome && (
        <CinematicIntro
          onEnter={(targetCat) => handleEnterCatalog(targetCat)}
          soundEnabled={soundEnabled}
          onToggleSound={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            if (next) kioskAudio.tap(true);
          }}
          greetingText={greeting.text}
          greetingIcon={greeting.icon}
          autoEnterSeconds={8}
        />
      )}

      {/* BARRA SUPERIOR PROFESIONAL EN BLANCO PURO */}
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-slate-200/90 bg-white/95 px-3 sm:px-6 py-2.5 sm:py-3.5 backdrop-blur-md gap-2 shadow-xs">
        {/* Logo Oficial de Infosistel */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
          <button
            onClick={() => {
              setShowWelcome(true);
              kioskAudio.open(soundEnabled);
            }}
            className="flex shrink-0 items-center transition-transform active:scale-95"
            title="Volver a la Bienvenida"
          >
            <Image
              src="/brand/infosistel-logo-v3.png"
              alt="Infosistel"
              width={220}
              height={40}
              priority
              className="h-6 xs:h-7 sm:h-9 md:h-10 w-auto max-w-[110px] xs:max-w-[135px] sm:max-w-[200px] md:max-w-none object-contain"
            />
          </button>

          <div className="hidden md:flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
              Catálogo Digital
            </span>
          </div>
        </div>

        {/* Controles de Tienda */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Botón Bienvenida */}
          <button
            onClick={() => {
              setShowWelcome(true);
              kioskAudio.open(soundEnabled);
            }}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-700 active:scale-95 transition-all shadow-xs"
            title="Pantalla de Bienvenida"
          >
            <span>👋 Bienvenida</span>
          </button>

          {/* Reloj Digital */}
          {currentTime && (
            <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-700">
              <Clock size={14} className="text-blue-600 animate-pulse" />
              <span>{currentTime}</span>
            </div>
          )}

          {/* Modo Vitrina */}
          <button
            onClick={() => {
              const next = !isAutoplayActive;
              setIsAutoplayActive(next);
              kioskAudio.tap(soundEnabled);
            }}
            className={`hidden md:flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all active:scale-95 ${
              isAutoplayActive
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-xs"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs"
            }`}
            title="Activar o pausar rotación automática"
          >
            {isAutoplayActive ? <Pause size={14} className="text-emerald-700" /> : <Play size={14} />}
            <span>{isAutoplayActive ? "Vitrina Activa" : "Modo Vitrina"}</span>
          </button>

          {/* Sonido Táctil */}
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) kioskAudio.tap(true);
            }}
            className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl border transition-all active:scale-90 shadow-xs ${
              soundEnabled
                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100/60"
                : "border-slate-200 bg-white text-slate-400 hover:text-slate-600"
            }`}
            title="Sonido táctil suave"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Botón Cotización */}
          <button
            onClick={() => {
              setIsCartOpen(true);
              kioskAudio.open(soundEnabled);
            }}
            className="relative flex h-9 px-2.5 sm:h-10 sm:px-3.5 items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white transition-all active:scale-95 shrink-0 shadow-sm"
            title="Ver cotización de productos"
          >
            <ShoppingBag size={16} className="text-blue-400" />
            <span className="hidden sm:inline">Cotización</span>
            {cartCount > 0 && (
              <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-blue-600 text-[9px] sm:text-[10px] font-black text-white animate-pulse">
                {cartCount}
              </span>
            )}
          </button>

          {/* Pantalla Completa */}
          {!isAdminPreview && (
            <button
              onClick={toggleFullscreen}
              className="flex h-9 px-2.5 sm:h-10 sm:px-3.5 items-center gap-1.5 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm shadow-blue-500/20 active:scale-95 shrink-0"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span className="hidden sm:inline">{isFullscreen ? "Salir" : "Pantalla Completa"}</span>
            </button>
          )}

          {isAdminPreview && (
            <Link
              href="/catalogo"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 px-2.5 sm:h-10 sm:px-3.5 items-center gap-1.5 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm active:scale-95 shrink-0"
            >
              <ExternalLink size={15} />
              <span className="hidden sm:inline">Abrir en Laptop</span>
            </Link>
          )}
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL SCROLLABLE */}
      <div className="relative z-10 flex flex-1 flex-col overflow-y-auto bg-slate-50/50">
        
        {/* BANNER SHOWCASE DESTACADO PROFESIONAL */}
        {activeHero && (
          <div className="p-3 sm:p-6 pb-2">
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 md:p-8 shadow-sm transition-all duration-500">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-center">
                {/* Información del producto destacado */}
                <div className="md:col-span-7 space-y-2 sm:space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-900">
                      <Sparkles size={11} className="text-amber-600" /> {activeHero.onSale ? "Oferta Especial" : "Producto Destacado"}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] sm:text-xs font-mono text-slate-700">
                      INF-{activeHero.itemNumber}
                    </span>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-emerald-800">
                      ● Stock en tienda ({activeHero.stock} disponibles)
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-snug line-clamp-2">
                    {activeHero.name}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {activeHero.description ||
                      "Garantía oficial y servicio técnico garantizado por INFOSISTEL en Huancayo."}
                  </p>

                  <div className="flex items-baseline gap-3 pt-0.5">
                    <div className="text-2xl sm:text-3xl font-black text-blue-600">
                      S/{" "}
                      {(activeHero.onSale && activeHero.salePrice
                        ? activeHero.salePrice
                        : activeHero.price
                      ).toFixed(2)}
                    </div>
                    {activeHero.onSale && activeHero.salePrice && (
                      <div className="text-xs sm:text-sm text-slate-400 line-through">
                        S/ {activeHero.price.toFixed(2)}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => {
                        setDetailProduct(activeHero);
                        kioskAudio.open(soundEnabled);
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
                    >
                      <Eye size={16} />
                      <span>Ver Ficha & QR</span>
                    </button>

                    <button
                      onClick={() => addToCart(activeHero)}
                      className="flex items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 active:scale-95 transition-all shadow-xs"
                    >
                      <Plus size={16} />
                      <span>Cotizar</span>
                    </button>
                  </div>
                </div>

                {/* Foto / Ilustración en pedestal blanco */}
                <div className="md:col-span-5 flex items-center justify-center">
                  <div
                    onClick={() => {
                      setDetailProduct(activeHero);
                      kioskAudio.open(soundEnabled);
                    }}
                    className="relative flex h-44 sm:h-56 md:h-64 w-full max-w-xs sm:max-w-sm items-center justify-center rounded-2xl sm:rounded-3xl bg-slate-50 p-4 border border-slate-200/80 shadow-xs group cursor-pointer"
                  >
                    {activeHero.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activeHero.image}
                        alt={activeHero.name}
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                        <div className="h-16 w-16 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center mb-2">
                          <CategoryIcon category={activeHero.category} size={36} className="text-blue-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          {activeHero.category}
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 rounded-lg bg-white/95 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-xs">
                      Toca para ampliar
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BÚSQUEDA Y CATEGORÍAS */}
        <div className="px-3 sm:px-6 py-2 sm:py-3 space-y-3">
          {/* Barra de Búsqueda */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar mouse, teclado, laptop, repuesto o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => kioskAudio.key(soundEnabled)}
                className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl border border-slate-200 bg-white pl-10 pr-9 text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    kioskAudio.close(soundEnabled);
                    setSearchQuery("");
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Botón Teclado en Pantalla */}
            <button
              onClick={() => {
                const next = !showVirtualKeyboard;
                setShowVirtualKeyboard(next);
                if (next) kioskAudio.open(soundEnabled);
                else kioskAudio.close(soundEnabled);
              }}
              className={`hidden sm:flex h-11 sm:h-12 items-center gap-1.5 rounded-xl sm:rounded-2xl border px-3 text-xs font-bold transition-all active:scale-95 shrink-0 shadow-xs ${
                showVirtualKeyboard
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>⌨️ Teclado</span>
            </button>
          </div>

          {/* TECLADO EN PANTALLA TÁCTIL */}
          {showVirtualKeyboard && (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-xl animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-1.5 sm:space-y-2">
                {keyboardRows.map((row, rIdx) => (
                  <div key={rIdx} className="flex justify-center gap-1 sm:gap-2">
                    {row.map((char) => (
                      <button
                        key={char}
                        onClick={() => handleVirtualKey(char)}
                        className="flex h-9 w-7 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-xs sm:text-base font-bold text-slate-800 shadow-xs active:scale-90 transition-transform"
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                ))}

                <div className="flex justify-center gap-1.5 pt-1">
                  <button
                    onClick={handleVirtualClear}
                    className="flex h-9 px-3 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-[11px] font-bold text-red-700 active:scale-95"
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={handleVirtualSpace}
                    className="flex h-9 flex-1 max-w-xs items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700 active:scale-95"
                  >
                    ESPACIO
                  </button>
                  <button
                    onClick={handleVirtualBackspace}
                    className="flex h-9 px-3 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-[11px] font-bold text-amber-800 active:scale-95"
                  >
                    ⌫ Borrar
                  </button>
                  <button
                    onClick={() => setShowVirtualKeyboard(false)}
                    className="flex h-9 px-3 items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 active:scale-95"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FILTROS Y CATEGORÍAS */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
            {/* TODOS */}
            <button
              onClick={() => {
                setActiveCategory("TODOS");
                setFilterType("all");
                kioskAudio.tap(soundEnabled);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl sm:rounded-2xl border px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-xs ${
                activeCategory === "TODOS" && filterType === "all"
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>Todos ({products.length})</span>
            </button>

            {/* Destacados */}
            <button
              onClick={() => {
                setFilterType(filterType === "featured" ? "all" : "featured");
                kioskAudio.tap(soundEnabled);
              }}
              className={`flex shrink-0 items-center gap-1 rounded-xl sm:rounded-2xl border px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-xs ${
                filterType === "featured"
                  ? "border-amber-400 bg-amber-500 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Sparkles size={13} className={filterType === "featured" ? "text-white" : "text-amber-500"} />
              <span>Destacados</span>
            </button>

            {/* Ofertas */}
            <button
              onClick={() => {
                setFilterType(filterType === "onsale" ? "all" : "onsale");
                kioskAudio.tap(soundEnabled);
              }}
              className={`flex shrink-0 items-center gap-1 rounded-xl sm:rounded-2xl border px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-xs ${
                filterType === "onsale"
                  ? "border-red-400 bg-red-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Flame size={13} className={filterType === "onsale" ? "text-white" : "text-red-500"} />
              <span>Ofertas</span>
            </button>

            {/* En Stock */}
            <button
              onClick={() => {
                setFilterType(filterType === "instock" ? "all" : "instock");
                kioskAudio.tap(soundEnabled);
              }}
              className={`flex shrink-0 items-center gap-1 rounded-xl sm:rounded-2xl border px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-xs ${
                filterType === "instock"
                  ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <PackageCheck size={13} className={filterType === "instock" ? "text-white" : "text-emerald-600"} />
              <span>En Stock</span>
            </button>

            {categories.length > 0 && <div className="h-5 w-px bg-slate-200 shrink-0 mx-1" />}

            {/* Categorías Dinámicas */}
            {categories.map((cat) => {
              const isSelected = activeCategory.trim().toUpperCase() === cat.name.trim().toUpperCase();
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(isSelected ? "TODOS" : cat.name);
                    kioskAudio.tap(soundEnabled);
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl sm:rounded-2xl border px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-xs ${
                    isSelected
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <CategoryIcon category={cat.name} size={14} className={isSelected ? "text-white" : "text-blue-600"} />
                  <span>{cat.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold ${
                      isSelected ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CUADRÍCULA DE PRODUCTOS PROFESIONAL */}
        <div className="flex-1 p-3 sm:p-6 pt-1">
          {filteredProducts.length === 0 ? (
            <div className="flex h-64 sm:h-80 flex-col items-center justify-center text-center p-6 rounded-2xl sm:rounded-3xl border border-slate-200 bg-white my-2 shadow-xs">
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 border border-slate-200 mb-2 sm:mb-3">
                <Search size={24} />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                No se encontraron productos coincidentes
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Prueba con otro término de búsqueda o limpia los filtros para explorar todo nuestro inventario.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("TODOS");
                  setFilterType("all");
                  kioskAudio.close(soundEnabled);
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 shadow-xs"
              >
                <RotateCcw size={14} />
                <span>Restablecer filtros</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 md:gap-5">
              {filteredProducts.map((p) => {
                const finalPrice = p.onSale && p.salePrice ? p.salePrice : p.price;
                const discount =
                  p.onSale && p.salePrice ? Math.round(((p.price - p.salePrice) / p.price) * 100) : 0;
                const inCart = cart.find((i) => i.product.id === p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setDetailProduct(p);
                      kioskAudio.open(soundEnabled);
                    }}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-2.5 sm:p-4 transition-all duration-200 hover:border-blue-400 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] cursor-pointer shadow-xs"
                  >
                    {/* Header Card */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate max-w-[80px] sm:max-w-none">
                        {p.category}
                      </span>
                      {p.onSale && discount > 0 && (
                        <span className="flex items-center gap-0.5 rounded-lg bg-red-600 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase text-white shrink-0">
                          <Flame size={10} /> -{discount}%
                        </span>
                      )}
                    </div>

                    {/* Foto / Ilustración en pedestal blanco */}
                    <div className="relative my-1.5 flex h-32 sm:h-44 w-full items-center justify-center rounded-xl sm:rounded-2xl bg-slate-50 p-2 overflow-hidden border border-slate-100">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center mb-1">
                            <CategoryIcon category={p.category} size={28} className="text-blue-600" />
                          </div>
                          <span className="text-[10px] font-bold text-slate-600 uppercase">
                            {p.category}
                          </span>
                        </div>
                      )}

                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md sm:rounded-xl bg-white/95 border border-slate-200 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold shadow-xs">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            p.stock > 0 ? "bg-emerald-500 animate-pulse" : "bg-red-400"
                          }`}
                        />
                        <span className={p.stock > 0 ? "text-slate-800" : "text-red-600"}>
                          {p.stock > 0 ? `${p.stock} en tienda` : "Agotado"}
                        </span>
                      </div>
                    </div>

                    {/* Título y Código */}
                    <div className="space-y-0.5 mb-2">
                      <div className="text-[9px] sm:text-[10px] font-mono text-slate-400">INF-{p.itemNumber}</div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                        {p.name}
                      </h4>
                    </div>

                    {/* Precios y Botón QR / Cotización */}
                    <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                      <div>
                        {p.onSale && p.salePrice && (
                          <div className="text-[10px] sm:text-[11px] text-slate-400 line-through">
                            S/ {p.price.toFixed(2)}
                          </div>
                        )}
                        <div className="font-black text-sm sm:text-base md:text-lg text-slate-950">
                          S/ {finalPrice.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailProduct(p);
                            kioskAudio.open(soundEnabled);
                          }}
                          className="flex h-8 px-2 sm:h-9 sm:px-2.5 items-center gap-1 rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 active:scale-95 transition-all shadow-xs"
                          title="Escanear QR o ver ficha"
                        >
                          <QrCode size={13} />
                          <span className="hidden xs:inline">QR</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (p.stock > 0) addToCart(p);
                          }}
                          disabled={p.stock <= 0}
                          className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl border transition-all active:scale-90 shadow-xs ${
                            p.stock <= 0
                              ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                              : inCart
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                          title="Agregar a cotización"
                        >
                          {inCart ? <CheckCircle2 size={14} /> : <Plus size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL FICHA TÉCNICA */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 md:p-8 shadow-2xl">
            {/* Botón Cerrar */}
            <button
              onClick={() => {
                setDetailProduct(null);
                kioskAudio.close(soundEnabled);
              }}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 active:scale-90 transition-transform"
            >
              <X size={18} />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 overflow-y-auto pr-1">
              {/* Imagen y Código QR */}
              <div className="space-y-3 sm:space-y-4">
                <div className="relative flex h-48 sm:h-64 md:h-72 w-full items-center justify-center rounded-2xl sm:rounded-3xl bg-slate-50 border border-slate-200 p-4">
                  {detailProduct.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={detailProduct.image}
                      alt={detailProduct.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <div className="h-20 w-20 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-2">
                        <CategoryIcon category={detailProduct.category} size={48} className="text-blue-600" />
                      </div>
                      <span className="text-xs font-bold text-slate-600 uppercase">
                        {detailProduct.category}
                      </span>
                    </div>
                  )}
                </div>

                {/* QR para WhatsApp */}
                <div className="rounded-xl sm:rounded-2xl border border-blue-200 bg-blue-50/60 p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow-xs">
                  {productQrDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productQrDataUrl}
                      alt="Código QR"
                      className="h-20 w-20 sm:h-24 sm:w-24 rounded-lg sm:rounded-xl border border-slate-200 bg-white p-1 shadow-sm shrink-0"
                    />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-blue-900">
                      <QrCode size={15} />
                      <span>¡LLÉVATELO EN TU CELULAR!</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 leading-snug">
                      Apunta la cámara de tu celular a este código para abrir WhatsApp con Infosistel y pedir este producto directamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Ficha técnica y precio */}
              <div className="flex flex-col justify-between space-y-4 sm:space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-slate-700 uppercase">
                      {detailProduct.category}
                    </span>
                    <span className="text-[10px] sm:text-xs font-mono text-slate-400">
                      INF-{detailProduct.itemNumber}
                    </span>
                  </div>

                  <h2 className="text-base sm:text-xl md:text-2xl font-extrabold text-slate-900 leading-snug mb-2 sm:mb-3">
                    {detailProduct.name}
                  </h2>

                  <div className="mb-3 sm:mb-4">
                    <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Descripción técnica:
                    </div>
                    <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4 text-xs sm:text-sm text-slate-700 leading-relaxed max-h-36 sm:max-h-44 overflow-y-auto">
                      {detailProduct.description ||
                        "Garantía oficial y soporte técnico garantizado en tienda INFOSISTEL."}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        detailProduct.stock > 0 ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-700">
                      {detailProduct.stock > 0
                        ? `Stock disponible en tienda: ${detailProduct.stock} unidades`
                        : "Agotado temporalmente"}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] sm:text-xs text-slate-500">Precio en tienda:</div>
                    <div className="text-xl sm:text-3xl font-black text-blue-600">
                      S/{" "}
                      {(detailProduct.onSale && detailProduct.salePrice
                        ? detailProduct.salePrice
                        : detailProduct.price
                      ).toFixed(2)}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (detailProduct.stock > 0) {
                        addToCart(detailProduct);
                        setDetailProduct(null);
                      }
                    }}
                    disabled={detailProduct.stock <= 0}
                    className="rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 px-5 py-3 sm:px-6 sm:py-3.5 text-xs sm:text-sm font-bold text-white shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    + Agregar a Cotización
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER LATERAL DE COTIZACIÓN */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative flex h-full w-full max-w-md sm:max-w-lg flex-col border-l border-slate-200 bg-white p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 sm:pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">Mi Cotización</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    {cart.length} productos agregados
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  kioskAudio.close(soundEnabled);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {cart.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-center">
                  <ShoppingBag size={32} className="text-slate-300 mb-2" />
                  <p className="text-xs text-slate-500">Aún no has agregado productos a tu lista.</p>
                </div>
              ) : (
                cart.map((item) => {
                  const p =
                    item.product.onSale && item.product.salePrice
                      ? item.product.salePrice
                      : item.product.price;
                  return (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 p-1">
                          {item.product.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.product.image}
                              alt={item.product.name}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <CategoryIcon category={item.product.category} size={16} className="text-blue-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-900 truncate">{item.product.name}</div>
                          <div className="text-[11px] text-blue-700 font-semibold">
                            S/ {p.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-700 active:scale-90"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="font-bold text-xs text-slate-900 w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-700 active:scale-90"
                        >
                          <Plus size={11} />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 border border-red-200 text-red-600 hover:text-red-700 ml-0.5 active:scale-90"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {quoteTicketQr && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4 text-center space-y-2.5 animate-in zoom-in-95 duration-200">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    ¡Ticket para Caja Listo!
                  </div>
                  <div className="font-mono text-lg font-black text-slate-900">#{ticketNumber}</div>
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={quoteTicketQr}
                      alt="QR Cotización"
                      className="h-36 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-md"
                    />
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Muestra este código al vendedor o escanéalo con tu WhatsApp para procesar tu orden.
                  </p>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-semibold text-xs">TOTAL A PAGAR:</span>
                  <span className="font-black text-xl text-blue-600">S/ {cartTotal.toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={clearCart}
                    className="rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all shadow-xs"
                  >
                    Vaciar
                  </button>
                  <button
                    onClick={handleGenerateTicket}
                    className="rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    Generar Ticket QR
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
