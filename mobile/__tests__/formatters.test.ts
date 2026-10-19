import {
  formatCurrency,
  formatDate,
  getDaysRemaining,
  formatTransactionDate,
  formatCommitmentDueDate,
} from '../src/utils/formatters';

describe('Formatters Utility', () => {
  describe('formatCurrency', () => {
    it('formats Egyptian Pound with comma grouping and 2 decimal places', () => {
      expect(formatCurrency('14350.00', 'EGP', 'ar')).toBe('١٤٬٣٥٠٫٠٠ ج.م');
      expect(formatCurrency('14350.00', 'EGP', 'en')).toBe('EGP 14,350.00');
    });

    it('formats numbers under one thousand correctly', () => {
      expect(formatCurrency('250.50', 'EGP', 'ar')).toBe('٢٥٠٫٥٠ ج.م');
      expect(formatCurrency('0.00', 'EGP', 'ar')).toBe('٠٫٠٠ ج.م');
    });

    it('handles negative monetary amounts without floating point errors', () => {
      expect(formatCurrency('-850.75', 'EGP', 'ar')).toBe('-٨٥٠٫٧٥ ج.م');
      expect(formatCurrency('-850.75', 'EGP', 'en')).toBe('-EGP 850.75');
    });

    it('formats foreign currencies with their respective symbols', () => {
      expect(formatCurrency('500.00', 'USD', 'ar')).toBe('٥٠٠٫٠٠ $');
      expect(formatCurrency('500.00', 'USD', 'en')).toBe('$ 500.00');
      expect(formatCurrency('1200.00', 'EUR', 'ar')).toBe('١٬٢٠٠٫٠٠ €');
      expect(formatCurrency('3500.00', 'SAR', 'ar')).toBe('٣٬٥٠٠٫٠٠ ر.س');
      expect(formatCurrency('400.00', 'AED', 'ar')).toBe('٤٠٠٫٠٠ د.إ');
    });

    it('handles number inputs by converting them accurately', () => {
      expect(formatCurrency(1500, 'EGP', 'ar')).toBe('١٬٥٠٠٫٠٠ ج.م');
      expect(formatCurrency(99.9, 'EGP', 'ar')).toBe('٩٩٫٩٠ ج.م');
    });
  });

  describe('formatDate', () => {
    it('returns relative "اليوم" / "Today" for current date', () => {
      const now = new Date();
      expect(formatDate(now.toISOString(), 'ar')).toBe('اليوم');
      expect(formatDate(now.toISOString(), 'en')).toBe('Today');
    });

    it('returns relative "غداً" / "Tomorrow" for next day', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(formatDate(tomorrow.toISOString(), 'ar')).toBe('غداً');
      expect(formatDate(tomorrow.toISOString(), 'en')).toBe('Tomorrow');
    });

    it('returns relative "أمس" / "Yesterday" for previous day', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(formatDate(yesterday.toISOString(), 'ar')).toBe('أمس');
      expect(formatDate(yesterday.toISOString(), 'en')).toBe('Yesterday');
    });

    it('returns month and day for past or future dates beyond adjacent days', () => {
      const fixedDate = new Date(2026, 0, 15); // 15 Jan 2026
      expect(formatDate(fixedDate.toISOString(), 'ar')).toContain('١٥ يناير');
      expect(formatDate(fixedDate.toISOString(), 'en')).toBe('Jan 15');
    });
  });

  describe('getDaysRemaining and formatCommitmentDueDate', () => {
    it('identifies overdue dates correctly', () => {
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 3);

      const remaining = getDaysRemaining(overdueDate);
      expect(remaining.isOverdue).toBe(true);
      expect(remaining.days).toBeGreaterThanOrEqual(2);

      const label = formatCommitmentDueDate(overdueDate, 'ar');
      expect(label).toContain('متأخر منذ');
    });

    it('identifies today due dates correctly', () => {
      const todayDate = new Date();
      const label = formatCommitmentDueDate(todayDate, 'ar');
      expect(label).toBe('مستحق اليوم');
    });

    it('identifies future upcoming dates correctly', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const remaining = getDaysRemaining(futureDate);
      expect(remaining.isOverdue).toBe(false);

      const label = formatCommitmentDueDate(futureDate, 'ar');
      expect(label).toContain('مستحق خلال');
    });
  });
});
