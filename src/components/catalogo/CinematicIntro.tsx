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
  Zap,
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
 * Entrada Cinemática Épica estilo Video Trailer / Cyber Kiosk
 * Renderiza un motor de partículas 3D interactivo en Canvas a 60 FPS,
 * el logo oficial en BLANCO PURO con resplandor anamórfico,
 * escaneo láser holográfico y HUD cinematográfico.
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

  // Productos destacados en la rotación tipo trailer
  const showreelItems = [
    { title: "Mouse Logitech G502 HERO RGB", sub: "Sensor HERO 25K · 11 botones · S/ 169.00", icon: "🖱️" },
    { title: "Teclado Mecánico Redragon Kumara K552", sub: "Switches Outemu Red · Anti-Ghosting · S/ 149.00", icon: "⌨️" },
    { title: "Laptop Lenovo IdeaPad Slim 3", sub: "Ryzen 5 · 16GB RAM · 512GB SSD · S/ 1,999.00", icon: "💻" },
    { title: "Monitor Gamer 24\" 165Hz IPS", sub: "1ms MPRT · FreeSync Premium · S/ 589.00", icon: "🖥️" },
  ];

  // Rotar showreel cada 2.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveShowreelIndex((prev) => (prev + 1) % showreelItems.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [showreelItems.length]);

  // Manejador de entrada con efecto cinemático
  const handleLaunch = useCallback(
    (targetCategory?: string) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setTimeout(() => {
        onEnter(targetCategory);
      }, 350);
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

  // MOTOR DE VIDEO / PARTICULAS EN CANVAS A 60 FPS
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

    // Sistema de estrellas y partículas cibernéticas
    interface Particle {
      x: number;
      y: number;
      z: number;
      size: number;
      speed: number;
      color: string;
      alpha: number;
    }

    const particles: Particle[] = [];
    const particleCount = Math.min(140, Math.floor((width * height) / 10000));
    const colors = ["#ffffff", "#38bdf8", "#06b6d4", "#a855f7", "#60a5fa"];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: (Math.random() - 0.5) * width * 1.5,
        y: (Math.random() - 0.5) * height * 1.5,
        z: Math.random() * width,
        size: Math.random() * 2 + 0.8,
        speed: Math.random() * 1.2 + 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.8 + 0.2,
      });
    }

    let scanY = 0;
    let scanDirection = 1;
    let time = 0;

    // Render loop a 60 FPS
    const render = () => {
      time += 0.016;
      ctx.fillStyle = "rgba(2, 6, 23, 0.25)";
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // 1. DIBUJAR ESTRELLAS / PARTICULAS HIPERESPACIALES
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.z -= p.speed * 1.5;

        if (p.z <= 0) {
          p.z = width;
          p.x = (Math.random() - 0.5) * width * 1.5;
          p.y = (Math.random() - 0.5) * height * 1.5;
        }

        const k = 250 / p.z;
        const px = p.x * k + cx;
        const py = p.y * k + cy;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const size = Math.max(0.6, (1 - p.z / width) * p.size * 2.5);
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.min(1, (1 - p.z / width) * p.alpha);
          ctx.fill();

          // Destello en partículas cercanas
          if (size > 2.2) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
          } else {
            ctx.shadowBlur = 0;
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // 2. REJILLA CIBERNÉTICA DE FONDO (Cyber Grid)
      ctx.strokeStyle = "rgba(6, 182, 212, 0.06)";
      ctx.lineWidth = 1;
      const gridSpacing = 60;
      const gridOffset = (time * 20) % gridSpacing;

      for (let x = 0; x < width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = gridOffset; y < height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. LÁSER DE ESCANEO HOLOGRÁFICO HORIZONTAL
      scanY += scanDirection * (height / 220);
      if (scanY > height) {
        scanY = height;
        scanDirection = -1;
      } else if (scanY < 0) {
        scanY = 0;
        scanDirection = 1;
      }

      const laserGrad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
      laserGrad.addColorStop(0, "rgba(6, 182, 212, 0)");
      laserGrad.addColorStop(0.5, "rgba(56, 189, 248, 0.2)");
      laserGrad.addColorStop(1, "rgba(6, 182, 212, 0)");
      ctx.fillStyle = laserGrad;
      ctx.fillRect(0, scanY - 30, width, 60);

      // Línea central ultra brillante del láser
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(width, scanY);
      ctx.stroke();

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
      className={`fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-slate-950 text-white select-none transition-all duration-500 cursor-pointer ${
        isTransitioning ? "opacity-0 scale-105" : "opacity-100 scale-100"
      }`}
    >
      {/* CANVAS MOTOR 60FPS DE VIDEO / PARTICULAS */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* OVERLAY DE SCANLINES ESTILO PANTALLA OLED / CRT DE CINE */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))",
          backgroundSize: "100% 3px, 6px 100%",
        }}
      />

      {/* AURORAS DE LUZ CÓSMICA */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full bg-cyan-500/15 blur-[120px] animate-pulse" />
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[250px] rounded-full bg-blue-600/10 blur-[140px]" />
      </div>

      {/* ======================================================== */}
      {/* HUD SUPERIOR CINEMÁTICO (Telemetría de Kiosco)           */}
      {/* ======================================================== */}
      <div className="relative z-20 flex items-center justify-between p-4 sm:p-6 text-[10px] sm:text-xs font-mono tracking-widest text-slate-400">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="font-bold text-slate-200">● REC 4K 60FPS</span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden sm:inline text-cyan-400">INFOSISTEL INTERACTIVE OS</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-slate-400">
            <Zap size={13} className="text-amber-400" />
            <span>TERMINAL TIENDA ONLINE</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSound();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-slate-300 hover:text-white hover:border-cyan-500/50 active:scale-95 transition-all"
          >
            {soundEnabled ? (
              <>
                <Volume2 size={13} className="text-cyan-400" />
                <span className="text-[10px] hidden xs:inline">AUDIO ON</span>
              </>
            ) : (
              <>
                <VolumeX size={13} className="text-slate-500" />
                <span className="text-[10px] hidden xs:inline">MUTE</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* CUERPO CENTRAL: LOGO OFICIAL EN BLANCO PURO RADIANTE    */}
      {/* ======================================================== */}
      <div className="relative z-20 flex flex-1 flex-col items-center justify-center px-4 text-center my-auto">
        
        {/* Lente Anamórfico de Cine (Línea de luz horizontal pura) */}
        <div className="relative flex items-center justify-center w-full max-w-2xl">
          <div className="absolute h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent blur-[1px] opacity-80 animate-pulse" />
          <div className="absolute h-[6px] w-2/3 bg-gradient-to-r from-transparent via-white to-transparent blur-[4px] opacity-90" />
        </div>

        {/* CONTENEDOR DEL LOGO EN BLANCO PURO */}
        <div className="relative my-4 sm:my-6 group">
          {/* Halo de resplandor blanco puro y cian */}
          <div className="absolute -inset-8 rounded-full bg-white/20 blur-[50px] opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <div className="absolute -inset-12 rounded-full bg-cyan-400/25 blur-[90px] opacity-60 pointer-events-none" />

          {/* Brillo de barrido de luz láser sobre el logo */}
          <div className="relative overflow-hidden p-2 sm:p-4 rounded-3xl">
            {/* EL LOGO OFICIAL CON FILTRO BLANCO PURO */}
            <Image
              src="/brand/infosistel-logo-v3.png"
              alt="INFOSISTEL"
              width={560}
              height={100}
              priority
              className="relative h-14 xs:h-18 sm:h-24 md:h-32 lg:h-36 w-auto object-contain transition-all duration-300 transform group-hover:scale-105"
              style={{
                // Blanco Puro (#FFFFFF) + Sombra de luz radiante blanca de alta tecnología
                filter:
                  "brightness(0) invert(1) drop-shadow(0 0 25px rgba(255, 255, 255, 1)) drop-shadow(0 0 55px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 100px rgba(6, 182, 212, 0.5))",
              }}
            />

            {/* Efecto de reflejo metálico / destello de luz que pasa de izquierda a derecha */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay"
              style={{
                background:
                  "linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.8) 50%, transparent 80%)",
                animation: "shimmerSweep 3.5s infinite linear",
              }}
            />
          </div>
        </div>

        {/* Lente Anamórfico inferior */}
        <div className="relative flex items-center justify-center w-full max-w-xl mb-4 sm:mb-6">
          <div className="absolute h-[1.5px] w-full bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent blur-[1px]" />
        </div>

        {/* Saludo y Lemas Oficiales */}
        <div className="space-y-2 sm:space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs sm:text-sm font-bold text-white shadow-xl backdrop-blur-md">
            <span>{greetingIcon}</span>
            <span className="tracking-wide font-extrabold">{greetingText}</span>
            <span className="text-cyan-400">· HUANCAYO, PERÚ</span>
          </div>

          <h2 className="text-xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight text-white leading-tight">
            Tecnología · Sistemas · Servicio Técnico
          </h2>

          <p className="text-xs sm:text-sm md:text-base text-slate-300 max-w-lg mx-auto leading-relaxed font-medium">
            Catálogo Interactivo Kiosco en Vivo. Toca la pantalla para consultar stock, características y precios oficiales.
          </p>
        </div>

        {/* SHOWREEL TIPO TRAILER DE PRODUCTOS */}
        <div className="w-full max-w-md my-4 sm:my-6">
          <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-3 sm:p-3.5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl sm:text-3xl animate-bounce">
                {showreelItems[activeShowreelIndex].icon}
              </span>
              <div className="text-left min-w-0 flex-1">
                <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                  EN EXHIBICIÓN HOY:
                </div>
                <div className="text-xs sm:text-sm font-black text-white truncate">
                  {showreelItems[activeShowreelIndex].title}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {showreelItems[activeShowreelIndex].sub}
                </div>
              </div>
              <Sparkles size={16} className="text-amber-400 animate-pulse shrink-0" />
            </div>
          </div>
        </div>

        {/* ACCESOS DIRECTOS A CATEGORÍAS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full max-w-2xl mb-4 sm:mb-6">
          {[
            { name: "MOUSE", label: "Mouses & Ópticos", icon: Mouse },
            { name: "TECLADOS", label: "Teclados Mecánicos", icon: Keyboard },
            { name: "LAPTOPS", label: "Laptops & PCs", icon: Laptop },
            { name: "MONITORES", label: "Monitores 165Hz", icon: Monitor },
          ].map((cat) => (
            <button
              key={cat.name}
              onClick={(e) => {
                e.stopPropagation();
                handleLaunch(cat.name);
              }}
              className="flex items-center justify-center gap-2 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-white/10 bg-slate-900/60 hover:border-cyan-400 hover:bg-slate-900 transition-all active:scale-95 group shadow-lg backdrop-blur-md"
            >
              <cat.icon size={18} className="text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-white group-hover:text-cyan-300">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* BOTÓN MASTER: ENTRAR AL CATÁLOGO INTERACTIVO */}
        <div className="w-full max-w-md">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLaunch();
            }}
            className="relative w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 px-6 py-4 sm:py-5 text-sm sm:text-base font-black text-white shadow-[0_0_35px_rgba(6,182,212,0.4)] hover:shadow-[0_0_55px_rgba(6,182,212,0.6)] active:scale-95 transition-all group overflow-hidden border border-cyan-400/50"
          >
            {/* Onda de luz en el botón */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            <Hand size={22} className="animate-bounce text-cyan-200" />
            <span className="tracking-wide">TOCAR PARA ENTRAR AL CATÁLOGO</span>
            <ChevronRight size={22} className="group-hover:translate-x-1.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* HUD INFERIOR CINEMÁTICO (Barra de progreso de video)     */}
      {/* ======================================================== */}
      <div className="relative z-20 flex flex-col items-center justify-center p-3 sm:p-5 text-[10px] sm:text-xs text-slate-400 space-y-1.5">
        <div className="flex items-center gap-2 font-mono">
          <span>ENTRADA AUTOMÁTICA EN</span>
          <span className="font-bold text-cyan-400">{countdown}s</span>
          <span>· TOCA EN CUALQUIER LUGAR</span>
        </div>

        <div className="h-1.5 w-48 sm:w-64 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/60">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${(countdown / autoEnterSeconds) * 100}%` }}
          />
        </div>
      </div>

      {/* Estilos para animación de barrido de luz shimmerSweep */}
      <style jsx>{`
        @keyframes shimmerSweep {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </div>
  );
}
