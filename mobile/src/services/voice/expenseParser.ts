/**
 * Deterministic Expense Parser and Multi-Expense Segmenter.
 *
 * Implements:
 * - Negation and non-expense detection (e.g. "ما دفعتش حاجة", "استرديت 50", "حولت 100").
 * - Multi-expense utterance segmentation (e.g. "دفعت تلتمية وخمسين جنيه غدا امبارح وعشرين جنيه مواصلات النهارده").
 *   Avoids splitting on conjunctions inside compound numbers (like "مئتين وخمسين").
 * - Structured candidate generation conforming to typed contracts.
 * - Explicit ambiguity detection and reason generation.
 */

import { normalizeArabicTranscript, removeDiacritics } from './normalizer';
import { extractAmounts, isNumberWord } from './amountParser';
import { extractDate } from './dateParser';
import { matchCategory } from './categoryMatcher';
import { ExpenseCandidate, ExpenseParseResult, ParserOptions } from './types';

// Negation patterns in Egyptian Arabic indicating no transaction occurred
const NEGATION_PATTERNS = [
  /ما\s*دفعتش\s*حاج[ةه]/,
  /ما\s*صرفت\s*حاج[ةه]/,
  /ما\s*فيش\s*مصاريف/,
  /ما\s*دفعت\s*شيء/,
  /ما\s*صرفت\s*شيء/,
  /ما\s*دفعتش\s*فلوس/,
];

// Refund, reimbursement or income statements that should not be parsed as an ordinary expense
const NON_EXPENSE_PATTERNS = [
  /استرديت/,
  /استرجعت/,
  /استرداد/,
  /جالي\s*فلوس/,
  /قبضت/,
  /حولت\s*لأخويا/,
  /سلف/,
];

// Expense trigger verbs
const EXPENSE_TRIGGERS = [
  'دفعت', 'صرفت', 'اشتريت', 'جبت', 'حاسبت', 'دفعتهم', 'أكلت', 'ركبت',
];

/**
 * Checks whether the text expresses complete negation of spending.
 */
