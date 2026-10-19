import { toArabicDigits, toArabicNumberSeparators } from './format';

/**
 * Flowsy Formatting Utilities
 * Handles monetary values as exact numeric strings, avoiding floating point drift.
 * Supports localized Arabic and English formatting.
 */

const CURRENCY_SYMBOLS: Record<string, { ar: string; en: string }> = {
  EGP: { ar: 'ج.م', en: 'EGP' },
  USD: { ar: '$', en: '$' },
  EUR: { ar: '€', en: '€' },
  SAR: { ar: 'ر.س', en: 'SAR' },
  AED: { ar: 'د.إ', en: 'AED' },
};

/**
 * Formats a monetary amount with currency symbol and thousands grouping.
 * Never performs floating point operations; operates on parsed decimals.
 */
export function formatCurrency(
  amount: string | number,
  currency: string = 'EGP',
  locale: 'ar' | 'en' = 'ar',
): string {
  const numericStr = typeof amount === 'number' ? amount.toFixed(2) : amount;
  const isNegative = numericStr.startsWith('-');
  const cleanStr = isNegative ? numericStr.substring(1) : numericStr;

  const [integerPart, decimalPart = '00'] = cleanStr.split('.');

  // Add commas for thousands
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const normalizedDecimal = decimalPart.padEnd(2, '0').slice(0, 2);

  const symbol =
    CURRENCY_SYMBOLS[currency.toUpperCase()]?.[locale] || currency;

  const sign = isNegative ? '-' : '';

  if (locale === 'ar') {
    return `${toArabicNumberSeparators(`${sign}${formattedInteger}.${normalizedDecimal}`)} ${symbol}`;
  }

  return `${sign}${symbol} ${formattedInteger}.${normalizedDecimal}`;
}

/**
 * Formats date into readable localized label.
 */
export function formatDate(
  dateInput: string | Date,
  locale: 'ar' | 'en' = 'ar',
): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return locale === 'ar' ? 'اليوم' : 'Today';
  }
  if (diffDays === 1) {
    return locale === 'ar' ? 'غداً' : 'Tomorrow';
  }
  if (diffDays === -1) {
    return locale === 'ar' ? 'أمس' : 'Yesterday';
  }

  const arabicMonths = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];

  const englishMonths = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const day = date.getDate();
  const month =
    locale === 'ar'
      ? arabicMonths[date.getMonth()]
      : englishMonths[date.getMonth()];

  return locale === 'ar' ? `${toArabicDigits(day)} ${month}` : `${month} ${day}`;
}

/**
 * Calculates remaining days until a due date.
 */
export function getDaysRemaining(
  dueDateInput: string | Date,
): { days: number; isOverdue: boolean } {
  const dueDate =
    typeof dueDateInput === 'string' ? new Date(dueDateInput) : dueDateInput;
  const now = new Date();

  const diffTime = dueDate.getTime() - now.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    days: Math.abs(days),
    isOverdue: days < 0,
  };
}

/**
 * Formats transaction date for list rows.
 */
export function formatTransactionDate(
  dateInput: string | Date,
  locale: 'ar' | 'en' = 'ar',
): string {
  return formatDate(dateInput, locale);
}

/**
 * Formats commitment due date with friendly days countdown or overdue status.
 */
export function formatCommitmentDueDate(
  dateInput: string | Date,
  locale: 'ar' | 'en' = 'ar',
): string {
  const { days, isOverdue } = getDaysRemaining(dateInput);
  if (isOverdue) {
    return locale === 'ar' ? `متأخر منذ ${toArabicDigits(days)} يوم` : `${days} days overdue`;
  }
  if (days === 0) {
    return locale === 'ar' ? 'مستحق اليوم' : 'Due today';
  }
  if (days === 1) {
    return locale === 'ar' ? 'مستحق غداً' : 'Due tomorrow';
  }
  return locale === 'ar' ? `مستحق خلال ${toArabicDigits(days)} أيام` : `Due in ${days} days`;
}

