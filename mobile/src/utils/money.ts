/**
 * Exact Decimal Money Math (No IEEE-754 Float Math)
 * Uses integer cents (bigint) to avoid precision loss on 2-decimal monetary values.
 */

export function toCents(val: string | number): bigint {
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) throw new Error('Invalid number for money calculation');
    val = val.toFixed(2);
  }

  const trimmed = val.trim();
  if (!trimmed) return 0n;

  const isNeg = trimmed.startsWith('-') || trimmed.startsWith('\u2212');
  const clean = trimmed.replace(/^[-+\u2212]/, '');

  const parts = clean.split('.');
  const whole = parts[0] || '0';
  let fraction = parts[1] || '';

  if (fraction.length > 2) {
    fraction = fraction.slice(0, 2);
  } else while (fraction.length < 2) {
    fraction += '0';
  }

  const combined = `${whole}${fraction}`;
  const cents = BigInt(combined);
  return isNeg ? -cents : cents;
}

export function fromCents(cents: bigint): string {
  const isNeg = cents < 0n;
  const abs = isNeg ? -cents : cents;
  const str = abs.toString().padStart(3, '0');
  const whole = str.slice(0, -2);
  const fraction = str.slice(-2);
  return `${isNeg ? '-' : ''}${whole}.${fraction}`;
}

export function moneyAdd(a: string | number, b: string | number): string {
  return fromCents(toCents(a) + toCents(b));
}

export function moneySubtract(a: string | number, b: string | number): string {
  return fromCents(toCents(a) - toCents(b));
}

export function moneyCompare(a: string | number, b: string | number): -1 | 0 | 1 {
  const ca = toCents(a);
  const cb = toCents(b);
  if (ca < cb) return -1;
  if (ca > cb) return 1;
  return 0;
}

export function moneyIsNegative(a: string | number): boolean {
  return toCents(a) < 0n;
}

export function moneyIsPositive(a: string | number): boolean {
  return toCents(a) > 0n;
}

export function moneyIsZero(a: string | number): boolean {
  return toCents(a) === 0n;
}

export function moneyAbs(a: string | number): string {
  const c = toCents(a);
  return fromCents(c < 0n ? -c : c);
}
