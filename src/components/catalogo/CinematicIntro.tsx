"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import {
  Hand,
  ChevronRight,
  Mouse,
  Keyboard,
  Laptop,
  Monitor,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

interface CinematicIntroProps {
  onEnter: (category?: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  greetingText: string;
  greetingIcon: string;
  autoEnterSeconds?: number;
}

/**
 * Entrada Profesional de Tienda en Blanco Puro (Apple Store / Showroom Luxury Aesthetic)
 * Diseño humano, limpio, sin tropos oscuros de IA, con el logo oficial de INFOSISTEL
 * en su máxima resolución sobre blanco inmaculado.
 */
export function CinematicIntro({
  onEnter,
  soundEnabled,
  onToggleSound,
  greetingText,
  greetingIcon,
  autoEnterSeconds = 8,
}: CinematicIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [countdown, setCountdown] = useState(autoEnterSeconds);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeShowreelIndex, setActiveShowreelIndex] = useState(0);

  // Productos destacados en la rotación de vitrina
  const showreelItems = [
    { title: "Mouse Logitech G502 HERO RGB", sub: "Sensor HERO 25K · 11 botones · S/ 169.00", icon: "🖱️" },
    { title: "Teclado Mecánico Redragon Kumara K552", sub: "Switches Outemu Red · Anti-Ghosting · S/ 149.00", icon: "⌨️" },
    { title: "Laptop Lenovo IdeaPad Slim 3 15.6\"", sub: "Ryzen 5 · 16GB RAM · 512GB SSD · S/ 1,999.00", icon: "💻" },
    { title: "Monitor Gamer 24\" 165Hz IPS 1ms", sub: "Panel Fast IPS · FreeSync Premium · S/ 589.00", icon: "🖥️" },
  ];

  // Rotar showreel cada 2.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveShowreelIndex((prev) => (prev + 1) % showreelItems.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [showreelItems.length]);

