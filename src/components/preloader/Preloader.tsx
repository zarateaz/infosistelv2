"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap/registerGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const SESSION_KEY = "infosistel-preloaded";
// Hard ceiling: no matter what fails upstream — a stuck GSAP ticker, a
// backgrounded tab, anything — the site must become visible by this point.
// Deliberately NOT gated on fonts/images finishing (a previous version was,
// and that extra async dependency was one more thing that could hang).
const SAFETY_TIMEOUT_MS = 4500;

// Same three-color split as the Hero wordmark, flattened into individual
// letters so each one can be animated independently.
const WORD_PARTS = [
  { text: "INFO", className: "text-accent" },
  { text: "SIS", className: "text-fg" },
  { text: "TEL", className: "text-accent" },
];
const LETTERS = WORD_PARTS.flatMap((part) =>
  part.text.split("").map((ch) => ({ ch, className: part.className }))
);

export function Preloader({ onComplete }: { onComplete: () => void }) {
  const reducedMotion = useReducedMotion();
  const [alreadySeen] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1"
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    sessionStorage.setItem(SESSION_KEY, "1");
    document.body.style.overflow = "";
    onComplete();
  }, [onComplete]);

  /** Instant, non-animated fallback — `gsap.set` applies synchronously and
   *  doesn't need the rAF ticker at all, unlike every `.to()` tween above.
   *  If GSAP's ticker is the thing that's stuck, a tween-based "safety net"
   *  would get stuck too; this can't. */
  const forceHide = useCallback(() => {
    gsap.set(rootRef.current, { autoAlpha: 0 });
    finish();
  }, [finish]);

  useEffect(() => {
    if (alreadySeen) {
      onComplete();
      return;
    }

    if (reducedMotion) {
      gsap.set(rootRef.current, { autoAlpha: 0 });
      finish();
      return;
    }

    document.body.style.overflow = "hidden";

    const letters = letterRefs.current.filter(Boolean) as HTMLSpanElement[];
    gsap.set(letters, {
      opacity: 0,
      x: () => gsap.utils.random(-70, 70),
      y: () => gsap.utils.random(-50, 50),
      rotate: () => gsap.utils.random(-30, 30),
      filter: "blur(6px)",
    });
    gsap.set(glowRef.current, { opacity: 0, scale: 0.6 });

    // One single timeline drives entrance AND exit — no cross-timeline
    // coordination, no promise chains, no dependency on fonts/images
    // finishing. `finish()` only ever runs from this timeline's own
    // onComplete or from the safety timer below; never both (finished.current
    // guards it), so there's no double-fire.
    const tl = gsap.timeline({ onComplete: finish });
    tl.to(letters, {
      opacity: 1,
      x: 0,
      y: 0,
      rotate: 0,
      filter: "blur(0px)",
      duration: 0.7,
      stagger: { each: 0.04, from: "center" },
      ease: "back.out(1.8)",
    })
      .to(glowRef.current, { opacity: 1, scale: 1.5, duration: 0.45, ease: "power2.out" }, "-=0.45")
      .to(glowRef.current, { opacity: 0, duration: 0.5, ease: "power2.in" }, "-=0.05")
      .to({}, { duration: 0.5 }) // brief cinematic hold on the assembled mark
      .to(letters, { opacity: 0, scale: 1.08, duration: 0.3, stagger: 0.012, ease: "power2.in" })
      .to(rootRef.current, { clipPath: "inset(0 0 100% 0)", duration: 0.75, ease: "power4.inOut" }, "-=0.05");

    const safetyTimer = window.setTimeout(forceHide, SAFETY_TIMEOUT_MS);

    return () => {
      tl.kill();
      window.clearTimeout(safetyTimer);
    };
  }, [alreadySeen, reducedMotion, onComplete, finish, forceHide]);

  if (alreadySeen) return null;

  // The CSS-only force-reveal animation (see globals.css) only touches
  // opacity/visibility — it can't call back into React or GSAP on its own.
  // This listener is what turns "the overlay went invisible" into "the
  // page is actually usable again" (scroll restored, onComplete fired for
  // the Hero's own entrance) even in the worst case where GSAP and the
  // setTimeout safety net both somehow never ran. Filtered to this exact
  // animation so it ignores the shine sweep's animationend bubbling up.
  function handleRootAnimationEnd(e: React.AnimationEvent<HTMLDivElement>) {
    if (e.animationName === "preloader-force-reveal") finish();
  }

  return (
    <div
      ref={rootRef}
      onAnimationEnd={handleRootAnimationEnd}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-bg animate-[preloader-force-reveal_0.3s_ease-out_7s_1_forwards]"
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

      <div className="relative select-none overflow-hidden font-display text-[clamp(2.6rem,11vw,7.5rem)] font-extrabold leading-none tracking-tight">
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
        {/* Pure CSS shine sweep — no GSAP, no JS timing dependency, can't
            get stuck. Timed to play once the letters have mostly landed. */}
        <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[preloader-shine_1.1s_ease-out_0.55s_1_forwards] bg-gradient-to-r from-transparent via-white/60 to-transparent mix-blend-overlay" />
      </div>
    </div>
  );
}
