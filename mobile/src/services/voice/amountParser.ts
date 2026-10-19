/**
 * Egyptian Arabic Number and Amount Parser.
 *
 * Deterministically parses:
 * - Digits: "50", "350.5", "١٢٥"
 * - Spoken Egyptian numbers: "خمسين", "تلتمية وخمسين", "ألف وخمسمية", "ميتين وخمسة وعشرين"
 * - Colloquial subtraction expressions: "خمسمية إلا عشرة" (490)
 * - Fractions: "نص", "ربع", "ونص", "وربع" (e.g. "مية وخمسين ونص", "ألفين وربع")
 * - Slang amounts: "باكو" (1000), "أرنب" (1000000) if used in context
 * - Currency extraction: "جنيه", "ج.م", "دولار", "يورو", "ريال", "درهم", "EGP", "USD"
 * - Conflicting amount detection & correction phrase parsing: "دفعت خمسين، لأ، ستين" -> 60
 */

import { convertArabicIndicDigits, removeDiacritics } from './normalizer';

export interface ParsedAmountResult {
  amount: number | null;
  currency: string;
  sourceText: string;
  startIndex: number;
  endIndex: number;
  isAmbiguous: boolean;
  reason?: string;
  alternatives?: number[];
}

const UNIT_MAP: Record<string, number> = {
  'صفر': 0,
  'واحد': 1,
  'واحدة': 1,
  'اتنين': 2,
  'إتنين': 2,
  'اثنين': 2,
  'إثنين': 2,
  'اثنان': 2,
  'تلاتة': 3,
  'ثلاثة': 3,
  'تلات': 3,
  'ثلاث': 3,
  'أربعة': 4,
  'اربعة': 4,
  'اربع': 4,
  'أربع': 4,
  'خمسة': 5,
  'خمس': 5,
  'ستة': 6,
  'ست': 6,
  'سبعة': 7,
  'سبع': 7,
  'تمانية': 8,
  'ثمانية': 8,
  'تمان': 8,
  'ثمان': 8,
  'تسعة': 9,
  'تسع': 9,
  'عشرة': 10,
  'عشر': 10,
};

const TEEN_MAP: Record<string, number> = {
  'حداشر': 11,
  'أحد عشر': 11,
  'احد عشر': 11,
  'اثناشر': 12,
  'اتناشر': 12,
  'إثنا عشر': 12,
  'اثني عشر': 12,
  'اثنا عشر': 12,
  'تلاتاشر': 13,
  'تلتاشر': 13,
  'ثلاثة عشر': 13,
  'ثلاث عشر': 13,
  'اربعتاشر': 14,
  'أربعتاشر': 14,
  'أربعة عشر': 14,
  'اربعة عشر': 14,
  'خمستاشر': 15,
  'خمسة عشر': 15,
  'خمس عشر': 15,
  'ستاشر': 16,
  'ستة عشر': 16,
  'ست عشر': 16,
  'سبعتاشر': 17,
  'سبعة عشر': 17,
  'سبع عشر': 17,
  'تمنتاشر': 18,
  'تمانتاشر': 18,
  'ثمانية عشر': 18,
  'ثمان عشر': 18,
  'تسعتاشر': 19,
  'تسعة عشر': 19,
  'تسع عشر': 19,
};

const TENS_MAP: Record<string, number> = {
  'عشرين': 20,
  'تلاتين': 30,
  'ثلاثين': 30,
  'اربعين': 40,
  'أربعين': 40,
  'خمسين': 50,
  'ستين': 60,
  'سبعين': 70,
  'تمانين': 80,
  'ثمانين': 80,
  'تسعين': 90,
};

