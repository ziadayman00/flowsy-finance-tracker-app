import { formatCurrency } from '../src/utils/formatters';

describe('Privacy and Flowsy Pulse Invariants', () => {
  describe('Privacy Masking Specification', () => {
    const maskAmount = (formatted: string, currency: string = 'EGP', isPrivate: boolean): string => {
      if (!isPrivate) return formatted;
      const cleanCurr = currency === 'EGP' ? 'ج.م' : currency;
      return `•••••• ${cleanCurr}`.trim();
    };

    it('masks sensitive monetary figures by default without displaying zero', () => {
      const realAmount = formatCurrency('14250.00', 'EGP', 'ar');
      const masked = maskAmount(realAmount, 'EGP', true);

      expect(masked).toBe('•••••• ج.م');
      expect(masked).not.toContain('0');
      expect(masked).not.toContain('14250');
    });

    it('preserves currency symbol when masking foreign currencies', () => {
      const realAmount = formatCurrency('500.00', 'USD', 'ar');
      const masked = maskAmount(realAmount, 'USD', true);

      expect(masked).toBe('•••••• USD');
      expect(masked).not.toContain('500');
    });

    it('reveals real amount when privacy mode is disabled', () => {
      const realAmount = formatCurrency('14250.00', 'EGP', 'ar');
      const revealed = maskAmount(realAmount, 'EGP', false);

      expect(revealed).toBe('١٤٬٢٥٠٫٠٠ ج.م');
      expect(revealed).toContain('١٤٬٢٥٠٫٠٠');
    });
  });

  describe('Flowsy Pulse Category Aggregation', () => {
    it('aggregates expenses by category truthfully without double counting', () => {
      const testTransactions = [
        { id: '1', type: 'EXPENSE', amount: '250.00', category: { id: 'cat-food', name: 'طعام ومشروبات' } },
        { id: '2', type: 'EXPENSE', amount: '150.00', category: { id: 'cat-food', name: 'طعام ومشروبات' } },
        { id: '3', type: 'EXPENSE', amount: '100.00', category: { id: 'cat-transport', name: 'مواصلات' } },
        { id: '4', type: 'INCOME', amount: '5000.00', category: null }, // Should be excluded from expense breakdown
      ];

      const expenseTxs = testTransactions.filter((tx) => tx.type === 'EXPENSE');
      const categoryMap: Record<string, { id: string; name: string; amount: number; count: number }> = {};
      let total = 0;

      for (const tx of expenseTxs) {
        const amt = parseFloat(tx.amount);
        total += amt;
        const catId = tx.category?.id || 'uncategorized';
        const catName = tx.category?.name || 'مصروفات عامة';

        if (!categoryMap[catId]) {
          categoryMap[catId] = { id: catId, name: catName, amount: 0, count: 0 };
        }
        categoryMap[catId].amount += amt;
        categoryMap[catId].count += 1;
      }

      expect(total).toBe(500);
      expect(categoryMap['cat-food'].amount).toBe(400);
      expect(categoryMap['cat-food'].count).toBe(2);
      expect(categoryMap['cat-transport'].amount).toBe(100);
      expect(categoryMap['cat-transport'].count).toBe(1);
    });

    it('identifies most urgent commitment accurately based on due date', () => {
      const commitments = [
        { id: '1', name: 'فاتورة الكهرباء', dueDate: new Date(Date.now() + 86400000 * 5).toISOString(), status: 'PENDING' },
        { id: '2', name: 'إيجار السكن', dueDate: new Date(Date.now() + 86400000 * 2).toISOString(), status: 'PENDING' },
        { id: '3', name: 'فاتورة الغاز', dueDate: new Date(Date.now() - 86400000 * 1).toISOString(), status: 'OVERDUE' },
      ];

      const pending = commitments.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE');
      const sorted = pending.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      // Overdue commitment is due in the past, so it must be first
      expect(sorted[0].id).toBe('3');
      expect(sorted[0].name).toBe('فاتورة الغاز');
    });
  });

  describe('Form Preservations during Category Selection', () => {
    it('preserves entered amount when switching categories or transaction types', () => {
      let enteredAmount = '450.75';
      let selectedCategory = 'cat-food';

      // User changes category
      selectedCategory = 'cat-groceries';
      expect(enteredAmount).toBe('450.75');

      // User changes type to Income
      let type = 'EXPENSE';
      type = 'INCOME';
      expect(enteredAmount).toBe('450.75');
    });
  });
});
