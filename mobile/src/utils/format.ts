import { toCents } from './money';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EGP: 'ج.م',
  USD: '$',
  EUR: '€',
  SAR: 'ر.س',
  AED: 'د.إ',
  KWD: 'د.ك',
  GBP: '£',
};

export function getCurrencySymbol(currency: string = 'EGP'): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Localizes visible numerals while keeping stored and submitted values Western. */
export function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

export function toArabicNumberSeparators(value: string): string {
  return toArabicDigits(value).replace(/,/g, '٬').replace(/\./g, '٫');
}

/**
 * Normalizes user-entered amount strings:
 * - Converts Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to Western (0123456789)
 * - Converts Arabic decimal comma (٫) and standard comma (,) to dot (.)
 * - Strips unwanted non-digit characters except the first decimal dot
 */
export function normalizeAmountInput(text: string): string {
  if (!text) return '';

  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let normalized = text;

  for (let i = 0; i < 10; i++) {
    normalized = normalized.split(arabicDigits[i]).join(String(i));
  }

  normalized = normalized.replace(/[٫,]/g, '.');
  normalized = normalized.replace(/[^0-9.]/g, '');

  const parts = normalized.split('.');
  if (parts.length > 2) {
    normalized = `${parts[0]}.${parts.slice(1).join('')}`;
  }

  return normalized;
}

/**
 * Formats a monetary value into parts for rendering:
 * - Arabic-Indic digits
 * - Arabic thousands and decimal separators
 * - Exactly 2 decimal digits
 * - Minus sign is U+2212 (Unicode minus)
 * - No floating point math
 */
export function formatMoneyParts(
  amount: string | number,
  currency: string = 'EGP',
  options: {
    sign?: 'auto' | 'always' | 'none';
  } = {},
): {
  sign: string;
  whole: string;
  fraction: string;
  formattedNumber: string;
  currencySymbol: string;
  isNegative: boolean;
} {
  const cents = toCents(amount);
  const isNeg = cents < 0n;
  const absCents = isNeg ? -cents : cents;

  const centsStr = absCents.toString().padStart(3, '0');
  const rawWhole = centsStr.slice(0, -2);
  const fraction = centsStr.slice(-2);

  // Thousands comma formatting on integer string without floats
  const whole = toArabicDigits(rawWhole.replace(/\B(?=(\d{3})+(?!\d))/g, '٬'));
  const localizedFraction = toArabicDigits(fraction);

  let sign = '';
  const signMode = options.sign || 'auto';
  if (signMode === 'always') {
    sign = isNeg ? '\u2212' : '+';
  } else if (signMode === 'auto') {
    sign = isNeg ? '\u2212' : '';
  }

  const localizedSign = sign === '+' ? '+' : sign;
  const formattedNumber = `${localizedSign}${whole}٫${localizedFraction}`;
  const currencySymbol = getCurrencySymbol(currency);

  return {
    sign,
    whole,
    fraction: localizedFraction,
    formattedNumber,
    currencySymbol,
    isNegative: isNeg,
  };
}

/**
 * Formats money as a plain string with currency symbol after:
 * e.g. "1,250.50 ج.م" or "−450.00 ج.م"
 */
export function formatMoney(
  amount: string | number,
  currency: string = 'EGP',
  options?: {
    sign?: 'auto' | 'always' | 'none';
  },
): string {
  const parts = formatMoneyParts(amount, currency, options);
  return `${parts.formattedNumber} ${parts.currencySymbol}`;
}
