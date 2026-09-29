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
      className="relative mx-auto flex w-fit items-center justify-center gap-4 rounded-full border border-cyan-400/20 bg-[#050b18]/80 px-5 py-2.5 shadow-[0_0_30px_rgba(46,163,255,0.2),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-xl ring-1 ring-white/10"
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
      className="relative overflow-hidden rounded-full shadow-[0_0_16px_rgba(56,189,248,0.45),inset_0_0_10px_rgba(14,165,233,0.3)]"
      style={{
        width: EYE_RADIUS * 2,
        height: EYE_RADIUS * 2,
        border: "2.5px solid #38bdf8",
        background: "radial-gradient(circle at 35% 35%, #ffffff 0%, #e0f2fe 45%, #bae6fd 75%, #7dd3fc 100%)",
      }}
    >
      <div
        className="absolute rounded-full bg-[#030712] transition-transform duration-75 ease-out shadow-[0_0_8px_rgba(3,7,18,0.9)]"
        style={{
          width: 17,
          height: 17,
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${pupil.x}px), calc(-50% + ${pupil.y}px))`,
        }}
      >
        <div className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_3px_#fff]" />
        <div className="absolute right-1 bottom-1 h-1 w-1 rounded-full bg-cyan-200/80" />
      </div>
      {/* Eyelid — slides down from the top on password focus, with a glowing cyan rim */}
      <div
        className="absolute inset-x-0 top-0 origin-top bg-gradient-to-b from-[#030712] via-[#060e22] to-[#0c1e40] border-b-2 border-cyan-400 shadow-[0_2px_10px_rgba(56,189,248,0.7)] transition-transform duration-200 ease-in-out"
        style={{ height: "100%", transform: closed ? "scaleY(1)" : "scaleY(0)" }}
      />
    </div>
  );
}
