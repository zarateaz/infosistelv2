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
  ArrowRight,
  Hand,
  Laptop,
  Mouse,
  Keyboard,
  Monitor,
  Headphones,
  HardDrive,
  Printer,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import type { CatalogoProduct, CatalogoCategory } from "@/app/catalogo/actions";
import { CategoryIcon } from "@/components/tienda/categoryIcons";

/**
 * Motor Acústico Háptico Ultra Fluido (Web Audio API)
 * Diseñado específicamente para pantallas táctiles y kioscos de tienda:
 * Sonido aterciopelado tipo burbuja/gota de agua (waterdrop haptic tap),
 * libre de frecuencias chirriantes o metálicas.
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
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(2.2, now);

      osc.type = "sine";
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.exponentialRampToValueAtTime(310, now + 0.04);

      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Ignorar bloqueos de autoplay
    }
  }

  // Tecla del teclado virtual en pantalla (micro click táctil)
  key(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.03);

      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }

  // Éxito / Agregar a cotización (acorde armónico C6 - G6 cristalino)
  success(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 1046.5, delay: 0, dur: 0.12, vol: 0.035 },
        { freq: 1567.98, delay: 0.05, dur: 0.16, vol: 0.04 },
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

  // Abrir ventana / modal (sweep ascendente suave)
  open(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.07);
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {}
  }

  // Cerrar ventana / modal (sweep descendente sutil)
  close(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.06);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
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

  // PANTALLA DE BIENVENIDA OFICIAL (Splash interactivo)
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeCountdown, setWelcomeCountdown] = useState(6);

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

  // Inactividad para volver a la pantalla de bienvenida / vitrina (90s)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Saludo dinámico según la hora de Huancayo
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

  // Contador de entrada automática en bienvenida
  useEffect(() => {
    if (!showWelcome) return;
    const timer = setInterval(() => {
      setWelcomeCountdown((prev) => {
        if (prev <= 1) {
          setShowWelcome(false);
          kioskAudio.open(soundEnabled);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showWelcome, soundEnabled]);

  // Cerrar bienvenida y entrar al catálogo
  const handleEnterCatalog = useCallback(
    (targetCategory?: string) => {
      kioskAudio.success(soundEnabled);
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
    }, isAutoplayActive ? 4000 : 7000);
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

  // Detector de inactividad: Regresa a la bienvenida o activa vitrina
  const resetIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isAutoplayActive) {
      setIsAutoplayActive(false);
    }
    if (!detailProduct && !isCartOpen && !showWelcome) {
      idleTimerRef.current = setTimeout(() => {
        // Al estar inactivo 85 segundos en la tienda, mostrar la pantalla de bienvenida interactiva
        setShowWelcome(true);
        setWelcomeCountdown(10);
      }, 85000);
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
      className={`relative flex flex-col w-full select-none bg-slate-950 text-slate-100 font-sans ${
        isAdminPreview
          ? "h-[850px] rounded-3xl border border-cyan-500/20 shadow-2xl overflow-hidden"
          : "min-h-screen"
      }`}
    >
      {/* Fondo Aurora & Glow Kiosk Fluido */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-80 sm:w-[500px] h-80 sm:h-[500px] rounded-full bg-cyan-600/15 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-80 sm:w-[550px] h-80 sm:h-[550px] rounded-full bg-blue-600/15 blur-[130px]" />
        <div className="absolute -bottom-40 left-1/3 w-80 sm:w-[500px] h-80 sm:h-[500px] rounded-full bg-purple-600/15 blur-[120px]" />
      </div>

      {/* ======================================================== */}
      {/* PANTALLA DE BIENVENIDA OFICIAL (ANIMADA Y FLUIDA)         */}
      {/* ======================================================== */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-4 sm:p-8 animate-in fade-in duration-300">
          <div className="relative flex flex-col items-center justify-center max-w-4xl w-full text-center space-y-6 sm:space-y-8 py-6">
            
            {/* Halo de luz de fondo */}
            <div className="absolute h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-cyan-500/20 blur-[100px] -z-10 animate-pulse" />

            {/* Logo Oficial de Infosistel con resplandor */}
            <div className="relative group cursor-pointer" onClick={() => handleEnterCatalog()}>
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-500/30 via-blue-500/20 to-purple-500/30 blur-xl opacity-75 group-hover:opacity-100 transition-opacity" />
              <Image
                src="/brand/infosistel-logo-v3.png"
                alt="INFOSISTEL"
                width={380}
                height={70}
                priority
                className="relative h-12 xs:h-14 sm:h-16 md:h-20 w-auto object-contain brightness-110 drop-shadow-[0_0_25px_rgba(6,182,212,0.45)] transform group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            {/* Saludo dinámico */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-950/60 px-4 py-1.5 text-xs sm:text-sm font-bold text-cyan-300 shadow-lg shadow-cyan-950/50">
                <span>{greeting.icon}</span>
                <span>{greeting.text}</span>
                <span className="hidden sm:inline">· {greeting.sub}</span>
              </div>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                Catálogo Digital <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">Interactivo</span>
              </h1>
              <p className="text-xs sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
                Descubre en tiempo real nuestras laptops, teclados, mouses, monitores y repuestos con precios oficiales y stock garantizado.
              </p>
            </div>

            {/* Accesos rápidos a categorías destacadas (Mouses, Teclados, Laptops, etc.) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 w-full max-w-2xl pt-1">
              {[
                { name: "MOUSE", label: "Mouses & Ópticos", icon: Mouse, desc: "Gamer y oficina" },
                { name: "TECLADOS", label: "Teclados", icon: Keyboard, desc: "Mecánicos y combos" },
                { name: "LAPTOPS", label: "Laptops & PCs", icon: Laptop, desc: "Portátiles de alto nivel" },
                { name: "MONITORES", label: "Monitores", icon: Monitor, desc: "IPS, 165Hz y FHD" },
              ].map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleEnterCatalog(item.name)}
                  className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-cyan-500 hover:bg-slate-900 transition-all active:scale-95 group shadow-md"
                >
                  <item.icon size={26} className="text-cyan-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300">{item.label}</span>
                  <span className="text-[10px] text-slate-400">{item.desc}</span>
                </button>
              ))}
            </div>

            {/* Botón principal de entrada con cuenta regresiva */}
            <div className="flex flex-col items-center gap-3 w-full max-w-md pt-2">
              <button
                onClick={() => handleEnterCatalog()}
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 px-6 py-4 text-sm sm:text-base font-black text-white shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-95 transition-all group"
              >
                <Hand size={20} className="animate-bounce" />
                <span>TOCAR PARA EXPLORAR CATÁLOGO</span>
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(welcomeCountdown / 6) * 100}%` }}
                  />
                </div>
                <span>Entrada automática en {welcomeCountdown}s</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR DEL KIOSCO */}
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-3 sm:px-6 py-2.5 sm:py-3.5 backdrop-blur-xl gap-2">
        {/* Logo Oficial */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
          <button
            onClick={() => {
              setShowWelcome(true);
              setWelcomeCountdown(10);
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
              className="h-6 xs:h-7 sm:h-9 md:h-10 w-auto max-w-[110px] xs:max-w-[135px] sm:max-w-[200px] md:max-w-none object-contain brightness-110 drop-shadow-[0_0_12px_rgba(6,182,212,0.35)]"
            />
          </button>

          <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-3">
            <span className="rounded-full border border-cyan-500/40 bg-cyan-950/60 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-cyan-400">
              Catálogo Digital
            </span>
          </div>
        </div>

        {/* Controles de Vitrina y Pantalla */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Botón Saludo / Bienvenida */}
          <button
            onClick={() => {
              setShowWelcome(true);
              setWelcomeCountdown(10);
              kioskAudio.open(soundEnabled);
            }}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-2 text-xs font-bold text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 active:scale-95 transition-all"
            title="Pantalla de Bienvenida"
          >
            <span>👋 Bienvenida</span>
          </button>

          {/* Reloj digital */}
          {currentTime && (
            <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-mono text-cyan-300">
              <Clock size={14} className="text-cyan-400 animate-pulse" />
              <span>{currentTime}</span>
            </div>
          )}

          {/* Modo Vitrina Autoplay */}
          <button
            onClick={() => {
              const next = !isAutoplayActive;
              setIsAutoplayActive(next);
              kioskAudio.tap(soundEnabled);
            }}
            className={`hidden md:flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all active:scale-95 ${
              isAutoplayActive
                ? "border-emerald-500 bg-emerald-950/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700"
            }`}
            title="Activar o pausar rotación automática"
          >
            {isAutoplayActive ? <Pause size={14} /> : <Play size={14} />}
            <span>{isAutoplayActive ? "Vitrina Activa" : "Modo Vitrina"}</span>
          </button>

          {/* Sonido Háptico Fluido */}
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) kioskAudio.tap(true);
            }}
            className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl border transition-all active:scale-90 ${
              soundEnabled
                ? "border-cyan-500/40 bg-cyan-950/40 text-cyan-400 hover:bg-cyan-900/50 shadow-sm"
                : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
            }`}
            title="Sonido táctil suave"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Botón Carrito / Cotización */}
          <button
            onClick={() => {
              setIsCartOpen(true);
              kioskAudio.open(soundEnabled);
            }}
            className="relative flex h-9 px-2.5 sm:h-10 sm:px-3.5 items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl border border-slate-700 bg-slate-900 text-xs font-bold text-white transition-all hover:border-cyan-500 active:scale-95 shrink-0"
            title="Ver cotización de productos"
          >
            <ShoppingBag size={16} className="text-cyan-400" />
            <span className="hidden sm:inline">Cotización</span>
            {cartCount > 0 && (
              <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-cyan-500 text-[9px] sm:text-[10px] font-black text-slate-950 animate-pulse">
                {cartCount}
              </span>
            )}
          </button>

          {/* Pantalla Completa */}
          {!isAdminPreview && (
            <button
              onClick={toggleFullscreen}
              className="flex h-9 px-2.5 sm:h-10 sm:px-3.5 items-center gap-1.5 rounded-xl sm:rounded-2xl border border-cyan-500/50 bg-gradient-to-r from-cyan-600 to-blue-600 text-xs font-bold text-white shadow-md shadow-cyan-500/25 active:scale-95 shrink-0"
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
              className="flex h-9 px-2.5 sm:h-10 sm:px-3.5 items-center gap-1.5 rounded-xl sm:rounded-2xl border border-cyan-500/50 bg-gradient-to-r from-cyan-600 to-blue-600 text-xs font-bold text-white shadow-md shadow-cyan-500/25 active:scale-95 shrink-0"
            >
              <ExternalLink size={15} />
              <span className="hidden sm:inline">Abrir en Laptop</span>
            </Link>
          )}
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL SCROLLABLE */}
      <div className="relative z-10 flex flex-1 flex-col overflow-y-auto">
        
        {/* BANNER SHOWCASE DESTACADO FLUIDO */}
        {activeHero && (
          <div className="p-3 sm:p-6 pb-1">
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-cyan-950/60 p-4 sm:p-6 md:p-8 shadow-xl backdrop-blur-xl transition-all duration-500">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-center">
                {/* Información del producto destacado */}
                <div className="md:col-span-7 space-y-2 sm:space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/60 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-300">
                      <Sparkles size={11} /> {activeHero.onSale ? "Oferta Especial" : "Producto Destacado"}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-0.5 text-[10px] sm:text-xs font-mono text-cyan-400">
                      INF-{activeHero.itemNumber}
                    </span>
                    <span className="rounded-full bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-emerald-300">
                      ● Stock en tienda ({activeHero.stock} disponibles)
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug line-clamp-2">
                    {activeHero.name}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed">
                    {activeHero.description ||
                      "Garantía oficial y servicio técnico garantizado por INFOSISTEL en Huancayo."}
                  </p>

                  <div className="flex items-baseline gap-3 pt-0.5">
                    <div className="text-2xl sm:text-3xl font-black text-cyan-400">
                      S/{" "}
                      {(activeHero.onSale && activeHero.salePrice
                        ? activeHero.salePrice
                        : activeHero.price
                      ).toFixed(2)}
                    </div>
                    {activeHero.onSale && activeHero.salePrice && (
                      <div className="text-xs sm:text-sm text-slate-500 line-through">
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
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md active:scale-95 transition-all"
                    >
                      <Eye size={16} />
                      <span>Ver Ficha & QR</span>
                    </button>

                    <button
                      onClick={() => addToCart(activeHero)}
                      className="flex items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-200 hover:text-white active:scale-95 transition-all"
                    >
                      <Plus size={16} />
                      <span>Cotizar</span>
                    </button>
                  </div>
                </div>

                {/* Foto / Ilustración grande en Hero */}
                <div className="md:col-span-5 flex items-center justify-center">
                  <div
                    onClick={() => {
                      setDetailProduct(activeHero);
                      kioskAudio.open(soundEnabled);
                    }}
                    className="relative flex h-40 sm:h-56 md:h-64 w-full max-w-xs sm:max-w-sm items-center justify-center rounded-2xl sm:rounded-3xl bg-slate-950/80 p-3 border border-slate-800/80 shadow-inner group cursor-pointer"
                  >
                    {activeHero.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activeHero.image}
                        alt={activeHero.name}
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 group-hover:text-cyan-400 transition-colors">
                        <CategoryIcon category={activeHero.category} size={64} />
                        <span className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-wider">
                          {activeHero.category}
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 rounded-lg bg-slate-900/90 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                      Toca para ampliar
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BÚSQUEDA Y CATEGORÍAS RESPONSIVE */}
        <div className="px-3 sm:px-6 py-2 sm:py-3 space-y-3">
          
          {/* Barra de búsqueda adaptativa */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400" />
              <input
                type="text"
                placeholder="Buscar mouse, teclado, laptop, repuesto o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => kioskAudio.key(soundEnabled)}
                className="w-full h-10 sm:h-12 rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900/90 pl-10 pr-9 text-sm sm:text-base font-medium text-white placeholder-slate-500 shadow-inner focus:border-cyan-500 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    kioskAudio.close(soundEnabled);
                    setSearchQuery("");
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white"
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
              className={`hidden sm:flex h-10 sm:h-12 items-center gap-1.5 rounded-xl sm:rounded-2xl border px-3 text-xs font-bold transition-all active:scale-95 shrink-0 ${
                showVirtualKeyboard
                  ? "border-cyan-400 bg-cyan-950/80 text-cyan-300"
                  : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>⌨️ Teclado</span>
            </button>
          </div>

          {/* TECLADO EN PANTALLA TÁCTIL */}
          {showVirtualKeyboard && (
            <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/95 p-3 sm:p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-1.5 sm:space-y-2">
                {keyboardRows.map((row, rIdx) => (
                  <div key={rIdx} className="flex justify-center gap-1 sm:gap-2">
                    {row.map((char) => (
                      <button
                        key={char}
                        onClick={() => handleVirtualKey(char)}
                        className="flex h-9 w-7 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl border border-slate-700 bg-slate-900 text-xs sm:text-base font-bold text-white shadow-md active:scale-90 transition-transform"
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                ))}

                <div className="flex justify-center gap-1.5 pt-1">
                  <button
                    onClick={handleVirtualClear}
                    className="flex h-9 px-3 items-center justify-center rounded-lg border border-red-500/40 bg-red-950/40 text-[11px] font-bold text-red-300 active:scale-95"
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={handleVirtualSpace}
                    className="flex h-9 flex-1 max-w-xs items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-slate-300 active:scale-95"
                  >
                    ESPACIO
                  </button>
                  <button
                    onClick={handleVirtualBackspace}
                    className="flex h-9 px-3 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-950/40 text-[11px] font-bold text-amber-300 active:scale-95"
                  >
                    ⌫ Borrar
                  </button>
                  <button
                    onClick={() => setShowVirtualKeyboard(false)}
                    className="flex h-9 px-3 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-[11px] font-bold text-slate-400 active:scale-95"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FILTROS Y CATEGORÍAS FLUIDAS */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
            {/* Botón TODOS */}
            <button
              onClick={() => {
                setActiveCategory("TODOS");
                setFilterType("all");
                kioskAudio.tap(soundEnabled);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl sm:rounded-2xl border px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                activeCategory === "TODOS" && filterType === "all"
                  ? "border-cyan-400 bg-cyan-950/90 text-cyan-300 shadow-sm"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              <span>Todos ({products.length})</span>
            </button>

            {/* Filtros rápidos */}
            <button
              onClick={() => {
                setFilterType(filterType === "featured" ? "all" : "featured");
                kioskAudio.tap(soundEnabled);
              }}
              className={`flex shrink-0 items-center gap-1 rounded-xl sm:rounded-2xl border px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                filterType === "featured"
                  ? "border-amber-400 bg-amber-950/80 text-amber-300"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Destacados</span>
            </button>

            <button
              onClick={() => {
                setFilterType(filterType === "onsale" ? "all" : "onsale");
                kioskAudio.tap(soundEnabled);
              }}
              className={`flex shrink-0 items-center gap-1 rounded-xl sm:rounded-2xl border px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                filterType === "onsale"
                  ? "border-red-400 bg-red-950/80 text-red-300"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              <Flame size={13} className="text-red-400" />
              <span>Ofertas</span>
            </button>

            <button
              onClick={() => {
                setFilterType(filterType === "instock" ? "all" : "instock");
                kioskAudio.tap(soundEnabled);
              }}
              className={`flex shrink-0 items-center gap-1 rounded-xl sm:rounded-2xl border px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                filterType === "instock"
                  ? "border-emerald-400 bg-emerald-950/80 text-emerald-300"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              <PackageCheck size={13} className="text-emerald-400" />
              <span>En Stock</span>
            </button>

            {categories.length > 0 && <div className="h-5 w-px bg-slate-800 shrink-0 mx-1" />}

            {/* Categorías Dinámicas (Mouse, Teclados, Laptops, etc.) */}
            {categories.map((cat) => {
              const isSelected = activeCategory.trim().toUpperCase() === cat.name.trim().toUpperCase();
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(isSelected ? "TODOS" : cat.name);
                    kioskAudio.tap(soundEnabled);
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl sm:rounded-2xl border px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                    isSelected
                      ? "border-cyan-400 bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20"
                      : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                  }`}
                >
                  <CategoryIcon category={cat.name} size={14} />
                  <span>{cat.name}</span>
                  <span className="rounded-full bg-slate-950/70 px-1.5 py-0.2 text-[9px] sm:text-[10px] text-cyan-300 font-bold">
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CUADRÍCULA DE PRODUCTOS FLUIDA */}
        <div className="flex-1 p-3 sm:p-6 pt-0">
          {filteredProducts.length === 0 ? (
            <div className="flex h-64 sm:h-80 flex-col items-center justify-center text-center p-6 rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-900/30 my-2">
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-slate-900 text-slate-500 border border-slate-800 mb-2 sm:mb-3">
                <Search size={24} />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                No se encontraron productos coincidentes
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Prueba con otro término de búsqueda o limpia los filtros para explorar todo nuestro inventario.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("TODOS");
                  setFilterType("all");
                  kioskAudio.close(soundEnabled);
                }}
                className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/60 px-4 py-2 text-xs font-bold text-cyan-400 hover:bg-cyan-900/60"
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
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-900/70 p-2.5 sm:p-4 transition-all duration-200 hover:border-cyan-500/50 hover:bg-slate-900 hover:shadow-xl hover:shadow-cyan-950/30 active:scale-[0.98] cursor-pointer"
                  >
                    {/* Header Card */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="rounded-lg border border-slate-700/60 bg-slate-950/80 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-cyan-400 truncate max-w-[80px] sm:max-w-none">
                        {p.category}
                      </span>
                      {p.onSale && discount > 0 && (
                        <span className="flex items-center gap-0.5 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase text-white shrink-0">
                          <Flame size={10} /> -{discount}%
                        </span>
                      )}
                    </div>

                    {/* Foto / Ilustración */}
                    <div className="relative my-1.5 flex h-32 sm:h-44 w-full items-center justify-center rounded-xl sm:rounded-2xl bg-slate-950/80 p-2 overflow-hidden border border-slate-800/50">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-600 group-hover:text-cyan-400 transition-colors">
                          <CategoryIcon category={p.category} size={40} />
                          <span className="text-[10px] font-bold text-slate-500 mt-1 uppercase">
                            {p.category}
                          </span>
                        </div>
                      )}

                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md sm:rounded-xl bg-slate-950/90 border border-slate-800 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            p.stock > 0 ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                          }`}
                        />
                        <span className={p.stock > 0 ? "text-emerald-300" : "text-red-400"}>
                          {p.stock > 0 ? `${p.stock} en tienda` : "Agotado"}
                        </span>
                      </div>
                    </div>

                    {/* Título y Código */}
                    <div className="space-y-0.5 mb-2">
                      <div className="text-[9px] sm:text-[10px] font-mono text-slate-500">INF-{p.itemNumber}</div>
                      <h4 className="font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug group-hover:text-cyan-300 transition-colors">
                        {p.name}
                      </h4>
                    </div>

                    {/* Precios y Botón QR / Cotización */}
                    <div className="mt-auto pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                      <div>
                        {p.onSale && p.salePrice && (
                          <div className="text-[10px] sm:text-[11px] text-slate-500 line-through">
                            S/ {p.price.toFixed(2)}
                          </div>
                        )}
                        <div className="font-black text-sm sm:text-base md:text-lg text-cyan-400">
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
                          className="flex h-8 px-2 sm:h-9 sm:px-2.5 items-center gap-1 rounded-lg sm:rounded-xl border border-cyan-500/40 bg-cyan-950/50 text-[11px] font-bold text-cyan-300 hover:bg-cyan-900/60 active:scale-95 transition-all"
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
                          className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl border transition-all active:scale-90 ${
                            p.stock <= 0
                              ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                              : inCart
                              ? "border-emerald-500 bg-emerald-950/60 text-emerald-400"
                              : "border-slate-700 bg-slate-800 text-white hover:border-cyan-500 hover:text-cyan-300"
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

      {/* ======================================================== */}
      {/* MODAL FICHA TÉCNICA Y CÓDIGO QR GIGANTE                   */}
      {/* ======================================================== */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-cyan-500/30 bg-slate-950 p-4 sm:p-6 md:p-8 shadow-2xl">
            {/* Botón Cerrar */}
            <button
              onClick={() => {
                setDetailProduct(null);
                kioskAudio.close(soundEnabled);
              }}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white active:scale-90 transition-transform"
            >
              <X size={18} />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 overflow-y-auto pr-1">
              {/* Imagen y Código QR */}
              <div className="space-y-3 sm:space-y-4">
                <div className="relative flex h-48 sm:h-64 md:h-72 w-full items-center justify-center rounded-2xl sm:rounded-3xl bg-slate-900/90 border border-slate-800 p-3 sm:p-4">
                  {detailProduct.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={detailProduct.image}
                      alt={detailProduct.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-600">
                      <CategoryIcon category={detailProduct.category} size={64} />
                      <span className="text-xs font-bold text-slate-400 mt-2 uppercase">
                        {detailProduct.category}
                      </span>
                    </div>
                  )}
                </div>

                {/* Código QR llamativo para smartphone */}
                <div className="rounded-xl sm:rounded-2xl border border-cyan-500/40 bg-cyan-950/40 p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow-lg">
                  {productQrDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productQrDataUrl}
                      alt="Código QR"
                      className="h-20 w-20 sm:h-24 sm:w-24 rounded-lg sm:rounded-xl border border-slate-700 bg-white p-1 shadow-md shrink-0"
                    />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-cyan-300">
                      <QrCode size={15} />
                      <span>¡LLÉVATELO EN TU CELULAR!</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-300 leading-snug">
                      Apunta la cámara de tu celular a este código para abrir WhatsApp con Infosistel y pedir este producto directamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Ficha técnica y precio */}
              <div className="flex flex-col justify-between space-y-4 sm:space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="rounded-lg border border-cyan-500/40 bg-cyan-950 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-cyan-400 uppercase">
                      {detailProduct.category}
                    </span>
                    <span className="text-[10px] sm:text-xs font-mono text-slate-500">
                      INF-{detailProduct.itemNumber}
                    </span>
                  </div>

                  <h2 className="text-base sm:text-xl md:text-2xl font-extrabold text-white leading-snug mb-2 sm:mb-3">
                    {detailProduct.name}
                  </h2>

                  <div className="mb-3 sm:mb-4">
                    <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Descripción técnica:
                    </div>
                    <div className="rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4 text-xs sm:text-sm text-slate-200 leading-relaxed max-h-36 sm:max-h-44 overflow-y-auto">
                      {detailProduct.description ||
                        "Garantía oficial y soporte técnico garantizado en tienda INFOSISTEL."}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        detailProduct.stock > 0 ? "bg-emerald-400 animate-pulse" : "bg-red-500"
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-200">
                      {detailProduct.stock > 0
                        ? `Stock disponible en tienda: ${detailProduct.stock} unidades`
                        : "Agotado temporalmente"}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] sm:text-xs text-slate-400">Precio de tienda:</div>
                    <div className="text-xl sm:text-3xl font-black text-cyan-400">
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
                    className="rounded-xl sm:rounded-2xl border border-cyan-500 bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 sm:px-6 sm:py-3.5 text-xs sm:text-sm font-bold text-white shadow-md active:scale-95 transition-all"
                  >
                    + Agregar a Cotización
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DRAWER LATERAL DE COTIZACIÓN                             */}
      {/* ======================================================== */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative flex h-full w-full max-w-md sm:max-w-lg flex-col border-l border-cyan-500/30 bg-slate-950 p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 sm:pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">Mi Cotización</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    {cart.length} productos agregados
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  kioskAudio.close(soundEnabled);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {cart.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-center">
                  <ShoppingBag size={32} className="text-slate-700 mb-2" />
                  <p className="text-xs text-slate-400">Aún no has agregado productos a tu lista.</p>
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
                      className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-950 border border-slate-800 p-1">
                          {item.product.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.product.image}
                              alt={item.product.name}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <CategoryIcon category={item.product.category} size={16} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-white truncate">{item.product.name}</div>
                          <div className="text-[11px] text-cyan-400 font-semibold">
                            S/ {p.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 border border-slate-700 text-slate-300 active:scale-90"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="font-bold text-xs text-white w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-900/50 border border-cyan-700 text-cyan-300 active:scale-90"
                        >
                          <Plus size={11} />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-red-950/40 border border-red-800/40 text-red-400 hover:text-red-300 ml-0.5 active:scale-90"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {quoteTicketQr && (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-center space-y-2.5 animate-in zoom-in-95 duration-200">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    ¡Ticket para Caja Listo!
                  </div>
                  <div className="font-mono text-lg font-black text-white">#{ticketNumber}</div>
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={quoteTicketQr}
                      alt="QR Cotización"
                      className="h-36 w-36 rounded-xl border border-slate-700 bg-white p-1.5 shadow-lg"
                    />
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Muestra este código al vendedor o escanéalo con tu WhatsApp para procesar tu orden.
                  </p>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-slate-800 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold text-xs">TOTAL A PAGAR:</span>
                  <span className="font-black text-lg text-cyan-400">S/ {cartTotal.toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={clearCart}
                    className="rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-xs font-bold text-slate-400 hover:text-white active:scale-95 transition-all"
                  >
                    Vaciar
                  </button>
                  <button
                    onClick={handleGenerateTicket}
                    className="rounded-xl border border-cyan-500 bg-gradient-to-r from-cyan-600 to-blue-600 py-2.5 text-xs font-bold text-white shadow-md active:scale-95 transition-all"
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
