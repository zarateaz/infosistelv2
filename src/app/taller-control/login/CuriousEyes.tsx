"use client";

import { useEffect, useRef, useState } from "react";

const EYE_RADIUS = 28;
const PUPIL_MAX_OFFSET = 9;

/** A pair of eyes that track the mouse cursor around the page while the
 *  admin is typing their username, and shut when the password field gets
 *  focus — nobody's peeking while you type your password. Pure CSS/SVG,
 *  no new dependency. Purely decorative (aria-hidden) — never blocks
 *  keyboard-only login.
 *
 *  Sized and contrasted deliberately high (thick dark ring, solid white
 *  sclera, drop shadow) — the first version blended into the light
 *  glass-panel background and read as "gone" at normal viewing distance,
 *  not just on close zoom. */
export function CuriousEyes({ closed }: { closed: boolean }) {
  const leftEyeRef = useRef<HTMLDivElement>(null);
  const rightEyeRef = useRef<HTMLDivElement>(null);
  const [leftPupil, setLeftPupil] = useState({ x: 0, y: 0 });
  const [rightPupil, setRightPupil] = useState({ x: 0, y: 0 });
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    function pupilOffsetFor(eyeEl: HTMLDivElement | null, clientX: number, clientY: number) {
      if (!eyeEl) return { x: 0, y: 0 };
      const rect = eyeEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const distance = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(distance, PUPIL_MAX_OFFSET * 6) / (PUPIL_MAX_OFFSET * 6);
      return { x: (dx / distance) * PUPIL_MAX_OFFSET * clamped, y: (dy / distance) * PUPIL_MAX_OFFSET * clamped };
    }

    function handleMove(e: MouseEvent) {
      setLeftPupil(pupilOffsetFor(leftEyeRef.current, e.clientX, e.clientY));
      setRightPupil(pupilOffsetFor(rightEyeRef.current, e.clientX, e.clientY));
    }

    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  // Subtle natural blink every few seconds
  useEffect(() => {
    let blinkTimer: ReturnType<typeof setTimeout>;
    let resetTimer: ReturnType<typeof setTimeout>;

    function scheduleBlink() {
      const delay = Math.random() * 3500 + 2500;
      blinkTimer = setTimeout(() => {
        setBlinking(true);
        resetTimer = setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, 130);
      }, delay);
    }

    scheduleBlink();
    return () => {
      clearTimeout(blinkTimer);
      clearTimeout(resetTimer);
    };
  }, []);

  const isClosed = closed || blinking;

  return (
    <div
      aria-hidden
      className="relative mx-auto flex w-fit items-center justify-center gap-4 rounded-full border border-orange-500/30 bg-[#0d0614]/85 px-5 py-2.5 shadow-[0_0_35px_rgba(255,110,20,0.3),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-xl ring-1 ring-purple-500/20"
    >
      <Eye eyeRef={leftEyeRef} pupil={leftPupil} closed={isClosed} />
      <Eye eyeRef={rightEyeRef} pupil={rightPupil} closed={isClosed} />
    </div>
  );
}

function Eye({
  eyeRef,
  pupil,
  closed,
}: {
  eyeRef: React.RefObject<HTMLDivElement | null>;
  pupil: { x: number; y: number };
  closed: boolean;
}) {
  return (
    <div
      ref={eyeRef}
      className="relative overflow-hidden rounded-full shadow-[0_0_22px_rgba(255,120,20,0.7),inset_0_0_12px_rgba(194,65,12,0.6)]"
      style={{
        width: EYE_RADIUS * 2,
        height: EYE_RADIUS * 2,
        border: "2.5px solid #ff7a18",
        background: "radial-gradient(circle at 40% 40%, #fff7c2 0%, #ffd34d 35%, #ff9a1a 70%, #c2410c 100%)",
      }}
    >
      {/* Cat-like slit pupil */}
      <div
        className="absolute rounded-full bg-[#0a0410] transition-transform duration-75 ease-out shadow-[0_0_8px_rgba(10,4,16,0.9)]"
        style={{
          width: 9,
          height: 26,
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${pupil.x}px), calc(-50% + ${pupil.y}px))`,
        }}
      >
        <div className="absolute left-0.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_3px_#fff]" />
      </div>
      {/* Eyelid — slides down from the top on password focus, with a glowing orange rim */}
      <div
        className="absolute inset-x-0 top-0 origin-top bg-gradient-to-b from-[#0a0410] via-[#1a0b2e] to-[#3b1446] border-b-2 border-orange-500 shadow-[0_2px_12px_rgba(255,110,20,0.8)] transition-transform duration-200 ease-in-out"
        style={{ height: "100%", transform: closed ? "scaleY(1)" : "scaleY(0)" }}
      />
    </div>
  );
}
