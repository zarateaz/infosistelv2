"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap/registerGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const SESSION_KEY = "infosistel-preloaded";
const HERO_IMAGE_SRC = "/img/tecnico-reparacion.png";
const MIN_VISIBLE_MS = 1100;

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
  const [progress, setProgress] = useState(0);
  const [alreadySeen] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1"
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const digitsRef = useRef<HTMLSpanElement>(null);
  const finished = useRef(false);

  const finish = useCallback(() => {
    document.body.style.overflow = "";
    onComplete();
  }, [onComplete]);

  const runExitAnimation = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    sessionStorage.setItem(SESSION_KEY, "1");

    const tl = gsap.timeline({ onComplete: finish });
    tl.to(digitsRef.current, { opacity: 0, y: -16, duration: 0.35, ease: "power2.in" }).to(
      rootRef.current,
      { yPercent: -100, duration: 0.7, ease: "power4.inOut" },
      "-=0.05"
    );
  }, [finish]);

  useEffect(() => {
    if (alreadySeen) {
      onComplete();
      return;
    }

    if (reducedMotion) {
      // No counting theatre for a visitor who asked for less motion —
      // just get out of the way immediately.
      sessionStorage.setItem(SESSION_KEY, "1");
      finish();
      return;
    }

    document.body.style.overflow = "hidden";
    let cancelled = false;
    const startedAt = performance.now();

    // Wait for the REAL assets first, then animate 0→100 over a fixed,
    // pleasant duration — no second "catch-up" tween racing a "fake
    // progress" one, which on fast local/broadband connections could
    // resolve before the fake tween ever ticked a single frame.
    waitForRealAssets().then(() => {
      if (cancelled) return;
      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

      const counter = { value: 0 };
      gsap.to(counter, {
        value: 100,
        duration: (700 + remaining) / 1000,
        ease: "power2.out",
        onUpdate: () => setProgress(Math.round(counter.value)),
        onComplete: runExitAnimation,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [alreadySeen, reducedMotion, onComplete, finish, runExitAnimation]);

  if (alreadySeen) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg"
      role="status"
      aria-live="polite"
      aria-label={`Cargando, ${progress}%`}
    >
      <span
        ref={digitsRef}
        className="font-display text-[clamp(3.5rem,14vw,9rem)] font-bold tabular-nums tracking-tight text-fg"
      >
        {progress}
        <span className="text-accent">%</span>
      </span>
      <div className="mt-6 h-px w-40 overflow-hidden bg-border-strong">
        <div
          className="h-full bg-accent transition-[width] duration-150 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
