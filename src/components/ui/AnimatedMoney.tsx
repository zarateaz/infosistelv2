"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedMoneyProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  durationMs?: number;
  replayKey?: number | string;
  className?: string;
}

export function useCountUp(
  target: number,
  durationMs = 1250,
  replayKey: number | string = 0
): number {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const previousReplayKey = useRef<number | string>(replayKey);
  const currentValRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(false);

  useEffect(() => {
    const isReplay = previousReplayKey.current !== replayKey || !mountedRef.current;
    previousReplayKey.current = replayKey;
    mountedRef.current = true;

    const startValue = isReplay ? 0 : currentValRef.current;
    const endValue = Number.isFinite(target) ? target : 0;

    if (isReplay) {
      currentValRef.current = 0;
      setDisplayValue(0);
    }

    if (Math.abs(endValue - startValue) < 0.001) {
      currentValRef.current = endValue;
      setDisplayValue(endValue);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Smooth quartic ease-out curve for crisp count-up from 0.00
      const eased = 1 - Math.pow(1 - progress, 4);
      const nextVal = startValue + (endValue - startValue) * eased;

      currentValRef.current = nextVal;
      setDisplayValue(nextVal);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        currentValRef.current = endValue;
        setDisplayValue(endValue);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs, replayKey]);

  return displayValue;
}

export function AnimatedMoney({
  value,
  prefix = "S/. ",
  suffix = "",
  decimals = 2,
  durationMs = 1250,
  replayKey = 0,
  className,
}: AnimatedMoneyProps) {
  const animated = useCountUp(value, durationMs, replayKey);
  const isNegative = animated < -0.004;
  const absFormatted = Math.abs(animated).toLocaleString("es-PE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  // If prefix already contains '+' or '-', don't double-render sign
  const hasExplicitSign = prefix.includes("+") || prefix.includes("-");
  const displayPrefix = !hasExplicitSign && isNegative ? `- ${prefix}` : prefix;

  return (
    <span className={`tabular-nums ${className ?? ""}`}>
      {displayPrefix}
      {absFormatted}
      {suffix}
    </span>
  );
}
