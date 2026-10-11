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
  LayoutGrid,
  Tv,
  Layers,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  QrCode,
  Share2,
  ExternalLink,
  RotateCcw,
  Clock,
  CheckCircle2,
  ShoppingBag,
  ZoomIn,
  MessageCircle,
  Eye,
  Info,
  ArrowRight,
  PlayCircle
} from "lucide-react";
import type { CatalogoProduct, CatalogoCategory } from "@/app/catalogo/actions";
import { CategoryIcon } from "@/components/tienda/categoryIcons";

// Síntesis de sonido táctil mediante Web Audio API (cero dependencias externas de audio)
function playHapticSound(enabled: boolean, type: "tap" | "success" | "key" | "open" | "close" = "tap") {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "tap" || type === "key") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(type === "key" ? 520 : 640, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === "success") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "open") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.07);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === "close") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.07);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.07);
    }
  } catch {
    // Si la política del navegador bloquea audio antes del primer clic, se silencia
  }
}

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
  // Estado general
  const [products] = useState<CatalogoProduct[]>(initialProducts);
  const [categories] = useState<CatalogoCategory[]>(initialCategories);
  const [activeCategory, setActiveCategory] = useState("TODOS");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "featured" | "onsale" | "instock">("all");
  const [viewMode, setViewMode] = useState<"grid" | "showcase">("grid");

  // Opciones de Kiosco
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  // Modales y drawers
  const [selectedProduct, setSelectedProduct] = useState<CatalogoProduct[] | null>(null);
  const [detailProduct, setDetailProduct] = useState<CatalogoProduct | null>(null);
  const [productQrDataUrl, setProductQrDataUrl] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [quoteTicketQr, setQuoteTicketQr] = useState<string>("");
  const [ticketNumber, setTicketNumber] = useState<string>("");

  // Screensaver / Modo Atracción
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const [screensaverIndex, setScreensaverIndex] = useState(0);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reloj digital para pantalla de tienda
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

  // Control de Fullscreen nativo
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    playHapticSound(soundEnabled, "tap");
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, [soundEnabled]);

  // Gestor de inactividad para Screensaver (60s sin interacción en pantalla)
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isScreensaverActive) {
      setIsScreensaverActive(false);
      playHapticSound(soundEnabled, "open");
    }
    // No activar screensaver mientras haya modales abiertos
    if (!detailProduct && !isCartOpen) {
      idleTimerRef.current = setTimeout(() => {
        setIsScreensaverActive(true);
      }, 60000); // 60 segundos
    }
  }, [isScreensaverActive, detailProduct, isCartOpen, soundEnabled]);

  useEffect(() => {
    const events = ["mousedown", "mousemove", "touchstart", "touchmove", "keydown"];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // Carrusel automático para screensaver
  useEffect(() => {
    if (!isScreensaverActive) return;
    const interval = setInterval(() => {
      setScreensaverIndex((prev) => (prev + 1) % Math.max(1, products.length));
    }, 4500);
    return () => clearInterval(interval);
  }, [isScreensaverActive, products.length]);

  // Generar QR para el producto seleccionado
  useEffect(() => {
    if (!detailProduct) {
      setProductQrDataUrl("");
      return;
    }
    const finalPrice = detailProduct.onSale && detailProduct.salePrice ? detailProduct.salePrice : detailProduct.price;
    const waText = `Hola Infosistel, vi en el catálogo táctil el producto: ${detailProduct.name} (Código: INF-${detailProduct.itemNumber}) por S/ ${finalPrice.toFixed(2)}. Deseo comprarlo o consultar disponibilidad.`;
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
      if (activeCategory !== "TODOS" && p.category.toUpperCase() !== activeCategory.toUpperCase()) {
        return false;
      }
      // Filtros especiales
      if (filterType === "featured" && !p.isFeatured) return false;
      if (filterType === "onsale" && !p.onSale) return false;
      if (filterType === "instock" && p.stock <= 0) return false;

      // Búsqueda por texto (nombre, descripción, código)
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
    playHapticSound(soundEnabled, "success");
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
    playHapticSound(soundEnabled, "key");
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
    playHapticSound(soundEnabled, "close");
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    playHapticSound(soundEnabled, "close");
    setCart([]);
    setQuoteTicketQr("");
    setTicketNumber("");
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const price = item.product.onSale && item.product.salePrice ? item.product.salePrice : item.product.price;
      return acc + price * item.quantity;
    }, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Generar Ticket QR para caja / vendedor
  const handleGenerateTicket = async () => {
    if (cart.length === 0) return;
    playHapticSound(soundEnabled, "success");
    const num = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
    setTicketNumber(num);

    const itemsSummary = cart
      .map((i) => {
        const p = i.product.onSale && i.product.salePrice ? i.product.salePrice : i.product.price;
        return `• ${i.product.name} (x${i.quantity}) - S/${(p * i.quantity).toFixed(2)}`;
      })
      .join("\n");

    const message = `📋 COTIZACIÓN KIOSCO TÁCTIL (#${num})\n\n${itemsSummary}\n\n💰 TOTAL: S/ ${cartTotal.toFixed(2)}\n\n(Presentar este ticket en caja Infosistel)`;
    const waUrl = `https://wa.me/51964648202?text=${encodeURIComponent(message)}`;

    try {
      const qr = await QRCode.toDataURL(waUrl, {
        width: 300,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQuoteTicketQr(qr);
    } catch {
      // Error silencioso
    }
  };

  // Teclado virtual táctil (letras y números para escribir con los dedos)
  const keyboardRows = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ];

  const handleVirtualKey = (key: string) => {
    playHapticSound(soundEnabled, "key");
    setSearchQuery((prev) => prev + key);
  };

  const handleVirtualBackspace = () => {
    playHapticSound(soundEnabled, "key");
    setSearchQuery((prev) => prev.slice(0, -1));
  };

  const handleVirtualSpace = () => {
    playHapticSound(soundEnabled, "key");
    setSearchQuery((prev) => prev + " ");
  };

  const handleVirtualClear = () => {
    playHapticSound(soundEnabled, "close");
    setSearchQuery("");
  };

  return (
    <div className={`relative flex flex-col w-full select-none bg-slate-950 text-slate-100 font-sans ${isAdminPreview ? "h-[850px] rounded-3xl border border-cyan-500/20 shadow-2xl overflow-hidden" : "min-h-screen"}`}>
      
      {/* Fondo Aurora & Glow Kiosk */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-600/15 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[450px] h-[450px] rounded-full bg-purple-600/15 blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-blue-600/15 blur-[120px]" />
      </div>

      {/* BARRA SUPERIOR KIOSCO */}
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/30">
            <Tv size={26} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-2xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-300 to-purple-400">
                INFOSISTEL
              </span>
              <span className="rounded-full border border-cyan-500/40 bg-cyan-950/60 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-cyan-400">
                Catálogo Táctil
              </span>
            </div>
            <p className="text-xs text-slate-400">Toca para consultar productos, precios y stock en vivo</p>
          </div>
        </div>

        {/* Reloj y Controles Táctiles Rápidos */}
        <div className="flex items-center gap-3">
          {currentTime && (
            <div className="hidden md:flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-sm font-mono text-cyan-300 shadow-inner">
              <Clock size={16} className="text-cyan-400 animate-pulse" />
              <span>{currentTime}</span>
            </div>
          )}

          {/* Toggle Sonido Táctil */}
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              playHapticSound(next, "tap");
            }}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all active:scale-90 ${
              soundEnabled
                ? "border-cyan-500/40 bg-cyan-950/40 text-cyan-400 hover:bg-cyan-900/50"
                : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
            }`}
            title="Efectos de sonido táctiles"
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          {/* Botón Pantalla Completa */}
          {!isAdminPreview && (
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 rounded-2xl border border-cyan-500/50 bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition-all hover:brightness-110 active:scale-95"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              <span className="hidden sm:inline">{isFullscreen ? "Salir Completa" : "Pantalla Completa"}</span>
            </button>
          )}

          {/* Si está en Admin, enlace directo a pantalla completa pública */}
          {isAdminPreview && (
            <Link
              href="/catalogo"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-2xl border border-cyan-500/50 bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition-all hover:brightness-110 active:scale-95"
            >
              <ExternalLink size={18} />
              <span>Abrir en Pantalla Completa</span>
            </Link>
          )}
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        
        {/* BARRA DE BÚSQUEDA Y FILTROS TÁCTILES */}
        <div className="border-b border-slate-800/80 bg-slate-900/50 p-4 sm:p-6 backdrop-blur-md space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Input de búsqueda grande para dedos */}
            <div className="relative flex-1 min-w-[280px]">
              <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400" />
              <input
                type="text"
                placeholder="Toca para buscar por nombre, categoría o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => playHapticSound(soundEnabled, "key")}
                className="w-full h-14 rounded-2xl border border-slate-700 bg-slate-950/90 pl-13 pr-14 text-lg font-medium text-white placeholder-slate-500 shadow-inner focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    playHapticSound(soundEnabled, "close");
                    setSearchQuery("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Botón Desplegar Teclado Virtual en Pantalla */}
            <button
              onClick={() => {
                const next = !showVirtualKeyboard;
                setShowVirtualKeyboard(next);
                playHapticSound(soundEnabled, next ? "open" : "close");
              }}
              className={`flex h-14 items-center gap-2 rounded-2xl border px-5 text-sm font-bold transition-all active:scale-95 ${
                showVirtualKeyboard
                  ? "border-cyan-400 bg-cyan-950/80 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                  : "border-slate-700 bg-slate-800/90 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span>⌨️ Teclado Táctil</span>
            </button>

            {/* Alternador de Vista (Grid vs Showcase) */}
            <div className="flex rounded-2xl border border-slate-800 bg-slate-950 p-1">
              <button
                onClick={() => {
                  setViewMode("grid");
                  playHapticSound(soundEnabled, "tap");
                }}
                className={`flex h-12 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-all ${
                  viewMode === "grid" ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30" : "text-slate-400 hover:text-white"
                }`}
              >
                <LayoutGrid size={18} />
                <span className="hidden sm:inline">Cuadrícula</span>
              </button>
              <button
                onClick={() => {
                  setViewMode("showcase");
                  playHapticSound(soundEnabled, "tap");
                }}
                className={`flex h-12 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-all ${
                  viewMode === "showcase" ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30" : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers size={18} />
                <span className="hidden sm:inline">Expositor 3D</span>
              </button>
            </div>
          </div>

          {/* TECLADO VIRTUAL TÁCTIL EN PANTALLA (Plegable) */}
          {showVirtualKeyboard && (
            <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="space-y-2">
                {keyboardRows.map((row, rIdx) => (
                  <div key={rIdx} className="flex justify-center gap-1.5 sm:gap-2">
                    {row.map((char) => (
                      <button
                        key={char}
                        onClick={() => handleVirtualKey(char)}
                        className="flex h-12 w-9 sm:h-14 sm:w-14 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-base sm:text-lg font-bold text-white shadow-md transition-transform hover:bg-cyan-900/40 hover:border-cyan-500 active:scale-90"
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                ))}

                {/* Fila Especial: Espacio, Borrar, Limpiar */}
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    onClick={handleVirtualClear}
                    className="flex h-12 sm:h-14 px-4 items-center justify-center rounded-xl border border-red-500/40 bg-red-950/40 text-xs sm:text-sm font-bold text-red-300 hover:bg-red-900/60 active:scale-95"
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={handleVirtualSpace}
                    className="flex h-12 sm:h-14 flex-1 max-w-xs sm:max-w-md items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-sm font-bold text-slate-300 hover:border-cyan-500 active:scale-95"
                  >
                    ESPACIO
                  </button>
                  <button
                    onClick={handleVirtualBackspace}
                    className="flex h-12 sm:h-14 px-4 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-950/40 text-xs sm:text-sm font-bold text-amber-300 hover:bg-amber-900/60 active:scale-95"
                  >
                    ⌫ Borrar
                  </button>
                  <button
                    onClick={() => setShowVirtualKeyboard(false)}
                    className="flex h-12 sm:h-14 px-4 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-xs sm:text-sm font-bold text-slate-400 hover:text-white active:scale-95"
                  >
                    Ocultar ✕
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FILTROS RÁPIDOS Y CATEGORÍAS TÁCTILES */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            
            {/* Filtros Especiales */}
            <button
              onClick={() => {
                setFilterType("all");
                playHapticSound(soundEnabled, "tap");
              }}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                filterType === "all"
                  ? "border-cyan-400 bg-cyan-950/80 text-cyan-300 shadow-md shadow-cyan-500/20"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              <span>Todos ({products.length})</span>
            </button>

            <button
              onClick={() => {
                setFilterType(filterType === "featured" ? "all" : "featured");
                playHapticSound(soundEnabled, "tap");
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-2xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                filterType === "featured"
                  ? "border-amber-400 bg-amber-950/80 text-amber-300 shadow-md shadow-amber-500/20"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles size={14} className="text-amber-400" />
              <span>Destacados</span>
            </button>

            <button
              onClick={() => {
                setFilterType(filterType === "onsale" ? "all" : "onsale");
                playHapticSound(soundEnabled, "tap");
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-2xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                filterType === "onsale"
                  ? "border-red-400 bg-red-950/80 text-red-300 shadow-md shadow-red-500/20"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              <Flame size={14} className="text-red-400" />
              <span>Ofertas</span>
            </button>

            <button
              onClick={() => {
                setFilterType(filterType === "instock" ? "all" : "instock");
                playHapticSound(soundEnabled, "tap");
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-2xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                filterType === "instock"
                  ? "border-emerald-400 bg-emerald-950/80 text-emerald-300 shadow-md shadow-emerald-500/20"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              <PackageCheck size={14} className="text-emerald-400" />
              <span>En Stock</span>
            </button>

            <div className="h-6 w-px bg-slate-800 shrink-0 mx-1" />

            {/* Chips de Categorías con Iconos */}
            {categories.map((cat) => {
              const isSelected = activeCategory.toUpperCase() === cat.name.toUpperCase();
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(isSelected ? "TODOS" : cat.name);
                    playHapticSound(soundEnabled, "tap");
                  }}
                  className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                    isSelected
                      ? "border-cyan-400 bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/30"
                      : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                  }`}
                >
                  <CategoryIcon category={cat.name} size={15} />
                  <span>{cat.name}</span>
                  <span className="rounded-full bg-slate-950/60 px-2 py-0.5 text-[10px] text-cyan-300">
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* LISTADO DE PRODUCTOS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredProducts.length === 0 ? (
            <div className="flex h-96 flex-col items-center justify-center text-center p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-slate-500 border border-slate-800 mb-4">
                <Search size={36} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No se encontraron productos</h3>
              <p className="text-sm text-slate-400 max-w-md mb-6">
                Prueba con otro término de búsqueda o selecciona otra categoría en la barra superior.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("TODOS");
                  setFilterType("all");
                  playHapticSound(soundEnabled, "close");
                }}
                className="rounded-2xl border border-cyan-500/40 bg-cyan-950/60 px-6 py-3 font-bold text-cyan-400 hover:bg-cyan-900/60"
              >
                Restablecer Filtros
              </button>
            </div>
          ) : viewMode === "grid" ? (
            /* VISTA CUADRÍCULA TÁCTIL (GRID TOUCH) */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
              {filteredProducts.map((p) => {
                const finalPrice = p.onSale && p.salePrice ? p.salePrice : p.price;
                const discount = p.onSale && p.salePrice ? Math.round(((p.price - p.salePrice) / p.price) * 100) : 0;
                const inCart = cart.find((i) => i.product.id === p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setDetailProduct(p);
                      playHapticSound(soundEnabled, "open");
                    }}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/70 p-4 transition-all hover:border-cyan-500/60 hover:bg-slate-900 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] active:scale-[0.98] cursor-pointer"
                  >
                    {/* Badges superiores */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="rounded-xl border border-slate-700/60 bg-slate-950/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                        {p.category}
                      </span>
                      {p.onSale && discount > 0 && (
                        <span className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-2.5 py-1 text-[11px] font-black uppercase text-white shadow-sm">
                          <Flame size={12} /> -{discount}%
                        </span>
                      )}
                      {p.isFeatured && !p.onSale && (
                        <span className="flex items-center gap-1 rounded-xl bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-black text-amber-300">
                          <Sparkles size={11} /> TOP
                        </span>
                      )}
                    </div>

                    {/* Foto del Producto Grande */}
                    <div className="relative my-2 flex h-48 w-full items-center justify-center rounded-2xl bg-slate-950/80 p-2 overflow-hidden border border-slate-800/50">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-600">
                          <CategoryIcon category={p.category} size={48} />
                          <span className="text-[11px] mt-1 text-slate-500">INFOSISTEL</span>
                        </div>
                      )}

                      {/* Stock Pill Flotante */}
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-xl bg-slate-950/90 border border-slate-800 px-2.5 py-1 text-[10px] font-bold">
                        <span className={`h-2 w-2 rounded-full ${p.stock > 0 ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                        <span className={p.stock > 0 ? "text-emerald-300" : "text-red-400"}>
                          {p.stock > 0 ? `${p.stock} disponibles` : "Sin stock"}
                        </span>
                      </div>
                    </div>

                    {/* Nombre y Código */}
                    <div className="space-y-1 mb-3">
                      <div className="text-[11px] font-mono text-slate-500">Cód: INF-{p.itemNumber}</div>
                      <h4 className="font-bold text-base text-white line-clamp-2 leading-snug group-hover:text-cyan-300 transition-colors">
                        {p.name}
                      </h4>
                    </div>

                    {/* Precio y Botón de Cotizar */}
                    <div className="mt-auto pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div>
                        {p.onSale && p.salePrice && (
                          <div className="text-xs text-slate-500 line-through">
                            S/ {p.price.toFixed(2)}
                          </div>
                        )}
                        <div className="font-black text-xl text-cyan-400">
                          S/ {finalPrice.toFixed(2)}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (p.stock > 0) addToCart(p);
                        }}
                        disabled={p.stock <= 0}
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all active:scale-90 ${
                          p.stock <= 0
                            ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                            : inCart
                            ? "border-emerald-500 bg-emerald-950/60 text-emerald-400 shadow-md shadow-emerald-500/20"
                            : "border-cyan-500/50 bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:brightness-110"
                        }`}
                        title="Agregar a mi lista de cotización"
                      >
                        {inCart ? <CheckCircle2 size={20} /> : <Plus size={22} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VISTA EXPOSITOR 3D SHOWCASE (Para grandes pantallas) */
            <div className="flex flex-col items-center justify-center min-h-[500px] p-6">
              {filteredProducts[0] && (
                <div className="relative w-full max-w-4xl rounded-3xl border border-cyan-500/30 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    
                    {/* Visualizador de imagen grande */}
                    <div className="relative flex h-80 w-full items-center justify-center rounded-3xl bg-slate-950 p-6 border border-slate-800 overflow-hidden">
                      {filteredProducts[0].image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={filteredProducts[0].image}
                          alt={filteredProducts[0].name}
                          className="h-full w-full object-contain animate-in zoom-in-95 duration-300"
                        />
                      ) : (
                        <CategoryIcon category={filteredProducts[0].category} size={90} className="text-slate-600" />
                      )}
                      <div className="absolute top-4 left-4 rounded-xl bg-cyan-950/80 border border-cyan-500/40 px-3 py-1 text-xs font-bold text-cyan-400">
                        {filteredProducts[0].category}
                      </div>
                    </div>

                    {/* Especificaciones y acciones */}
                    <div className="space-y-4">
                      <div className="text-xs font-mono text-cyan-400">CÓDIGO: INF-{filteredProducts[0].itemNumber}</div>
                      <h2 className="font-extrabold text-3xl text-white tracking-tight">
                        {filteredProducts[0].name}
                      </h2>
                      <p className="text-sm text-slate-300 leading-relaxed line-clamp-4">
                        {filteredProducts[0].description}
                      </p>

                      <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-400">Precio de Lista:</div>
                          <div className="font-black text-3xl text-cyan-400">
                            S/ {(filteredProducts[0].onSale && filteredProducts[0].salePrice ? filteredProducts[0].salePrice : filteredProducts[0].price).toFixed(2)}
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setDetailProduct(filteredProducts[0]);
                              playHapticSound(soundEnabled, "open");
                            }}
                            className="rounded-2xl border border-slate-700 bg-slate-800 px-5 py-3 font-bold text-white hover:bg-slate-700"
                          >
                            Ver Ficha
                          </button>
                          <button
                            onClick={() => addToCart(filteredProducts[0])}
                            className="rounded-2xl border border-cyan-500 bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-500/30"
                          >
                            Añadir a Cotización
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOTÓN FLOTANTE DE MI COTIZACIÓN / CARRITO TÁCTIL */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => {
            setIsCartOpen(true);
            playHapticSound(soundEnabled, "open");
          }}
          className="relative flex items-center gap-3 rounded-3xl border border-cyan-400 bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 px-6 py-4 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all hover:scale-105 active:scale-95"
        >
          <div className="relative">
            <ShoppingBag size={24} />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-black text-white">
                {cartCount}
              </span>
            )}
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold opacity-90">Mi Cotización Táctil</div>
            <div className="text-lg font-black leading-tight">S/ {cartTotal.toFixed(2)}</div>
          </div>
        </button>
      </div>

      {/* MODAL DETALLE DE PRODUCTO GIGANTE (TOUCH DETAIL MODAL) */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-cyan-500/30 bg-slate-950 p-6 sm:p-8 shadow-2xl">
            
            {/* Botón Cerrar */}
            <button
              onClick={() => {
                setDetailProduct(null);
                playHapticSound(soundEnabled, "close");
              }}
              className="absolute right-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white active:scale-90"
            >
              <X size={24} />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto pr-2">
              
              {/* Imagen y Código QR al celular */}
              <div className="space-y-4">
                <div className="relative flex h-72 sm:h-80 w-full items-center justify-center rounded-3xl bg-slate-900/90 border border-slate-800 p-4">
                  {detailProduct.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={detailProduct.image}
                      alt={detailProduct.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <CategoryIcon category={detailProduct.category} size={80} className="text-slate-600" />
                  )}
                </div>

                {/* Código QR interactivo para escanear con smartphone */}
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/30 p-4 flex items-center gap-4">
                  {productQrDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productQrDataUrl}
                      alt="Código QR del producto"
                      className="h-24 w-24 rounded-xl border border-slate-700 bg-white p-1"
                    />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                      <QrCode size={15} />
                      <span>¡LLÉVATELO EN TU CELULAR!</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-snug">
                      Escanea este código QR con la cámara de tu teléfono para abrir el chat de WhatsApp con Infosistel y solicitar este producto.
                    </p>
                  </div>
                </div>
              </div>

              {/* Ficha Técnica y Controles */}
              <div className="flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-xl border border-cyan-500/40 bg-cyan-950 px-3 py-1 text-xs font-bold text-cyan-400 uppercase">
                      {detailProduct.category}
                    </span>
                    <span className="text-xs font-mono text-slate-500">Cód: INF-{detailProduct.itemNumber}</span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-4">
                    {detailProduct.name}
                  </h2>

                  <div className="mb-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Descripción y Especificaciones:
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200 leading-relaxed max-h-40 overflow-y-auto">
                      {detailProduct.description || "Producto garantizado por el equipo técnico de INFOSISTEL."}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${detailProduct.stock > 0 ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
                    <span className="text-sm font-bold text-slate-200">
                      {detailProduct.stock > 0 ? `Stock en tienda: ${detailProduct.stock} unidades listas` : "Temporalmente agotado"}
                    </span>
                  </div>
                </div>

                {/* Precio y Botón Agregar */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Precio de Venta:</div>
                    <div className="text-3xl sm:text-4xl font-black text-cyan-400">
                      S/ {(detailProduct.onSale && detailProduct.salePrice ? detailProduct.salePrice : detailProduct.price).toFixed(2)}
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
                    className="rounded-2xl border border-cyan-500 bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 font-bold text-white shadow-lg shadow-cyan-500/30 hover:brightness-110 active:scale-95"
                  >
                    + Añadir a Cotización
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL DE COTIZACIÓN KIOSCO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative flex h-full w-full max-w-lg flex-col border-l border-cyan-500/30 bg-slate-950 p-6 shadow-2xl">
            
            {/* Header Drawer */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Mi Cotización Táctil</h3>
                  <p className="text-xs text-slate-400">{cart.length} productos agregados</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  playHapticSound(soundEnabled, "close");
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Lista de productos */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {cart.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-center">
                  <ShoppingBag size={40} className="text-slate-700 mb-2" />
                  <p className="text-sm text-slate-400">Aún no has agregado productos a tu cotización.</p>
                </div>
              ) : (
                cart.map((item) => {
                  const p = item.product.onSale && item.product.salePrice ? item.product.salePrice : item.product.price;
                  return (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-950 border border-slate-800 p-1">
                          {item.product.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.product.image} alt={item.product.name} className="h-full w-full object-contain" />
                          ) : (
                            <CategoryIcon category={item.product.category} size={20} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-white truncate">{item.product.name}</div>
                          <div className="text-xs text-cyan-400 font-semibold">S/ {p.toFixed(2)} c/u</div>
                        </div>
                      </div>

                      {/* Controles de Cantidad Grandes para Dedos */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-300 active:scale-90"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-bold text-sm text-white w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-900/50 border border-cyan-700 text-cyan-300 active:scale-90"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-950/40 border border-red-800/40 text-red-400 hover:text-red-300 ml-1 active:scale-90"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Ticket QR Generado */}
              {quoteTicketQr && (
                <div className="rounded-3xl border border-emerald-500/40 bg-emerald-950/30 p-5 text-center space-y-3 animate-in zoom-in-95 duration-200">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    ¡Ticket de Cotización Listo!
                  </div>
                  <div className="font-mono text-2xl font-black text-white">#{ticketNumber}</div>
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={quoteTicketQr} alt="QR Cotización" className="h-44 w-44 rounded-2xl border border-slate-700 bg-white p-2 shadow-lg" />
                  </div>
                  <p className="text-xs text-slate-300">
                    Escanea con tu celular o muestra este código en caja para obtener tu pedido al instante.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Drawer con Totales */}
            {cart.length > 0 && (
              <div className="border-t border-slate-800 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold text-sm">TOTAL A PAGAR:</span>
                  <span className="font-black text-2xl text-cyan-400">S/ {cartTotal.toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={clearCart}
                    className="rounded-2xl border border-slate-800 bg-slate-900 py-3.5 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Vaciar Lista
                  </button>
                  <button
                    onClick={handleGenerateTicket}
                    className="rounded-2xl border border-cyan-500 bg-gradient-to-r from-cyan-600 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 active:scale-95"
                  >
                    Generar Ticket QR
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SALVAPANTALLAS / MODO ATRACCIÓN (ATTRACT LOOP TRAS 60S INACTIVO) */}
      {isScreensaverActive && (
        <div
          onClick={resetIdleTimer}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 cursor-pointer backdrop-blur-2xl animate-in fade-in duration-500"
        >
          {/* Halos Aurora Flotantes */}
          <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-cyan-500/20 blur-[130px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500/20 blur-[130px] animate-pulse" />

          <div className="relative z-10 flex flex-col items-center text-center p-8 max-w-2xl space-y-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-[0_0_50px_rgba(6,182,212,0.6)] animate-bounce">
              <Tv size={48} />
            </div>

            <div className="space-y-2">
              <div className="rounded-full border border-cyan-500/50 bg-cyan-950/80 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-cyan-300">
                PANTALLA TÁCTIL INTERACTIVA
              </div>
              <h1 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-300 to-purple-400 tracking-tight">
                INFOSISTEL
              </h1>
              <p className="text-xl sm:text-2xl font-bold text-slate-200">
                Toca cualquier lugar de la pantalla para explorar
              </p>
            </div>

            {/* Muestra del producto destacado rotativo */}
            {products[screensaverIndex] && (
              <div className="flex items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl max-w-md w-full">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-950 p-2 border border-slate-800">
                  {products[screensaverIndex].image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={products[screensaverIndex].image} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <CategoryIcon category={products[screensaverIndex].category} size={28} />
                  )}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-cyan-400 uppercase">{products[screensaverIndex].category}</div>
                  <div className="font-bold text-sm text-white truncate">{products[screensaverIndex].name}</div>
                  <div className="font-black text-lg text-emerald-400">
                    S/ {(products[screensaverIndex].onSale && products[screensaverIndex].salePrice ? products[screensaverIndex].salePrice : products[screensaverIndex].price).toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-cyan-400 animate-pulse pt-4">
              <span>👉 Toca la pantalla para comenzar</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
