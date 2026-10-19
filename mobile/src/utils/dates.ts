/**
 * Date Formatting & Timezone Helpers per Section 13.2 & Section 16
 * Uses Western digits with Arabic month and day names.
 */

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const ARABIC_DAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

export function parseDate(dateInput: string | Date): Date {
  return typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
}

/**
 * Returns formatted date in Arabic with Western digits:
 * e.g. "الأحد 18 أكتوبر 2026"
 */
export function formatDateArabic(dateInput: string | Date): string {
  const d = parseDate(dateInput);
  if (isNaN(d.getTime())) return '';

  const dayName = ARABIC_DAYS[d.getDay()];
  const day = d.getDate();
  const monthName = ARABIC_MONTHS[d.getMonth()];
  const year = d.getFullYear();

  return `${dayName} ${day} ${monthName} ${year}`;
}

/**
 * Returns month + day in Arabic:
 * e.g. "18 أكتوبر"
 */
export function formatMonthDayArabic(dateInput: string | Date): string {
  const d = parseDate(dateInput);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]}`;
}

/**
 * Relative Due Date Labels:
 * - "متأخر {N} أيام" / "متأخر يومين" / "متأخر يوم"
 * - "النهارده"
 * - "بكرة"
 * - "بعد يومين" / "بعد {N} أيام"
 */
export function getRelativeDueDateLabel(dueDateInput: string | Date): {
  label: string;
  isOverdue: boolean;
  daysDiff: number;
} {
  const due = parseDate(dueDateInput);
  const now = new Date();

  // Compare calendar days (midnight to midnight)
  const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = dueMidnight.getTime() - nowMidnight.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    let dayText = `${overdueDays} يوم`;
    if (overdueDays === 1) dayText = 'يوم';
    else if (overdueDays === 2) dayText = 'يومين';
    else if (overdueDays >= 3 && overdueDays <= 10) dayText = `${overdueDays} أيام`;

    return {
      label: `متأخر ${dayText}`,
      isOverdue: true,
      daysDiff: diffDays,
    };
  }

  if (diffDays === 0) {
    return { label: 'النهارده', isOverdue: false, daysDiff: 0 };
  }

  if (diffDays === 1) {
    return { label: 'بكرة', isOverdue: false, daysDiff: 1 };
  }

  if (diffDays === 2) {
    return { label: 'بعد يومين', isOverdue: false, daysDiff: 2 };
  }

  if (diffDays >= 3 && diffDays <= 10) {
    return { label: `بعد ${diffDays} أيام`, isOverdue: false, daysDiff: diffDays };
  }

  return { label: `بعد ${diffDays} يوم`, isOverdue: false, daysDiff: diffDays };
}

/**
 * Checks if a date falls beyond the current calendar month end
 */
export function isDueAfterEndOfMonth(dateInput: string | Date): boolean {
  const d = parseDate(dateInput);
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return d.getTime() > endOfMonth.getTime();
}

/**
 * Returns month start and end boundaries for a given date (or now)
 */
export function getMonthBoundaries(dateInput?: string | Date): { start: Date; end: Date } {
  const d = dateInput ? parseDate(dateInput) : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}