  // Manejador de entrada suave
  const handleLaunch = useCallback(
    (targetCategory?: string) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setTimeout(() => {
        onEnter(targetCategory);
      }, 300);
    },
    [isTransitioning, onEnter]
  );

  // Temporizador de entrada automática
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleLaunch();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [handleLaunch]);

  // Fondo animado sutil en Canvas (Luz fluida sobre blanco puro)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Partículas luminosas suaves en tonos platino y azul tenue
    interface LightPoint {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
    }

    const points: LightPoint[] = [];
    const count = 35;

    for (let i = 0; i < count; i++) {
      points.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.35 + 0.1,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Dibujar líneas de conexión sutiles entre puntos cercanos
      ctx.strokeStyle = "rgba(2, 132, 199, 0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx = points[i].x - points[j].x;
          const dy = points[i].y - points[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            ctx.beginPath();
            ctx.moveTo(points[i].x, points[i].y);
            ctx.lineTo(points[j].x, points[j].y);
            ctx.stroke();
          }
        }
      }

      // Actualizar y dibujar puntos
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(2, 132, 199, ${p.alpha})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      onClick={() => handleLaunch()}
      className={`fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-white text-slate-900 select-none transition-all duration-400 cursor-pointer ${
        isTransitioning ? "opacity-0 scale-98" : "opacity-100 scale-100"
      }`}
    >
      {/* CANVAS SUTIL DE FONDO (BLANCO PURO) */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* RESPLANDOR SUAVE DE LUZ DE ESTUDIO */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] rounded-full bg-blue-50/70 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[300px] rounded-full bg-slate-100/80 blur-[100px]" />
      </div>

      {/* ======================================================== */}
      {/* BARRA SUPERIOR DE BIENVENIDA                            */}
      {/* ======================================================== */}
      <div className="relative z-20 flex items-center justify-between p-4 sm:p-6 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-800">INFOSISTEL INTERACTIVO</span>
          <span className="text-slate-300">|</span>
          <span className="hidden sm:inline">HUANCAYO, PERÚ</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-slate-600 bg-slate-100/80 px-3 py-1 rounded-full text-[11px] font-semibold border border-slate-200/80">
            <ShieldCheck size={14} className="text-blue-600" />
            <span>Garantía Oficial & Soporte Técnico</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSound();
            }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 shadow-xs active:scale-95 transition-all"
          >
            {soundEnabled ? (
              <>
                <Volume2 size={14} className="text-blue-600" />
                <span className="text-[11px] font-bold">Audio</span>
              </>
            ) : (
              <>
                <VolumeX size={14} className="text-slate-400" />
                <span className="text-[11px] font-bold">Silenciado</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* CUERPO CENTRAL: LOGO OFICIAL LIMPIO EN BLANCO PURO      */}
      {/* ======================================================== */}
      <div className="relative z-20 flex flex-1 flex-col items-center justify-center px-4 text-center my-auto max-w-3xl mx-auto w-full">
        
        {/* LOGO OFICIAL DE INFOSISTEL EN ALTA RESOLUCIÓN */}
        <div className="relative my-4 sm:my-6 group">
          <div className="relative p-4 sm:p-6 rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-200/60 transition-transform duration-300 group-hover:scale-102">
            <Image
              src="/brand/infosistel-logo-v3.png"
              alt="INFOSISTEL"
              width={540}
              height={100}
              priority
              className="relative h-14 xs:h-18 sm:h-22 md:h-26 w-auto object-contain"
            />
          </div>
        </div>

        {/* Saludo y Títulos Profesionales */}
        <div className="space-y-2 sm:space-y-3 max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-xs sm:text-sm font-bold text-blue-800 shadow-xs">
            <span>{greetingIcon}</span>
            <span>{greetingText}</span>
            <span className="text-blue-500">· Catálogo en Tienda</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 leading-tight">
            Tecnología, Repuestos y Equipos
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-slate-600 max-w-lg mx-auto leading-relaxed">
            Explora precios en vivo, fichas técnicas y stock disponible en nuestra tienda. Toca la pantalla para comenzar.
          </p>
        </div>

        {/* VITRINA SHOWREEL ELEGANTE */}
        <div className="w-full max-w-md my-4 sm:my-5">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl sm:text-3xl">
                {showreelItems[activeShowreelIndex].icon}
              </span>
              <div className="text-left min-w-0 flex-1">
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  EN EXHIBICIÓN HOY
                </div>
                <div className="text-xs sm:text-sm font-black text-slate-900 truncate">
                  {showreelItems[activeShowreelIndex].title}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {showreelItems[activeShowreelIndex].sub}
                </div>
              </div>
              <Sparkles size={16} className="text-amber-500 shrink-0" />
            </div>
          </div>
        </div>

        {/* ACCESOS DIRECTOS A CATEGORÍAS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 w-full max-w-xl mb-5">
          {[
            { name: "MOUSE", label: "Mouses", icon: Mouse },
            { name: "TECLADOS", label: "Teclados", icon: Keyboard },
            { name: "LAPTOPS", label: "Laptops & PCs", icon: Laptop },
            { name: "MONITORES", label: "Monitores", icon: Monitor },
          ].map((cat) => (
            <button
              key={cat.name}
              onClick={(e) => {
                e.stopPropagation();
                handleLaunch(cat.name);
              }}
              className="flex items-center justify-center gap-2 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 bg-white hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-xs text-slate-800 transition-all active:scale-95 shadow-2xs font-bold text-xs"
            >
              <cat.icon size={16} className="text-blue-600" />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* BOTÓN MASTER: TOCAR PARA ENTRAR */}
        <div className="w-full max-w-md">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLaunch();
            }}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-4 sm:py-4.5 text-sm sm:text-base font-black text-white shadow-lg shadow-blue-500/25 active:scale-95 transition-all group"
          >
            <Hand size={20} className="text-blue-200 animate-bounce" />
            <span>TOCAR PARA ENTRAR AL CATÁLOGO</span>
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* BARRA INFERIOR DE PROGRESO                              */}
      {/* ======================================================== */}
      <div className="relative z-20 flex flex-col items-center justify-center p-4 text-xs text-slate-500 space-y-1.5">
        <div className="flex items-center gap-2 font-medium">
          <span>Entrada automática en</span>
          <span className="font-bold text-blue-600">{countdown}s</span>
          <span className="text-slate-300">·</span>
          <span>Toca cualquier parte de la pantalla</span>
        </div>

        <div className="h-1.5 w-48 sm:w-60 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className="h-full bg-blue-600 transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${(countdown / autoEnterSeconds) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
