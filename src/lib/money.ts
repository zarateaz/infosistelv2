/**
 * Exact monetary arithmetic in integer céntimos (1 sol = 100 céntimos).
 * Eliminates IEEE-754 floating-point drift (such as 0.1 + 0.2 = 0.30000000000000004
 * or (1.005).toFixed(2) = "1.00") across Caja, Calculadora, Ventas, Deudas, and Reports.
 */

export function round2(n: number): number {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-12) return 0;
  const sign = n < 0 ? -1 : 1;
  const rounded = (sign * Math.round((Math.abs(n) + 1e-11) * 100)) / 100;
  return rounded === 0 ? 0 : rounded;
}

export function toCents(n: number): number {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-12) return 0;
  const sign = n < 0 ? -1 : 1;
  const cents = sign * Math.round((Math.abs(n) + 1e-11) * 100);
  return cents === 0 ? 0 : cents;
}

export function fromCents(cents: number): number {
  if (!Number.isFinite(cents) || cents === 0) return 0;
  return Math.round(cents) / 100;
}

export function addMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

export function subMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

export function mulMoney(amount: number, multiplier: number): number {
  return round2(amount * multiplier);
}

export function sumMoney(values: readonly number[]): number {
  let cents = 0;
  for (const v of values) {
    cents += toCents(v);
  }
  return fromCents(cents);
}

/**
 * Distributes 100.0% across non-negative weights (1 decimal place) using
 * largest-remainder rounding so positive shares always sum to exactly 100.0%.
 */
export function sharePercentages(weights: readonly number[]): number[] {
  const cleanCents = weights.map((w) => Math.max(0, toCents(w)));
  const total = cleanCents.reduce((acc, c) => acc + c, 0);
  if (total <= 0) {
    return weights.map(() => 0);
  }

  // Compute tenths of a percent (total = 1000 tenths)
  const raw = cleanCents.map((c) => (c * 1000) / total);
  const floored = raw.map((x) => Math.floor(x));
  let remainder = 1000 - floored.reduce((acc, x) => acc + x, 0);

  const order = raw
    .map((x, idx) => ({ idx, frac: x - floored[idx] }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < remainder; i++) {
    floored[order[i % order.length].idx] += 1;
  }

  return floored.map((t) => t / 10);
}
