"use client";

interface AnimatedMoneyProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  durationMs?: number;
  replayKey?: number | string;
  className?: string;
}

export function useCountUp(target: number): number {
  return Number.isFinite(target) ? target : 0;
}

export function AnimatedMoney({
  value,
  prefix = "S/. ",
  suffix = "",
  decimals = 2,
  className,
}: AnimatedMoneyProps) {
  const safeVal = Number.isFinite(value) ? value : 0;
  const isNegative = safeVal < -0.004;
  const absFormatted = Math.abs(safeVal).toLocaleString("es-PE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

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
