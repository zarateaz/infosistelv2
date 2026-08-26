"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap, registerGsap } from "@/lib/gsap/registerGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function Hero({ play }: { play: boolean }) {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const eyebrowRef = useRef<HTMLSpanElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Entrance timeline — held back until the Preloader signals it's done, so
  // the reveal reads as one continuous motion instead of "preloader ends,
  // then separately the page pops in".
  useEffect(() => {
    if (!play) return;

    if (reducedMotion) {
      gsap.set(
        [eyebrowRef.current, headlineRef.current, subRef.current, ctaRef.current, imageWrapRef.current],
        { opacity: 1, y: 0, scale: 1 }
      );
      return;
    }

    registerGsap();
    // Plain timeline + kill() on cleanup — deliberately NOT gsap.context()
    // + revert(). This is a one-shot "play once" reveal, not a repeatable
    // scroll trigger: revert() resets elements back to their pre-animation
    // (invisible) state, which is wrong here if a dev-only effect
    // double-invoke fires the cleanup right after the real run starts.
    // kill() just stops ticking wherever it is, leaving visible progress intact.
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(eyebrowRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5 })
      .fromTo(headlineRef.current, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.7 }, "-=0.25")
      .fromTo(subRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, "-=0.35")
      .fromTo(ctaRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5 }, "-=0.3")
      .fromTo(
        imageWrapRef.current,
        { opacity: 0, scale: 0.94 },
        { opacity: 1, scale: 1, duration: 0.9 },
        "-=0.55"
      );

    return () => {
      tl.kill();
    };
  }, [play, reducedMotion]);

  // Scroll parallax on the hero photo — moves slower than the page, which
  // is what reads as "depth" without any WebGL/3D involved.
  useEffect(() => {
    if (reducedMotion || !imageRef.current) return;
    registerGsap();
    const ctx = gsap.context(() => {
      gsap.to(imageRef.current, {
        yPercent: 14,
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    }, rootRef);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section
      ref={rootRef}
      className="relative flex min-h-[100svh] items-center overflow-hidden pt-24"
    >
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 md:grid-cols-2 md:px-10">
        <div>
          <span
            ref={eyebrowRef}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-accent opacity-0"
          >
            <span className="h-px w-6 bg-accent" />
            Servicio técnico en Huancayo
          </span>

          <h1
            ref={headlineRef}
            className="mt-5 font-display text-[clamp(2.4rem,5.5vw,4.2rem)] font-bold leading-[1.05] tracking-tight text-fg opacity-0"
          >
            Reparamos tu tecnología con
            <span className="text-accent"> precisión de taller</span>
          </h1>

          <p ref={subRef} className="mt-6 max-w-md text-lg text-fg-muted opacity-0">
            Laptops, PC e impresoras. Diagnóstico honesto, repuestos reales y
            garantía sobre cada trabajo — en Huancayo.
          </p>

          <div ref={ctaRef} className="mt-9 flex flex-wrap items-center gap-4 opacity-0">
            <a
              href="#servicios"
              className="rounded-full bg-accent px-7 py-3.5 text-sm font-bold text-accent-fg transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Ver servicios
            </a>
            <a
              href="https://wa.me/51964648202"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border-strong px-7 py-3.5 text-sm font-bold text-fg transition-colors hover:border-accent hover:text-accent"
            >
              Escríbenos por WhatsApp
            </a>
          </div>
        </div>

        <div ref={imageWrapRef} className="relative opacity-0">
          <div
            ref={imageRef}
            className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-alt"
          >
            <Image
              src="/img/tecnico-reparacion.png"
              alt="Técnico de Infosistel reparando una laptop"
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