const HUNDREDS_MAP: Record<string, number> = {
  'مية': 100,
  'ميه': 100,
  'مائة': 100,
  'مئة': 100,
  'ميتين': 200,
  'مائتين': 200,
  'مئتين': 200,
  'مائتان': 200,
  'مئتان': 200,
  'تلتمية': 300,
  'تلاتمية': 300,
  'تلتميه': 300,
  'تلاتميه': 300,
  'ثلاثمائة': 300,
  'اربعمية': 400,
  'أربعمية': 400,
  'اربعميه': 400,
  'أربعميه': 400,
  'أربعمائة': 400,
  'اربعمائة': 400,
  'خمسمية': 500,
  'خمسميه': 500,
  'خمسمائة': 500,
  'ستمية': 600,
  'ستميه': 600,
  'ستمائة': 600,
  'سبعمية': 700,
  'سبعميه': 700,
  'سبعمائة': 700,
  'تمنمية': 800,
  'تمانمية': 800,
  'تمنميه': 800,
  'تمانميه': 800,
  'ثمانمائة': 800,
  'تسعمية': 900,
  'تسعميه': 900,
  'تسعمائة': 900,
};

const THOUSANDS_MAP: Record<string, number> = {
  'ألف': 1000,
  'الف': 1000,
  'ألفين': 2000,
  'الفين': 2000,
  'ألفان': 2000,
  'الفان': 2000,
  'آلاف': 1000,
  'الاف': 1000,
  'تلاف': 1000,
  'باكو': 1000, // Egyptian slang for 1k EGP
  'مليون': 1000000,
  'ملايين': 1000000,
  'أرنب': 1000000, // Egyptian slang for 1 million EGP
};

const FRACTIONS_MAP: Record<string, number> = {
  'نص': 0.5,
  'نصف': 0.5,
  'ربع': 0.25,
  'تلت': 0.33,
  'ثلث': 0.33,
};

const CURRENCY_KEYWORDS: Record<string, string> = {
  'جنيه': 'EGP',
  'جنيهات': 'EGP',
  'جنية': 'EGP',
  'ج.م': 'EGP',
  'ج م': 'EGP',
  'egp': 'EGP',
  'le': 'EGP',
  'دولار': 'USD',
  'دولارات': 'USD',
  'usd': 'USD',
  '$': 'USD',
  'يورو': 'EUR',
  'eur': 'EUR',
  '€': 'EUR',
  'ريال': 'SAR',
  'ريالات': 'SAR',
  'sar': 'SAR',
  'درهم': 'AED',
  'دراهم': 'AED',
  'aed': 'AED',
};

/**
 * Checks if a token is a known number word.
 */
export function isNumberWord(token: string): boolean {
  const clean = removeDiacritics(token).trim();
  if (/^[0-9]+(\.[0-9]+)?$/.test(clean)) return true;
  if (UNIT_MAP[clean] !== undefined) return true;
  if (TEEN_MAP[clean] !== undefined) return true;
  if (TENS_MAP[clean] !== undefined) return true;
  if (HUNDREDS_MAP[clean] !== undefined) return true;
  if (THOUSANDS_MAP[clean] !== undefined) return true;
  if (FRACTIONS_MAP[clean] !== undefined) return true;
  return false;
}

/**
 * Evaluates an Egyptian Arabic spoken number phrase into a float value.
 * Handles conjunctions ("و"), compounds ("خمسة وعشرين"), subtraction ("خمسمية إلا عشرة"),
 * and fractional add-ons ("مية وخمسين ونص").
 */
