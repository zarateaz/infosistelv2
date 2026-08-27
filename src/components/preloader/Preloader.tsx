"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap/registerGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const SESSION_KEY = "infosistel-preloaded";
const HERO_IMAGE_SRC = "/img/hero-shield.png";
const MIN_VISIBLE_MS = 1500;

// Same three-color split as the Hero wordmark, flattened into individual
// letters so each one can be animated on/off independently.
const WORD_PARTS = [
  { text: "INFO", className: "text-accent" },
  { text: "SIS", className: "text-fg" },
  { text: "TEL", className: "text-accent" },
];
const LETTERS = WORD_PARTS.flatMap((part) =>
  part.text.split("").map((ch) => ({ ch, className: part.className }))
);

/** Waits for the fonts + hero image to actually be ready, capped so a slow
 *  network can't hold the preloader open forever. */
function waitForRealAssets(): Promise<void> {
  const fontsReady =
    typeof document !== "undefined" && "fonts" in document
      ? document.fonts.ready
      : Promise.resolve();

  const heroImageReady = new Promise<void>((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = HERO_IMAGE_SRC;
  });

  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 4000));

  return Promise.race([Promise.all([fontsReady, heroImageReady]).then(() => undefined), timeout]);
}

export function Preloader({ onComplete }: { onComplete: () => void }) {
  const reducedMotion = useReducedMotion();
  const [alreadySeen] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1"
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const taglineRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const sparkRef = useRef<HTMLSpanElement>(null);
  const finished = useRef(false);

  const finish = useCallback(() => {
    document.body.style.overflow = "";
    onComplete();
  }, [onComplete]);

  const runExitAnimation = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    sessionStorage.setItem(SESSION_KEY, "1");

    const letters = letterRefs.current.filter(Boolean) as HTMLSpanElement[];
    const tl = gsap.timeline({ onComplete: finish });
    tl.to([taglineRef.current, lineRef.current, sparkRef.current], {
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
    })
      .to(
        letters,
        { scale: 1.06, opacity: 0, duration: 0.35, stagger: 0.015, ease: "power2.in" },
        "-=0.15"
      )
      .to(
        rootRef.current,
        { clipPath: "inset(0 0 100% 0)", duration: 0.85, ease: "power4.inOut" },
        "-=0.1"
      );
  }, [finish]);

  useEffect(() => {
    if (alreadySeen) {
      onComplete();
      return;
    }

    if (reducedMotion) {
      // No assembly theatre for a visitor who asked for less motion — just
      // hide instantly and get out of the way.
      sessionStorage.setItem(SESSION_KEY, "1");
      gsap.set(rootRef.current, { autoAlpha: 0 });
      finish();
      return;
    }

    document.body.style.overflow = "hidden";
    let cancelled = false;
    const startedAt = performance.now();

    const letters = letterRefs.current.filter(Boolean) as HTMLSpanElement[];
    gsap.set(letters, {
      opacity: 0,
      x: () => gsap.utils.random(-70, 70),
      y: () => gsap.utils.random(-50, 50),
      rotate: () => gsap.utils.random(-30, 30),
      filter: "blur(6px)",
    });
    gsap.set(glowRef.current, { opacity: 0, scale: 0.6 });
    gsap.set(lineRef.current, { scaleX: 0 });
    gsap.set(sparkRef.current, { opacity: 0, left: "0%" });
    gsap.set(taglineRef.current, { opacity: 0, y: 10 });

    const entrance = gsap.timeline();
    entrance
      .to(letters, {
        opacity: 1,
        x: 0,
        y: 0,
        rotate: 0,
        filter: "blur(0px)",
        duration: 0.75,
        stagger: { each: 0.045, from: "center" },
        ease: "back.out(1.8)",
      })
      .to(glowRef.current, { opacity: 1, scale: 1.4, duration: 0.5, ease: "power2.out" }, "-=0.5")
      .to(glowRef.current, { opacity: 0, duration: 0.6, ease: "power2.in" }, "-=0.1")
      .to(sparkRef.current, { opacity: 1, duration: 0.1 }, "-=0.55")
      .to(lineRef.current, { scaleX: 1, duration: 0.55, ease: "power3.inOut" }, "<")
      .to(sparkRef.current, { left: "100%", duration: 0.55, ease: "power3.inOut" }, "<")
      .to(sparkRef.current, { opacity: 0, duration: 0.15 })
      .to(taglineRef.current, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, "-=0.15");

    waitForRealAssets().then(() => {
      if (cancelled) return;
      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      gsap.delayedCall(remaining / 1000, runExitAnimation);
    });

    return () => {
      cancelled = true;
      entrance.kill();
    };
  }, [alreadySeen, reducedMotion, onComplete, finish, runExitAnimation]);

  if (alreadySeen) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-bg"
      role="status"
      aria-live="polite"
      aria-label="Cargando Infosistel"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(var(--fg) 1px, transparent 1px), linear-gradient(90deg, var(--fg) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div
        ref={glowRef}
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-accent/30 blur-[80px]"
      />

      <div className="relative select-none font-display text-[clamp(2.6rem,11vw,7.5rem)] font-extrabold leading-none tracking-tight">
        {LETTERS.map((l, i) => (
          <span
            key={i}
            ref={(el) => {
              letterRefs.current[i] = el;
            }}
            className={l.className}
            style={{ display: "inline-block", willChange: "transform, filter, opacity" }}
          >
            {l.ch}
          </span>
        ))}
      </div>

      <span
        ref={taglineRef}
        className="relative mt-5 text-xs font-bold uppercase tracking-[0.35em] text-fg-muted"
      >
        Servicio técnico en Huancayo
      </span>

      <div className="relative mt-8 h-px w-56 overflow-hidden bg-border-strong">
        <div ref={lineRef} className="h-full w-full origin-left bg-accent" />
        <span
          ref={sparkRef}
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_14px_4px_rgba(10,95,219,0.55)]"
        />
      </div>
    </div>
  );
}
