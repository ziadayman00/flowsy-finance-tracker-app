import {
  buildCreateTransactionPayload,
  buildUpdateTransactionPayload,
  buildCreateCommitmentPayload,
  buildPayCommitmentPayload,
  buildCreateBudgetPayload,
  buildUpdateBudgetPayload,
  buildCreateAccountPayload,
  buildUpdateAccountPayload,
} from '../src/utils/payloads';
import {
  toCents,
  fromCents,
  moneyAdd,
  moneySubtract,
  moneyCompare,
} from '../src/utils/money';
import { formatMoney } from '../src/utils/format';
import { getMonthBoundaries } from '../src/utils/dates';
import { getErrorMessage } from '../src/utils/errors';
import { strings } from '../src/utils/strings.ar';

describe('Journeys and Screen Invariants Tests', () => {
  describe('S11 — Add / Edit Transaction Payload Integrity', () => {
    it('creates EXPENSE payload without destinationAccountId', () => {
      const payload = buildCreateTransactionPayload({
        type: 'EXPENSE',
        amount: '150.50',
        accountId: 'acc-1',
        categoryId: 'cat-food',
        note: '   غداء عمل   ',
      });

      expect(payload).toEqual({
        type: 'EXPENSE',
        amount: 150.5,
        accountId: 'acc-1',
        categoryId: 'cat-food',
        note: 'غداء عمل',
      });
      expect(payload.destinationAccountId).toBeUndefined();
    });

    it('creates TRANSFER payload omitting categoryId even if provided', () => {
      const payload = buildCreateTransactionPayload({
        type: 'TRANSFER',
        amount: '500',
        accountId: 'acc-cash',
        destinationAccountId: 'acc-bank',
        categoryId: 'cat-food', // Should be omitted per backend whitelist rule
      });

      expect(payload.type).toBe('TRANSFER');
      expect(payload.amount).toBe(500);
      expect(payload.accountId).toBe('acc-cash');
      expect(payload.destinationAccountId).toBe('acc-bank');
      expect(payload.categoryId).toBeUndefined();
    });

    it('patches only changed fields on update', () => {
      const patch = buildUpdateTransactionPayload({
        amount: '200',
        note: 'تعديل',
      });

      expect(patch).toEqual({
        amount: 200,
        note: 'تعديل',
      });
      expect(patch.type).toBeUndefined();
      expect(patch.accountId).toBeUndefined();
    });
  });

  describe('S12 — Batch Quick Entry Exact Money Math', () => {
    it('computes exact decimal sum across drafts without IEEE-754 precision loss', () => {
      const amounts = ['0.10', '0.20', '350.55', '149.45', '1000.00'];
      let total = '0.00';
      for (const a of amounts) {
        total = moneyAdd(total, a);
      }
      expect(total).toBe('1500.30');
    });

    it('formats sum into bidi-safe display string', () => {
      const formatted = formatMoney('1500.30', 'EGP');
      expect(formatted).toContain('١٬٥٠٠٫٣٠');
      expect(formatted).toContain('ج.م');
    });
  });

  describe('S33 — Pay Commitment Derived Balance Logic', () => {
    it('derives exact positive balance after payment', () => {
      const accountBalance = '1000.00';
      const commitmentAmount = '350.00';

      const after = moneySubtract(accountBalance, commitmentAmount);

      expect(after).toBe('650.00');
      expect(moneyCompare(after, '0.00')).toBeGreaterThan(0);
    });

    it('detects negative balance condition after payment', () => {
      const accountBalance = '100.00';
      const commitmentAmount = '350.00';

      const after = moneySubtract(accountBalance, commitmentAmount);

      expect(after).toBe('-250.00');
      expect(moneyCompare(after, '0.00')).toBeLessThan(0);
    });

    it('builds pay payload without extraneous properties', () => {
      const payload = buildPayCommitmentPayload({
        accountId: 'acc-1',
        note: 'سداد إيجار',
      });

      expect(payload).toEqual({
        accountId: 'acc-1',
        note: 'سداد إيجار',
      });
      expect((payload as any).amount).toBeUndefined(); // Amount is strictly fixed on backend
    });
  });

  describe('S41a — Balance Correction Diff Computation', () => {
    it('computes positive diff as INCOME transaction', () => {
      const currentBalance = '500.00';
      const actualBalance = '750.00';

      const diff = moneySubtract(actualBalance, currentBalance);

      expect(moneyCompare(diff, '0.00')).toBe(1);
      expect(diff).toBe('250.00');
    });

    it('computes negative diff as EXPENSE transaction', () => {
      const currentBalance = '500.00';
      const actualBalance = '400.00';

      const diff = moneySubtract(actualBalance, currentBalance);

      expect(moneyCompare(diff, '0.00')).toBe(-1);
      expect(diff).toBe('-100.00');
    });
  });

  describe('S34 — Budget Date Boundary Calculations', () => {
    it('generates Cairo month boundaries correctly', () => {
      const refDate = new Date('2026-10-15T12:00:00Z');
      const { start, end } = getMonthBoundaries(refDate);

      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(9); // October (0-indexed)
      expect(start.getDate()).toBe(1);

      expect(end.getFullYear()).toBe(2026);
      expect(end.getMonth()).toBe(9);
      expect(end.getDate()).toBe(31);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
    });
  });

  describe('Section 13 — Egyptian Arabic Localization Dictionary', () => {
    it('has all required microcopy keys defined', () => {
      expect(strings.home.safeToSpendQuestion).toBe('تقدر تصرف كام؟');
      expect(strings.home.available).toBe('متاح');
      expect(strings.home.commitmentsThisMonth).toBe('التزامات الشهر');
      expect(strings.transactions.savedToast).toBe('اتسجّل');
      expect(strings.transactions.deletedToast).toBe('اتحذفت');
      expect(strings.transactions.undoAction).toBe('تراجع');
      expect(strings.accounts.availableForSpending).toContain('المتاح للصرف');
      expect(strings.settings.title).toBe('الإعدادات');
    });
  });
});