export function evaluateEgyptianSpokenNumber(phrase: string): number | null {
  const clean = removeDiacritics(phrase).trim();
  if (!clean) return null;

  // Direct numeric check
  const directNum = parseFloat(clean);
  if (!isNaN(directNum) && clean === directNum.toString()) {
    return directNum;
  }

  // Handle subtraction expressions: "X إلا Y" (e.g. "خمسمية إلا عشرة" -> 490)
  if (clean.includes(' إلا ')) {
    const [leftPart, rightPart] = clean.split(' إلا ');
    const leftVal = evaluateEgyptianSpokenNumber(leftPart.trim());
    const rightVal = evaluateEgyptianSpokenNumber(rightPart.trim());
    if (leftVal !== null && rightVal !== null) {
      return Math.max(0, leftVal - rightVal);
    }
  }

  // Split tokens by space
  const rawTokens = clean.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return null;

  let total = 0;
  let currentGroup = 0;
  let i = 0;

  while (i < rawTokens.length) {
    let token = rawTokens[i];

    // Strip leading 'و' (conjunction) if attached: e.g. "وعشرين" -> "عشرين"
    let hasLeadingWaw = false;
    if (token.startsWith('و') && token.length > 1 && !['واحد', 'واحدة'].includes(token)) {
      const rest = token.substring(1);
      if (isNumberWord(rest) || FRACTIONS_MAP[rest] !== undefined) {
        token = rest;
        hasLeadingWaw = true;
      }
    }

    if (token === 'و') {
      // Standalone conjunction, skip to next number token
      i++;
      continue;
    }

    // Digits inside phrase
    if (/^[0-9]+(\.[0-9]+)?$/.test(token)) {
      const val = parseFloat(token);
      currentGroup += val;
      i++;
      continue;
    }

    // Fractions
    if (FRACTIONS_MAP[token] !== undefined) {
      currentGroup += FRACTIONS_MAP[token];
      i++;
      continue;
    }

    // Thousands & Millions
    if (THOUSANDS_MAP[token] !== undefined) {
      const mult = THOUSANDS_MAP[token];
      // If preceding had a count (e.g. "خمس" in "خمس تلاف"), multiply it; otherwise if currentGroup is 0, default 1
      const count = currentGroup === 0 ? 1 : currentGroup;
      total += count * mult;
      currentGroup = 0;
      i++;
      continue;
    }

    // Hundreds
    if (HUNDREDS_MAP[token] !== undefined) {
      currentGroup += HUNDREDS_MAP[token];
      i++;
      continue;
    }

    // Tens
    if (TENS_MAP[token] !== undefined) {
      currentGroup += TENS_MAP[token];
      i++;
      continue;
    }

    // Teens
    if (TEEN_MAP[token] !== undefined) {
      currentGroup += TEEN_MAP[token];
      i++;
      continue;
    }

    // Units
    if (UNIT_MAP[token] !== undefined) {
      // Check if followed by "مية" or "تلاف" (e.g. "تلاتة مية" or "خمسة آلاف")
      const nextToken = rawTokens[i + 1];
      if (nextToken === 'مية' || nextToken === 'ميه' || nextToken === 'مائة') {
        currentGroup += UNIT_MAP[token] * 100;
        i += 2;
        continue;
      }
      if (nextToken && THOUSANDS_MAP[nextToken] !== undefined) {
        currentGroup += UNIT_MAP[token];
        i++;
        continue;
      }

      currentGroup += UNIT_MAP[token];
      i++;
      continue;
    }

    // Unknown word in numeric phrase - stop or invalid
    return null;
  }

  total += currentGroup;
  return total > 0 ? total : null;
}

/**
 * Extracts candidate amounts and currencies from normalized text.
 * Respects corrections such as "خمسين، لأ، ستين" (takes 60).
 */
