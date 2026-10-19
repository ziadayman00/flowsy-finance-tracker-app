import {
  toCents,
  fromCents,
  moneyAdd,
  moneySubtract,
  moneyCompare,
  moneyIsNegative,
  moneyIsPositive,
  moneyIsZero,
  moneyAbs,
} from '../src/utils/money';
import {
  formatMoney,
  formatMoneyParts,
  normalizeAmountInput,
  getCurrencySymbol,
} from '../src/utils/format';
import { displayName } from '../src/utils/names';
import {
  formatPlural,
  formatCommitmentsCount,
  formatTransactionsCount,
} from '../src/utils/plural';
import { calculateSplitGeometry } from '../src/utils/splitLine';
import { mapBackendError } from '../src/utils/errors';
import {
  buildCreateTransactionPayload,
  buildCreateCommitmentPayload,
  buildCreateAccountPayload,
} from '../src/utils/payloads';
import { TransactionType, AccountType } from '../src/api/types';

describe('Foundations - Exact Decimal Money Math', () => {
  it('solves 0.10 + 0.20 float pitfall exactly', () => {
    expect(moneyAdd('0.10', '0.20')).toBe('0.30');
    expect(0.1 + 0.2).not.toBe(0.3); // Proves float problem exists in raw JS
  });

  it('handles large monetary amounts up to 999,999,999,999.99', () => {
    const large = '999999999999.99';
    expect(toCents(large).toString()).toBe('99999999999999');
    expect(fromCents(toCents(large))).toBe(large);
  });

  it('handles negative amounts and subtraction correctly', () => {
    expect(moneySubtract('100.00', '150.00')).toBe('-50.00');
    expect(moneyIsNegative('-50.00')).toBe(true);
    expect(moneyAbs('-50.00')).toBe('50.00');
  });

  it('compares amounts correctly', () => {
    expect(moneyCompare('250.50', '250.50')).toBe(0);
    expect(moneyCompare('250.50', '300.00')).toBe(-1);
    expect(moneyCompare('500.00', '300.00')).toBe(1);
  });
});

describe('Foundations - Format & Numerals', () => {
  it('formats money with Arabic-Indic digits and Arabic separators', () => {
    const formatted = formatMoney('1250.50', 'EGP');
    expect(formatted).toBe('١٬٢٥٠٫٥٠ ج.م');
  });

  it('formats negative amounts with U+2212 minus sign', () => {
    const formatted = formatMoney('-450.00', 'EGP');
    expect(formatted).toBe('\u2212٤٥٠٫٠٠ ج.م');
  });

  it('normalizes Arabic-Indic digits and decimal commas into standard numbers', () => {
    expect(normalizeAmountInput('١٢٥٠٫٥٠')).toBe('1250.50');
    expect(normalizeAmountInput('٣٥٠,٧٥')).toBe('350.75');
    expect(normalizeAmountInput('abc45.50xyz')).toBe('45.50');
  });

  it('returns appropriate currency symbols', () => {
    expect(getCurrencySymbol('EGP')).toBe('ج.م');
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('SAR')).toBe('ر.س');
  });
});

describe('Foundations - Bilingual Names', () => {
  it('extracts the Arabic segment from combined names', () => {
    expect(displayName('كاش / Cash')).toBe('كاش');
    expect(displayName('البنك الأهلي المصري / NBE')).toBe('البنك الأهلي المصري');
    expect(displayName('Groceries / بقالة ومستلزمات')).toBe('بقالة ومستلزمات');
  });

  it('preserves single language names unchanged', () => {
    expect(displayName('سوبرماركت زهران')).toBe('سوبرماركت زهران');
    expect(displayName('Vodafone Cash')).toBe('Vodafone Cash');
  });
});

describe('Foundations - Arabic Pluralization', () => {
  it('applies singular, dual, and plural grammatical rules', () => {
    expect(formatCommitmentsCount(1)).toBe('التزام');
    expect(formatCommitmentsCount(2)).toBe('التزامين');
    expect(formatCommitmentsCount(3)).toBe('3 التزامات');
    expect(formatCommitmentsCount(10)).toBe('10 التزامات');
    expect(formatCommitmentsCount(11)).toBe('11 التزام');
    expect(formatCommitmentsCount(25)).toBe('25 التزام');
  });

  it('formats transaction count plurals', () => {
    expect(formatTransactionsCount(1)).toBe('معاملة');
    expect(formatTransactionsCount(2)).toBe('معاملتين');
    expect(formatTransactionsCount(5)).toBe('5 معاملات');
  });
});

describe('Foundations - Split Line Geometry', () => {
  it('computes exact available and committed ratios when funds exceed commitments', () => {
    // 20,000 liquid, 5,000 commitments => 25% committed, 75% available
    const geo = calculateSplitGeometry('20000.00', '5000.00');
    expect(geo.isDeficit).toBe(false);
    expect(geo.committedRatio).toBe(0.25);
    expect(geo.availableRatio).toBe(0.75);
  });

  it('computes deficit when commitments exceed liquid funds', () => {
    // 10,000 liquid, 14,000 commitments => deficit of 4,000
    const geo = calculateSplitGeometry('10000.00', '14000.00');
    expect(geo.isDeficit).toBe(true);
    expect(geo.deficitAmount).toBe('4000.00');
    expect(geo.committedRatio).toBe(1);
    expect(geo.availableRatio).toBe(0);
  });

  it('handles zero or negative liquid funds gracefully', () => {
    const geo = calculateSplitGeometry('0.00', '3000.00');
    expect(geo.isDeficit).toBe(true);
    expect(geo.deficitAmount).toBe('3000.00');
  });
});

describe('Foundations - Error Mapping', () => {
  it('maps network errors to Arabic network guidance', () => {
    const err = mapBackendError(0, 'NetworkError', 'Failed to fetch');
    expect(err.isNetworkOrTimeout).toBe(true);
    expect(err.message).toContain('مفيش اتصال بالخادم');
  });

  it('maps 401 invalid refresh to session expired message', () => {
    const err = mapBackendError(401, 'Unauthorized', 'Invalid refresh token');
    expect(err.message).toContain('انتهت مدة تسجيل الدخول');
  });

  it('maps cross-currency transfer error to clear Arabic restriction', () => {
    const err = mapBackendError(400, 'BadRequest', 'Cross-currency transfers are not supported');
    expect(err.message).toContain('مش ممكن تحوّل بين حسابين بعملتين مختلفتين');
  });

  it('maps duplicate email 409 to field error', () => {
    const err = mapBackendError(409, 'Conflict', 'An account with this email address already exists');
    expect(err.fieldErrors?.email).toBeDefined();
  });
});

describe('Foundations - Strict Payload Builders', () => {
  it('strips categoryId from TRANSFER transactions', () => {
    const payload = buildCreateTransactionPayload({
      type: 'TRANSFER',
      amount: 500,
      accountId: 'acc-1',
      destinationAccountId: 'acc-2',
      categoryId: 'cat-should-be-omitted',
    });

    expect(payload.type).toBe('TRANSFER');
    expect(payload.categoryId).toBeUndefined();
    expect(payload.destinationAccountId).toBe('acc-2');
    expect(payload.amount).toBe(500);
  });

  it('formats decimals to fixed 2-dp float numbers', () => {
    const payload = buildCreateTransactionPayload({
      type: 'EXPENSE',
      amount: '250.755', // will be clamped to 250.75
      accountId: 'acc-1',
    });
    expect(payload.amount).toBe(250.75);
  });
});