export function isNegatedUtterance(text: string): boolean {
  return NEGATION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Checks whether the text indicates a refund, reimbursement, or transfer.
 */
export function hasNonExpenseIntent(text: string): boolean {
  return NON_EXPENSE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Segments an utterance into distinct expense clause substrings.
 * Splits on explicit clause separators, newlines, or conjunction 'و' when followed by another distinct amount.
 */
export function segmentUtterance(rawText: string): string[] {
  const normalized = normalizeArabicTranscript(rawText);

  // If the clause contains a self-correction phrase like "، لأ،" or "، لا،", protect it from splitting
  const protectedText = normalized.replace(/\s*[،,]\s*(لأ|لا|مش|قصدي)\s*[،,]?\s*/g, ' _CORR_$1_ ');

  // Split on clause punctuation: commas, semicolons, periods
  const initialClauses = protectedText
    .split(/[،؛.]/)
    .map((s) => s.replace(/_CORR_(\S+)_/g, ' ، $1 ، ').trim())
    .filter(Boolean);

  const finalSegments: string[] = [];

  for (const clause of initialClauses) {
    // Detect all amounts in this clause
    const amounts = extractAmounts(clause);

    if (amounts.length <= 1) {
      finalSegments.push(clause);
      continue;
    }

    // If clause contains a self-correction, treat entire clause as single candidate
    if (amounts.some((a) => a.isAmbiguous && a.alternatives?.length)) {
      finalSegments.push(clause);
      continue;
    }

    const words = clause.split(/\s+/).filter(Boolean);
    let lastSplitIdx = 0;

    for (let i = 1; i < amounts.length; i++) {
      const prevAmt = amounts[i - 1];
      const currAmt = amounts[i];

      // Find the boundary between prevAmt.endIndex and currAmt.startIndex
      let splitPoint = currAmt.startIndex;
      for (let k = prevAmt.endIndex; k < currAmt.startIndex; k++) {
        if (words[k] === 'و' || words[k] === 'ثم' || words[k] === 'كمان' || words[k] === 'برضه') {
          splitPoint = k + 1;
          break;
        }
      }

      const segmentText = words.slice(lastSplitIdx, splitPoint > currAmt.startIndex ? currAmt.startIndex : splitPoint).join(' ').trim();
      if (segmentText) {
        finalSegments.push(segmentText);
      }
      lastSplitIdx = splitPoint > currAmt.startIndex ? currAmt.startIndex : splitPoint;
    }

    const remaining = words.slice(lastSplitIdx).join(' ').trim();
    if (remaining) {
      finalSegments.push(remaining);
    }
  }

  return finalSegments.length > 0 ? finalSegments : [normalized];
}

/**
 * Cleans extracted description words by removing known financial keywords,
 * numbers, currencies, dates, and trigger verbs.
 */
function extractCleanDescription(
  segmentText: string,
  amountSourceText?: string,
  dateSourceText?: string,
): string {
  let cleaned = segmentText;

  if (amountSourceText) {
    cleaned = cleaned.replace(amountSourceText, ' ');
  }
  if (dateSourceText) {
    cleaned = cleaned.replace(dateSourceText, ' ');
  }

  // Remove common trigger verbs
  for (const trigger of EXPENSE_TRIGGERS) {
    cleaned = cleaned.replace(new RegExp(`\\b${trigger}\\b`, 'g'), ' ');
  }

  // Remove currency words
  cleaned = cleaned.replace(/\b(جنيه|جنيهات|جنية|ج\.م|دولار|يورو|ريال|درهم|egp|usd)\b/gi, ' ');

  // Remove solitary conjunctions and prepositions
  cleaned = cleaned.replace(/\b(في|على|من|عن|مع|بتاع|بتاعت|علشان|عشان|و)\b/g, ' ');

  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * Main Deterministic Expense Parser.
 */
export function parseExpenseUtterance(
  transcript: string,
  options: ParserOptions = {},
): ExpenseParseResult {
  const originalTranscript = transcript || '';
  const normalizedTranscript = normalizeArabicTranscript(originalTranscript);
  const warnings: string[] = [];

  if (!normalizedTranscript) {
    return {
      originalTranscript,
      normalizedTranscript,
      candidates: [],
      warnings: ['النص الصوتي فارغ، لم يتم تسجيل أي كلمات.'],
    };
  }

  // Check for complete spending negation
  if (isNegatedUtterance(normalizedTranscript)) {
    return {
      originalTranscript,
      normalizedTranscript,
      candidates: [],
      warnings: ['أشار التسجيل الصوتي إلى عدم إنفاق أي مبالغ ("ما دفعتش حاجة").'],
      isNegationOrNonExpense: true,
    };
  }

  // Check for refund or non-expense statement
  if (hasNonExpenseIntent(normalizedTranscript)) {
    warnings.push(
      'تحتوي العبارة على دلالات استرداد أو تحويل أو دخل. يرجى مراجعة المعاملة بدقة.',
    );
  }

  const defaultCurrency = options.defaultCurrency || 'EGP';
  const referenceDate = options.referenceDate || new Date();
  const categories = options.categories || [];
  const defaultAccountId = options.defaultAccountId;

  // Segment utterance into distinct transaction clauses
  const segments = segmentUtterance(normalizedTranscript);
  const candidates: ExpenseCandidate[] = [];

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const segment = segments[sIdx];
    const candidateId = `cand-${Date.now()}-${sIdx}-${Math.random().toString(36).substring(2, 6)}`;
    const unresolvedFields: string[] = [];

    // 1. Amount Extraction
    const amounts = extractAmounts(segment, defaultCurrency);
    let parsedAmountValue: number | null = null;
    let amountStatus: 'resolved' | 'ambiguous' | 'missing' | 'invalid' = 'missing';
    let amountSourceText: string | undefined;
    let amountReason: string | undefined;
    let alternatives: number[] | undefined;

    if (amounts.length === 0) {
      amountStatus = 'missing';
      amountReason = 'لم يتم العثور على مبلغ محدد في هذه الجملة';
      unresolvedFields.push('amount');
    } else if (amounts.length === 1) {
      const single = amounts[0];
      parsedAmountValue = single.amount;
      amountSourceText = single.sourceText;
      if (single.isAmbiguous) {
        amountStatus = 'ambiguous';
        amountReason = single.reason;
        alternatives = single.alternatives;
        unresolvedFields.push('amount');
      } else {
        amountStatus = 'resolved';
      }
    } else {
      // Multiple amounts in a single subsegment -> ambiguous
      parsedAmountValue = amounts[0].amount;
      amountStatus = 'ambiguous';
      amountReason = 'تم العثور على أكثر من مبلغ في نفس الجملة';
      alternatives = amounts.map((a) => a.amount).filter((a): a is number => a !== null);
      unresolvedFields.push('amount');
    }

    // 2. Currency
    const detectedCurrency = amounts.length > 0 ? amounts[0].currency : defaultCurrency;

    // 3. Date Extraction
    const dateResult = extractDate(segment, referenceDate);
    const parsedDate = dateResult ? dateResult.date : referenceDate.toISOString().split('T')[0];
    const dateStatus = dateResult
      ? dateResult.isAmbiguous
        ? 'ambiguous'
        : 'resolved'
      : 'resolved';

    if (dateResult?.isAmbiguous) {
      unresolvedFields.push('date');
    }

    // 4. Description Extraction
    const cleanDesc = extractCleanDescription(
      segment,
      amounts[0]?.sourceText,
      dateResult?.sourceText,
    );
    const descStatus = cleanDesc.length > 0 ? 'resolved' : 'missing';
    if (descStatus === 'missing') {
      unresolvedFields.push('description');
    }

    // 5. Category Matching
    const categoryMatch = matchCategory(segment, categories);
    let categoryIdVal: string | null = null;
    let categoryNameVal: string | undefined;
    let categoryStatus: 'resolved' | 'ambiguous' | 'missing' | 'invalid' = 'missing';
    let categoryReason: string | undefined;

    if (categoryMatch) {
      categoryIdVal = categoryMatch.categoryId;
      categoryNameVal = categoryMatch.categoryName;
      categoryStatus = categoryMatch.isAmbiguous ? 'ambiguous' : 'resolved';
      if (categoryMatch.isAmbiguous) {
        unresolvedFields.push('categoryId');
      }
    } else {
      categoryStatus = 'missing';
      categoryReason = 'لم يتم تحديد تصنيف مناسب تلقائياً';
      unresolvedFields.push('categoryId');
    }

    // Construct the structured candidate
    candidates.push({
      id: candidateId,
      amount: {
        value: parsedAmountValue,
        status: amountStatus,
        sourceText: amountSourceText,
        reason: amountReason,
        alternatives,
      },
      currency: {
        value: detectedCurrency,
        status: 'resolved',
      },
      categoryId: {
        value: categoryIdVal,
        status: categoryStatus,
        reason: categoryReason,
      },
      categoryName: categoryNameVal,
      date: {
        value: parsedDate,
        status: dateStatus,
        sourceText: dateResult?.sourceText,
        reason: dateResult?.reason,
      },
      description: {
        value: cleanDesc || null,
        status: descStatus,
        sourceText: cleanDesc,
      },
      accountId: defaultAccountId,
      unresolvedFields,
      isManuallyEdited: false,
    });
  }

  return {
    originalTranscript,
    normalizedTranscript,
    candidates,
    warnings,
  };
}

export const parseExpenses = parseExpenseUtterance;

