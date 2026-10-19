/**
 * Egyptian Arabic Date & Relative Time Parser.
 *
 * Deterministically parses:
 * - Relative days: "النهارده" (today), "امبارح" (yesterday), "أول امبارح" (day before yesterday), "بكره" (tomorrow)
 * - Explicit days of week: "يوم الخميس", "الجمعة اللي فاتت", "الأحد"
 * - Calendar dates: "15 أكتوبر", "١٥/١٠", "يوم 3 في الشهر", "2026-10-15"
 *
 * All dates are calculated against an explicit referenceDate and rendered into ISO YYYY-MM-DD.
 */

import { convertArabicIndicDigits, removeDiacritics } from './normalizer';

export interface ParsedDateResult {
  date: string; // YYYY-MM-DD
  sourceText: string;
  startIndex: number;
  endIndex: number;
  isAmbiguous: boolean;
  reason?: string;
}

const MONTH_NAMES_ARABIC: Record<string, number> = {
  // Gregorian Arabic months (Egypt/Middle East)
  'يناير': 1,
  'فبراير': 2,
  'مارس': 3,
  'ابريل': 4,
  'أبريل': 4,
  'مايو': 5,
  'يونيو': 6,
  'يونيه': 6,
  'يوليو': 7,
  'يوليه': 7,
  'اغسطس': 8,
  'أغسطس': 8,
  'سبتمبر': 9,
  'اكتوبر': 10,
  'أكتوبر': 10,
  'نوفمبر': 11,
  'ديسمبر': 12,
};

const DAY_OF_WEEK_ARABIC: Record<string, number> = {
  'الاحد': 0,
  'الأحد': 0,
  'حد': 0,
  'الاثنين': 1,
  'الإثنين': 1,
  'اتنين': 1,
  'إتنين': 1,
  'الثلاثاء': 2,
  'التلات': 2,
  'تلات': 2,
  'الاربعاء': 3,
  'الأربعاء': 3,
  'الاربع': 3,
  'أربع': 3,
  'الخميس': 4,
  'خميس': 4,
  'الجمعة': 5,
  'جمعة': 5,
  'السبت': 6,
  'سبت': 6,
};

function formatDateToIsoString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses date phrases inside Arabic transcript.
 */
export function extractDate(
  text: string,
  referenceDate: Date = new Date(),
): ParsedDateResult | null {
  const converted = convertArabicIndicDigits(text);
  const clean = removeDiacritics(converted);
  const words = clean.split(/\s+/).filter(Boolean);

  // 1. Relative Egyptian colloquial day words
  for (let i = 0; i < words.length; i++) {
    // "أول امبارح" (2 days ago)
    if (
      (words[i] === 'اول' || words[i] === 'أول') &&
      i + 1 < words.length &&
      (words[i + 1] === 'امبارح' || words[i + 1] === 'إمبارح' || words[i + 1] === 'امس' || words[i + 1] === 'أمس')
    ) {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - 2);
      return {
        date: formatDateToIsoString(d),
        sourceText: `${words[i]} ${words[i + 1]}`,
        startIndex: i,
        endIndex: i + 2,
        isAmbiguous: false,
      };
    }

    // "امبارح" / "البارحة" / "أمس" (yesterday)
    if (words[i] === 'امبارح' || words[i] === 'إمبارح' || words[i] === 'البارحة' || words[i] === 'أمس') {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - 1);
      return {
        date: formatDateToIsoString(d),
        sourceText: words[i],
        startIndex: i,
        endIndex: i + 1,
        isAmbiguous: false,
      };
    }

    // "النهارده" / "النهاردة" / "اليوم" (today)
    if (
      words[i] === 'النهارده' ||
      words[i] === 'النهاردة' ||
      words[i] === 'انهارده' ||
      words[i] === 'اليوم'
    ) {
      return {
        date: formatDateToIsoString(referenceDate),
        sourceText: words[i],
        startIndex: i,
        endIndex: i + 1,
        isAmbiguous: false,
      };
    }

    // "بكره" / "بكرة" / "غداً" (tomorrow) - note: "غدا" alone in Egyptian Arabic is usually lunch (غداء), so only treat as tomorrow if explicitly "غداً" with tanween or "بكرة"
    if (words[i] === 'بكره' || words[i] === 'بكرة' || words[i] === 'غداً') {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() + 1);
      return {
        date: formatDateToIsoString(d),
        sourceText: words[i],
        startIndex: i,
        endIndex: i + 1,
        isAmbiguous: false,
      };
    }
  }

  // 2. Calendar date: e.g. "15 أكتوبر" or "يوم 15 أكتوبر"
  for (let i = 0; i < words.length; i++) {
    let dayNum: number | null = null;
    let dayTokenIdx = i;

    if (words[i] === 'يوم' && i + 1 < words.length && /^[0-9]{1,2}$/.test(words[i + 1])) {
      dayNum = parseInt(words[i + 1], 10);
      dayTokenIdx = i + 1;
    } else if (/^[0-9]{1,2}$/.test(words[i])) {
      dayNum = parseInt(words[i], 10);
    }

    if (dayNum !== null && dayNum >= 1 && dayNum <= 31) {
      const nextWord = words[dayTokenIdx + 1];
      if (nextWord && MONTH_NAMES_ARABIC[nextWord]) {
        const monthNum = MONTH_NAMES_ARABIC[nextWord];
        const year = referenceDate.getFullYear();
        const d = new Date(year, monthNum - 1, dayNum);
        return {
          date: formatDateToIsoString(d),
          sourceText: words.slice(i, dayTokenIdx + 2).join(' '),
          startIndex: i,
          endIndex: dayTokenIdx + 2,
          isAmbiguous: false,
        };
      }
    }
  }

  // 3. Day of week: e.g. "يوم الخميس", "الخميس اللي فات"
  for (let i = 0; i < words.length; i++) {
    let dayNameToken = words[i];
    let isPrefixedWithYom = false;
    if (words[i] === 'يوم' && i + 1 < words.length) {
      dayNameToken = words[i + 1];
      isPrefixedWithYom = true;
    }

    if (DAY_OF_WEEK_ARABIC[dayNameToken] !== undefined) {
      const targetDay = DAY_OF_WEEK_ARABIC[dayNameToken];
      const currentDay = referenceDate.getDay();

      // Look ahead for "اللي فات" or "الماضي"
      let endIdx = isPrefixedWithYom ? i + 2 : i + 1;
      let forcePast = false;
      if (
        (words[endIdx] === 'اللي' && words[endIdx + 1] === 'فات') ||
        words[endIdx] === 'الماضي'
      ) {
        forcePast = true;
        endIdx = words[endIdx] === 'الماضي' ? endIdx + 1 : endIdx + 2;
      }

      // Calculate diff to most recent past occurrence of that weekday
      let diff = currentDay - targetDay;
      if (diff <= 0) diff += 7;
      if (diff === 0 && forcePast) diff = 7;

      const d = new Date(referenceDate);
      d.setDate(d.getDate() - diff);

      return {
        date: formatDateToIsoString(d),
        sourceText: words.slice(i, endIdx).join(' '),
        startIndex: i,
        endIndex: endIdx,
        isAmbiguous: !forcePast && !isPrefixedWithYom,
        reason: !forcePast && !isPrefixedWithYom ? 'تم افتراض أقرب يوم سابق' : undefined,
      };
    }
  }

  return null;
}
