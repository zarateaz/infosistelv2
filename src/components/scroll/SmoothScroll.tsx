"use client";

import { useEffect } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { gsap, ScrollTrigger, registerGsap } from "@/lib/gsap/registerGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Drives Lenis from GSAP's own ticker (instead of Lenis's default internal
 * rAF loop) so smooth-scroll and ScrollTrigger never drift out of sync —
 * the integration GSAP's own docs recommend for ScrollTrigger + Lenis.
 */
function LenisGsapSync() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    registerGsap();

    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", onScroll);
      gsap.ticker.remove(tick);
    };
  }, [lenis]);

  return null;
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();

  // With reduced motion requested, skip Lenis entirely — native scroll
  // already respects the OS setting, and inertia/lerp is exactly the kind
  // of motion that setting exists to suppress.
  if (reducedMotion) {
    return <>{children}</>;
  }

  return (
    <ReactLenis root options={{ autoRaf: false, lerp: 0.1, duration: 1.1 }}>
      <LenisGsapSync />
      {children}
    </ReactLenis>
  );
}
