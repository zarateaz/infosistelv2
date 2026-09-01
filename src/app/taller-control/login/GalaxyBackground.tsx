"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Particle {
  angle: number; // position around the center, radians
  radius: number; // distance from center, px
  branchOffset: number; // which spiral arm + how far off it
  size: number;
  baseAlpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
  hue: "core" | "accent" | "faint"; // which color stop this particle uses
}

const BRANCHES = 4;
const PARTICLE_COUNT_DESKTOP = 2200;
const PARTICLE_COUNT_MOBILE = 900; // fewer on small/low-power screens

/** Full-screen animated "galaxy" for the admin login — canvas-only, no
 *  Three.js/WebGL: this page has to stay fast and reliable (it's the
 *  gate to the whole admin panel), and a 2D canvas particle field gets
 *  95% of the visual drama of a WebGL galaxy generator for a fraction of
 *  the bundle weight and zero new dependencies. Same spiral-arm math
 *  idea as the classic Three.js galaxy tutorial (power-curved radius for
 *  a dense core that thins out, branch angle + randomness offset) but
 *  projected straight to 2D, tinted in a cyberpunk neon palette (magenta
 *  core, cyan + violet arms) per the user's request. */
export function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let rafId = 0;
    let rotation = 0;

    function buildParticles() {
      const count = width < 768 ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
      const maxRadius = Math.hypot(width, height) * 0.62;
      particles = Array.from({ length: count }, () => {
        // Power curve concentrates particles near the center, thinning
        // out toward the edge — the same trick that gives the reference
        // galaxy its bright, dense core.
        const radius = Math.pow(Math.random(), 2.1) * maxRadius;
        const branch = (Math.floor(Math.random() * BRANCHES) / BRANCHES) * Math.PI * 2;
        const spin = radius * 0.0022; // spiral twist — grows with distance
        const branchOffset = (Math.random() - 0.5) * (0.55 - Math.min(radius / maxRadius, 1) * 0.3);
        const rand = () => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? -1 : 1) * (radius * 0.18 + 6);

        return {
          angle: branch + spin + branchOffset + rand() * 0.01,
          radius,
          branchOffset: 0,
          size: Math.random() * 1.6 + 0.4,
          baseAlpha: 1 - (radius / maxRadius) * 0.7,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.5 + Math.random() * 1.2,
          hue: radius < maxRadius * 0.12 ? "core" : Math.random() < 0.55 ? "accent" : "faint",
        };
      });
    }

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles();
    }

    function colorFor(hue: Particle["hue"], alpha: number): string {
      if (hue === "core") return `rgba(255, 214, 250, ${alpha})`; // hot near-white magenta
      if (hue === "accent") return `rgba(0, 229, 255, ${alpha})`; // neon cyan
      return `rgba(180, 70, 255, ${alpha})`; // neon violet, dimmer
    }

    function draw(time: number) {
      ctx!.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height * 0.38;

      // Two overlapping glows — magenta core, cyan halo — for a bi-color
      // neon nebula instead of a flat single-hue glow.
      const magentaGlow = ctx!.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) * 0.38);
      magentaGlow.addColorStop(0, "rgba(255, 0, 200, 0.45)");
      magentaGlow.addColorStop(0.45, "rgba(200, 0, 220, 0.18)");
      magentaGlow.addColorStop(1, "rgba(200, 0, 220, 0)");
      ctx!.fillStyle = magentaGlow;
      ctx!.fillRect(0, 0, width, height);

      const cyanGlow = ctx!.createRadialGradient(
        cx - width * 0.1,
        cy + height * 0.12,
        0,
        cx - width * 0.1,
        cy + height * 0.12,
        Math.min(width, height) * 0.5,
      );
      cyanGlow.addColorStop(0, "rgba(0, 229, 255, 0.22)");
      cyanGlow.addColorStop(1, "rgba(0, 229, 255, 0)");
      ctx!.fillStyle = cyanGlow;
      ctx!.fillRect(0, 0, width, height);

      for (const p of particles) {
        const t = time / 1000;
        const a = p.angle + rotation;
        const x = cx + Math.cos(a) * p.radius;
        const y = cy + Math.sin(a) * p.radius * 0.55; // flatten into an ellipse — a "tilted disc" read
        const twinkle = reducedMotion ? 1 : 0.55 + 0.45 * Math.sin(t * p.twinkleSpeed + p.twinklePhase);
        const alpha = p.baseAlpha * twinkle;
        if (alpha <= 0.02) continue;

        const color = colorFor(p.hue, alpha);
        if (p.hue === "core") {
          ctx!.shadowBlur = 6;
          ctx!.shadowColor = color;
        }
        ctx!.beginPath();
        ctx!.fillStyle = color;
        ctx!.arc(x, y, p.size, 0, Math.PI * 2);
        ctx!.fill();
        if (p.hue === "core") ctx!.shadowBlur = 0;
      }

      if (!reducedMotion) rotation += 0.00006;
      rafId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    rafId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
