"use client";

import { useEffect, useRef, useState } from "react";

const EYE_RADIUS = 22;
const PUPIL_MAX_OFFSET = 7;

/** A pair of eyes that track the mouse cursor around the page while the
 *  admin is typing their username, and shut when the password field gets
 *  focus — nobody's peeking while you type your password. Pure CSS/SVG,
 *  no new dependency. Purely decorative (aria-hidden) — never blocks
 *  keyboard-only login. */
export function CuriousEyes({ closed }: { closed: boolean }) {
  const leftEyeRef = useRef<HTMLDivElement>(null);
  const rightEyeRef = useRef<HTMLDivElement>(null);
  const [leftPupil, setLeftPupil] = useState({ x: 0, y: 0 });
  const [rightPupil, setRightPupil] = useState({ x: 0, y: 0 });

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

  return (
    <div aria-hidden className="flex items-center justify-center gap-5">
      <Eye eyeRef={leftEyeRef} pupil={leftPupil} closed={closed} />
      <Eye eyeRef={rightEyeRef} pupil={rightPupil} closed={closed} />
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
      className="relative overflow-hidden rounded-full border border-border-strong bg-white shadow-inner"
      style={{ width: EYE_RADIUS * 2, height: EYE_RADIUS * 2 }}
    >
      <div
        className="absolute h-3 w-3 rounded-full bg-fg transition-transform duration-75 ease-out"
        style={{
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${pupil.x}px), calc(-50% + ${pupil.y}px))`,
        }}
      />
      {/* Eyelid — slides down from the top on password focus, closing over
          the pupil, instead of an abrupt visibility toggle. */}
      <div
        className="absolute inset-x-0 top-0 origin-top bg-bg-alt transition-transform duration-200 ease-in-out"
        style={{ height: "100%", transform: closed ? "scaleY(1)" : "scaleY(0)" }}
      />
      <div className="absolute inset-0 rounded-full border border-border-strong" />
    </div>
  );
}
