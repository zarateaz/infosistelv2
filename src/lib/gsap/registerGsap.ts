"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

/**
 * Registers the ScrollTrigger plugin exactly once, no matter how many
 * components import it. GSAP plugin registration is idempotent-unsafe to
 * call repeatedly during React StrictMode double-invoked effects, hence the
 * guard.
 */
export function registerGsap() {
  if (registered) return gsap;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
  return gsap;
}

export { gsap, ScrollTrigger };