export function extractAmounts(
  text: string,
  defaultCurrency = 'EGP',
): ParsedAmountResult[] {
  const converted = convertArabicIndicDigits(text);
  const words = converted.split(/\s+/).filter(Boolean);
  const results: ParsedAmountResult[] = [];

  let i = 0;
  while (i < words.length) {
    // Check if current word is a digit or number word
    let word = words[i];
    let strippedWaw = false;
    if (word.startsWith('و') && word.length > 1 && !['واحد', 'واحدة'].includes(word)) {
      if (isNumberWord(word.substring(1))) {
        word = word.substring(1);
        strippedWaw = true;
      }
    }

    // Check if this number is actually a day number of a date phrase (e.g. "يوم 15 أكتوبر" or "15 أكتوبر")
    const isPrecededByYom = i > 0 && words[i - 1] === 'يوم';
    const isFollowedByMonth =
      i + 1 < words.length &&
      Boolean(
        words[i + 1] &&
          (words[i + 1] === 'يناير' ||
            words[i + 1] === 'فبراير' ||
            words[i + 1] === 'مارس' ||
            words[i + 1] === 'ابريل' ||
            words[i + 1] === 'أبريل' ||
            words[i + 1] === 'مايو' ||
            words[i + 1] === 'يونيو' ||
            words[i + 1] === 'يونيه' ||
            words[i + 1] === 'يوليو' ||
            words[i + 1] === 'يوليه' ||
            words[i + 1] === 'اغسطس' ||
            words[i + 1] === 'أغسطس' ||
            words[i + 1] === 'سبتمبر' ||
            words[i + 1] === 'اكتوبر' ||
            words[i + 1] === 'أكتوبر' ||
            words[i + 1] === 'نوفمبر' ||
            words[i + 1] === 'ديسمبر'),
      );

    if (isFollowedByMonth) {
      i++;
      continue;
    }

    if (isNumberWord(word) || /^[0-9]+(\.[0-9]+)?$/.test(word)) {
      // Collect contiguous sequence of number tokens and conjunctions
      const numTokens: string[] = [words[i]];
      let j = i + 1;

      while (j < words.length) {
        const nextWord = words[j];
        if (
          isNumberWord(nextWord) ||
          /^[0-9]+(\.[0-9]+)?$/.test(nextWord) ||
          nextWord === 'و' ||
          nextWord === 'إلا' ||
          (nextWord.startsWith('و') && isNumberWord(nextWord.substring(1)))
        ) {
          numTokens.push(nextWord);
          j++;
        } else {
          break;
        }
      }

      const phrase = numTokens.join(' ');
      const evaluated = evaluateEgyptianSpokenNumber(phrase);

      if (evaluated !== null && evaluated > 0) {
        // Look ahead for currency
        let currency = defaultCurrency;
        let currencyEndIndex = j;

        if (j < words.length) {
          const possibleCurrency = words[j].toLowerCase();
          if (CURRENCY_KEYWORDS[possibleCurrency]) {
            currency = CURRENCY_KEYWORDS[possibleCurrency];
            currencyEndIndex = j + 1;
          }
        }

        // Check if followed by correction: "، لأ، [number]" or "لا ستين"
        let finalAmount = evaluated;
        let isCorrection = false;
        let checkIdx = currencyEndIndex;

        // Skip commas or punctuation if any
        while (checkIdx < words.length && (words[checkIdx] === '،' || words[checkIdx] === ',')) {
          checkIdx++;
        }

        if (
          checkIdx < words.length &&
          (words[checkIdx] === 'لأ' ||
            words[checkIdx] === 'لا' ||
            words[checkIdx] === 'مش' ||
            words[checkIdx] === 'قصدي')
        ) {
          // Correction keyword encountered
          let afterCorrIdx = checkIdx + 1;
          while (afterCorrIdx < words.length && (words[afterCorrIdx] === '،' || words[afterCorrIdx] === ',')) {
            afterCorrIdx++;
          }

          if (afterCorrIdx < words.length && (isNumberWord(words[afterCorrIdx]) || /^[0-9]+(\.[0-9]+)?$/.test(words[afterCorrIdx]))) {
            // Collect the corrected number tokens
            const corrTokens: string[] = [words[afterCorrIdx]];
            let corrEnd = afterCorrIdx + 1;
            while (corrEnd < words.length) {
              const nextWord = words[corrEnd];
              if (
                isNumberWord(nextWord) ||
                /^[0-9]+(\.[0-9]+)?$/.test(nextWord) ||
                nextWord === 'و' ||
                (nextWord.startsWith('و') && isNumberWord(nextWord.substring(1)))
              ) {
                corrTokens.push(nextWord);
                corrEnd++;
              } else {
                break;
              }
            }
            const correctedVal = evaluateEgyptianSpokenNumber(corrTokens.join(' '));
            if (correctedVal !== null) {
              finalAmount = correctedVal;
              isCorrection = true;
              currencyEndIndex = corrEnd;
            }
          }
        }

        results.push({
          amount: finalAmount,
          currency,
          sourceText: phrase,
          startIndex: i,
          endIndex: currencyEndIndex,
          isAmbiguous: isCorrection,
          reason: isCorrection ? 'تم تصحيح المبلغ وفقاً لتراجع المستخدم في الجملة' : undefined,
          alternatives: isCorrection ? [evaluated, finalAmount] : undefined,
        });

        i = currencyEndIndex;
        continue;
      }
    }

    i++;
  }

  return results;
}
