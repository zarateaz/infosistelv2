"use client";

import { useEffect, useRef } from "react";
import { Laptop, Printer, Cpu } from "lucide-react";
import { gsap, registerGsap } from "@/lib/gsap/registerGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const CHIPS = [
  { icon: Laptop, label: "Laptops", className: "-left-[4%] top-[10%]" },
  { icon: Printer, label: "Impresoras", className: "-right-[6%] top-[42%]" },
  { icon: Cpu, label: "PCs", className: "left-[4%] bottom-[8%]" },
];

/**
 * Custom-built hero centerpiece — replaces a generic AI-rendered stock
 * shield image with something that's actually Infosistel's own: the
 * bicolor "IS" wordmark as a glowing emblem, a slow-spinning orbit ring,
 * and three floating chips naming the exact hardware served (laptops,
 * impresoras, PCs). Pure CSS/SVG/GSAP — no image asset, no new dependency.
 */
export function HeroVisual() {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);
  const ring2Ref = useRef<SVGSVGElement>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const coreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion || !rootRef.current) return;
    registerGsap();

    const ctx = gsap.context(() => {
      gsap.to(ringRef.current, { rotate: 360, duration: 50, repeat: -1, ease: "none" });
      gsap.to(ring2Ref.current, { rotate: -360, duration: 70, repeat: -1, ease: "none" });
      gsap.to(coreRef.current, {
        y: -10,
        duration: 3.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      chipRefs.current.forEach((el, i) => {
        if (!el) return;
        gsap.to(el, {
          y: i % 2 === 0 ? -12 : 12,
          duration: 3 + i * 0.7,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: i * 0.35,
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <div ref={rootRef} className="relative aspect-square w-full">
      <div aria-hidden className="absolute inset-[8%] rounded-full bg-accent/25 blur-[90px]" />

      <svg
        ref={ringRef}
        viewBox="0 0 200 200"
        className="absolute inset-0 h-full w-full text-accent/30"
        style={{ transformOrigin: "50% 50%" }}
      >
        <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 11" />
      </svg>
      <svg
        ref={ring2Ref}
        viewBox="0 0 200 200"
        className="absolute inset-[6%] h-[88%] w-[88%] text-accent-hover/25"
        style={{ transformOrigin: "50% 50%" }}
      >
        <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1 9" />
      </svg>

      <div
        ref={coreRef}
        className="absolute inset-[20%] flex flex-col items-center justify-center gap-1 rounded-[2.25rem] bg-gradient-to-br from-accent to-accent-pressed shadow-[0_40px_90px_-20px_rgba(10,95,219,0.5)]"
      >
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
  );
}
