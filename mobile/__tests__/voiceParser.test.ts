import { normalizeArabicTranscript, convertArabicIndicDigits } from '../src/services/voice/normalizer';
import { evaluateEgyptianSpokenNumber, extractAmounts } from '../src/services/voice/amountParser';
import { extractDate } from '../src/services/voice/dateParser';
import { matchCategory } from '../src/services/voice/categoryMatcher';
import { parseExpenseUtterance, segmentUtterance } from '../src/services/voice/expenseParser';
import { CategoryAliasItem } from '../src/services/voice/types';

describe('Egyptian Arabic Voice Expense Parser', () => {
  const fixedReferenceDate = new Date('2026-10-18T12:00:00.000Z');

  const mockCategories: CategoryAliasItem[] = [
    { id: 'cat-food', name: 'طعام ومشروبات' },
    { id: 'cat-transport', name: 'مواصلات وانتقالات' },
    { id: 'cat-bills', name: 'فواتير ومرافق' },
    { id: 'cat-shopping', name: 'تسوق وملابس' },
    { id: 'cat-health', name: 'صحة وعلاج' },
  ];

  describe('Arabic Normalizer', () => {
    it('converts Arabic-Indic digits to Western digits', () => {
      expect(convertArabicIndicDigits('١٢٥')).toBe('125');
      expect(convertArabicIndicDigits('دفعت ٥٠ جنيه')).toBe('دفعت 50 جنيه');
    });

    it('normalizes diacritics and spacing around conjunctions', () => {
      expect(normalizeArabicTranscript('دَفَعْتُ  ٣٥٠  جُنَيْهٍ')).toBe('دفعت 350 جنيه');
      expect(normalizeArabicTranscript('غدا امبارح وعشرين جنيه')).toContain('و عشرين');
    });
  });

  describe('Spoken Number Evaluation', () => {
    it('evaluates single and compound colloquial numbers correctly', () => {
      expect(evaluateEgyptianSpokenNumber('خمسين')).toBe(50);
      expect(evaluateEgyptianSpokenNumber('مية')).toBe(100);
      expect(evaluateEgyptianSpokenNumber('مية وخمسين')).toBe(150);
      expect(evaluateEgyptianSpokenNumber('تلتمية وخمسين')).toBe(350);
      expect(evaluateEgyptianSpokenNumber('تلاتمية وخمسين')).toBe(350);
      expect(evaluateEgyptianSpokenNumber('ألف وخمسمية')).toBe(1500);
      expect(evaluateEgyptianSpokenNumber('ميتين وخمسة وعشرين')).toBe(225);
      expect(evaluateEgyptianSpokenNumber('ألفين')).toBe(2000);
    });

    it('handles Egyptian colloquial subtraction expressions', () => {
      // "خمسمية إلا عشرة" = 490
      expect(evaluateEgyptianSpokenNumber('خمسمية إلا عشرة')).toBe(490);
      // "مية إلا ربع" = 99.75 or "مية إلا عشرين" = 80
      expect(evaluateEgyptianSpokenNumber('مية إلا عشرين')).toBe(80);
    });

    it('handles fractions', () => {
      expect(evaluateEgyptianSpokenNumber('مية وخمسين ونص')).toBe(150.5);
      expect(evaluateEgyptianSpokenNumber('ألفين وربع')).toBe(2000.25);
    });

    it('handles slang amounts in context', () => {
      expect(evaluateEgyptianSpokenNumber('باكو')).toBe(1000);
    });
  });

  describe('Amount & Currency Extraction', () => {
    it('extracts amounts and associated currencies accurately', () => {
      const res = extractAmounts('دفعت تلتمية وخمسين جنيه');
      expect(res).toHaveLength(1);
      expect(res[0].amount).toBe(350);
      expect(res[0].currency).toBe('EGP');
    });

    it('extracts non-EGP currencies when specified', () => {
      const res = extractAmounts('دفعت خمسين دولار');
      expect(res).toHaveLength(1);
      expect(res[0].amount).toBe(50);
      expect(res[0].currency).toBe('USD');
    });

    it('handles self-correction phrases without crashing or taking both', () => {
      // "دفعت خمسين، لأ، ستين"
      const res = extractAmounts('دفعت خمسين ، لأ ، ستين');
      expect(res).toHaveLength(1);
      expect(res[0].amount).toBe(60);
      expect(res[0].isAmbiguous).toBe(true);
      expect(res[0].alternatives).toEqual([50, 60]);
    });
  });

  describe('Relative & Explicit Date Parsing', () => {
    it('resolves "النهارده" to reference date', () => {
      const res = extractDate('النهارده', fixedReferenceDate);
      expect(res?.date).toBe('2026-10-18');
    });

    it('resolves "امبارح" to yesterday', () => {
      const res = extractDate('امبارح', fixedReferenceDate);
      expect(res?.date).toBe('2026-10-17');
    });

    it('resolves "أول امبارح" to two days ago', () => {
      const res = extractDate('اول امبارح', fixedReferenceDate);
      expect(res?.date).toBe('2026-10-16');
    });

    it('resolves explicit calendar date "15 أكتوبر"', () => {
      const res = extractDate('يوم 15 اكتوبر', fixedReferenceDate);
      expect(res?.date).toBe('2026-10-15');
    });

    it('resolves weekday expressions like "يوم الخميس"', () => {
      // Reference is Sunday 2026-10-18. Most recent past Thursday was 2026-10-15.
      const res = extractDate('يوم الخميس', fixedReferenceDate);
      expect(res?.date).toBe('2026-10-15');
    });
  });

  describe('Category Matching', () => {
    it('matches food category by Egyptian meal aliases', () => {
      const resLunch = matchCategory('غدا في الشغل', mockCategories);
      expect(resLunch?.categoryId).toBe('cat-food');

      const resDinner = matchCategory('عشا امبارح', mockCategories);
      expect(resDinner?.categoryId).toBe('cat-food');
    });

    it('matches transport category by vehicle/service keywords', () => {
      const resUber = matchCategory('أوبر للمكتب', mockCategories);
      expect(resUber?.categoryId).toBe('cat-transport');

      const resPetrol = matchCategory('بنزين للسيارة', mockCategories);
      expect(resPetrol?.categoryId).toBe('cat-transport');
    });

    it('matches bills category', () => {
      const res = matchCategory('فاتورة النت', mockCategories);
      expect(res?.categoryId).toBe('cat-bills');
    });
  });

  describe('Multi-Expense Segmentation & End-to-End Parsing', () => {
    it('segments dual-expense utterances properly without splitting numbers', () => {
      const text = 'دفعت تلتمية وخمسين جنيه غدا امبارح وعشرين جنيه مواصلات النهارده';
      const parsed = parseExpenseUtterance(text, {
        referenceDate: fixedReferenceDate,
        categories: mockCategories,
      });

      expect(parsed.candidates).toHaveLength(2);

      // Candidate 1: 350 EGP, Food, yesterday (2026-10-17)
      expect(parsed.candidates[0].amount.value).toBe(350);
      expect(parsed.candidates[0].currency.value).toBe('EGP');
      expect(parsed.candidates[0].categoryId.value).toBe('cat-food');
      expect(parsed.candidates[0].date.value).toBe('2026-10-17');

      // Candidate 2: 20 EGP, Transport, today (2026-10-18)
      expect(parsed.candidates[1].amount.value).toBe(20);
      expect(parsed.candidates[1].currency.value).toBe('EGP');
      expect(parsed.candidates[1].categoryId.value).toBe('cat-transport');
      expect(parsed.candidates[1].date.value).toBe('2026-10-18');
    });

    it('parses "دفعت 250 جنيه أكل و40 مواصلات"', () => {
      const text = 'دفعت 250 جنيه أكل و40 مواصلات';
      const parsed = parseExpenseUtterance(text, {
        referenceDate: fixedReferenceDate,
        categories: mockCategories,
      });

      expect(parsed.candidates).toHaveLength(2);
      expect(parsed.candidates[0].amount.value).toBe(250);
      expect(parsed.candidates[0].categoryId.value).toBe('cat-food');
      expect(parsed.candidates[1].amount.value).toBe(40);
      expect(parsed.candidates[1].categoryId.value).toBe('cat-transport');
    });

    it('detects spending negation "ما دفعتش حاجة" and yields zero candidates with warning', () => {
      const text = 'ما دفعتش حاجة النهارده';
      const parsed = parseExpenseUtterance(text, {
        referenceDate: fixedReferenceDate,
        categories: mockCategories,
      });

      expect(parsed.isNegationOrNonExpense).toBe(true);
      expect(parsed.candidates).toHaveLength(0);
      expect(parsed.warnings.length).toBeGreaterThan(0);
    });

    it('flags refund statements "استرديت 50" for review with warnings', () => {
      const text = 'دفعت 200 جنيه لأخويا واسترديت 50';
      const parsed = parseExpenseUtterance(text, {
        referenceDate: fixedReferenceDate,
        categories: mockCategories,
      });

      expect(parsed.warnings.length).toBeGreaterThan(0);
      expect(parsed.warnings[0]).toContain('استرداد');
    });
  });
});
