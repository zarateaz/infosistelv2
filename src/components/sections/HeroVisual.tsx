"use client";

import { useEffect, useRef } from "react";
import { Laptop, Printer, Cpu } from "lucide-react";
import { gsap, registerGsap } from "@/lib/gsap/registerGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Chips stay fully inside the visual on narrow screens (base classes) and
// only spill outward from `sm:` up, once the hero has enough side padding
// to absorb it — the parent <section> in Hero.tsx is overflow-hidden, so
// on mobile the old fixed -6%/-4% offsets pushed "Impresoras" past that
// boundary and got its text hard-clipped instead of wrapping or shrinking.
const CHIPS = [
  { icon: Laptop, label: "Laptops", className: "left-[2%] top-[10%] sm:-left-[4%]" },
  { icon: Printer, label: "Impresoras", className: "right-[2%] top-[42%] sm:-right-[6%]" },
  { icon: Cpu, label: "PCs", className: "left-[4%] bottom-[8%]" },
];

const TILT_MAX_DEG = 9;

/**
 * Custom-built hero centerpiece — replaces a generic AI-rendered stock
 * shield image with something that's actually Infosistel's own: the
 * bicolor "IS" wordmark as a glowing emblem, a rotating conic-gradient
 * aura, two orbit rings carrying small glowing "satellites", a light
 * sweep across the emblem, a pointer-driven 3D tilt on the whole scene,
 * and three floating chips naming the exact hardware served (laptops,
 * impresoras, PCs) that pop in with a staggered entrance. Pure CSS/SVG/
 * GSAP — no image asset, no new dependency.
 */
export function HeroVisual() {
  const reducedMotion = useReducedMotion();
  const tiltRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);
  const ring2Ref = useRef<SVGSVGElement>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const coreRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion || !rootRef.current) return;
    registerGsap();

    const ctx = gsap.context(() => {
      gsap.to(auraRef.current, { rotate: 360, duration: 14, repeat: -1, ease: "none" });
      gsap.to(ringRef.current, { rotate: 360, duration: 50, repeat: -1, ease: "none" });
      gsap.to(ring2Ref.current, { rotate: -360, duration: 70, repeat: -1, ease: "none" });
      gsap.to(coreRef.current, {
        y: -10,
        duration: 3.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(sheenRef.current, {
        xPercent: 260,
        duration: 1.6,
        repeat: -1,
        repeatDelay: 2.8,
        ease: "power2.inOut",
      });

      const tl = gsap.timeline({ delay: 0.2 });
      tl.from(chipRefs.current, {
        scale: 0.5,
        opacity: 0,
        duration: 0.7,
        stagger: 0.16,
        ease: "back.out(1.8)",
      });
      chipRefs.current.forEach((el, i) => {
        if (!el) return;
        gsap.to(el, {
          y: i % 2 === 0 ? -12 : 12,
          duration: 3 + i * 0.7,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 1 + i * 0.35,
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reducedMotion || !tiltRef.current) return;
    const rect = tiltRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(rootRef.current, {
      rotateY: px * TILT_MAX_DEG,
      rotateX: -py * TILT_MAX_DEG,
      duration: 0.6,
      ease: "power2.out",
    });
  }

  function handlePointerLeave() {
    if (reducedMotion) return;
    gsap.to(rootRef.current, { rotateX: 0, rotateY: 0, duration: 0.9, ease: "elastic.out(1, 0.6)" });
  }

  return (
    <div
      ref={tiltRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative aspect-square w-full [perspective:1200px]"
    >
      <div
        ref={rootRef}
        className="relative h-full w-full [transform-style:preserve-3d]"
      >
        <div
          aria-hidden
          ref={auraRef}
          className="absolute inset-[4%] rounded-full opacity-70 blur-[70px] bg-[conic-gradient(from_0deg,var(--color-accent)_0%,transparent_22%,var(--color-accent-hover)_50%,transparent_72%,var(--color-accent)_100%)]"
        />
        <div aria-hidden className="absolute inset-[14%] rounded-full bg-accent/20 blur-[60px]" />

        <svg
          ref={ringRef}
          viewBox="0 0 200 200"
          className="absolute inset-0 h-full w-full text-accent/30"
          style={{ transformOrigin: "50% 50%" }}
        >
          <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 11" />
          <circle cx="194" cy="100" r="3.2" fill="currentColor" className="text-accent" />
          <circle cx="194" cy="100" r="7" fill="currentColor" className="text-accent opacity-30 blur-[1px]" />
        </svg>
        <svg
          ref={ring2Ref}
          viewBox="0 0 200 200"
          className="absolute inset-[6%] h-[88%] w-[88%] text-accent-hover/25"
          style={{ transformOrigin: "50% 50%" }}
        >
          <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1 9" />
          <circle cx="6" cy="100" r="2.6" fill="currentColor" className="text-accent-hover" />
        </svg>

        <div
          ref={coreRef}
          className="absolute inset-[20%] flex flex-col items-center justify-center gap-1 overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-accent to-accent-pressed shadow-[0_40px_90px_-20px_rgba(10,95,219,0.55)] ring-1 ring-inset ring-white/15"
        >
          <div
            aria-hidden
            ref={sheenRef}
            className="pointer-events-none absolute inset-y-0 left-[-60%] w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent"
          />
          <span className="select-none font-display text-[clamp(2.75rem,9vw,4.5rem)] font-extrabold leading-none text-accent-fg">
            IS
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-accent-fg/70">Infosistel</span>
        </div>

        {CHIPS.map((chip, i) => (
          <div
            key={chip.label}
            ref={(el) => {
              chipRefs.current[i] = el;
            }}
            className={`glass-panel absolute flex items-center gap-2 rounded-2xl px-4 py-2.5 ${chip.className}`}
          >
            <chip.icon size={16} className="text-accent" strokeWidth={1.75} />
            <span className="text-xs font-bold text-fg">{chip.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
