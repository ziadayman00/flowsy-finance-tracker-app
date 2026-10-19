import { evaluateEgyptianSpokenNumber } from '../src/services/voice/amountParser';
import { parseExpenseUtterance } from '../src/services/voice/expenseParser';
import { CategoryAliasItem } from '../src/services/voice/types';

describe('Egyptian Arabic Adversarial and Boundary Corpus Evaluation', () => {
  const refDate = new Date('2026-10-18T12:00:00.000Z');

  const categories: CategoryAliasItem[] = [
    { id: 'cat-food', name: 'طعام ومشروبات' },
    { id: 'cat-transport', name: 'مواصلات وانتقالات' },
    { id: 'cat-bills', name: 'فواتير ومرافق' },
    { id: 'cat-shopping', name: 'تسوق وملابس' },
    { id: 'cat-health', name: 'صحة وعلاج' },
  ];

  const corpus = [
    {
      input: 'دفعت ألف وخمسمية جنيه',
      expectedAmount: 1500,
      expectedCategory: null,
      expectedCandidatesCount: 1,
    },
    {
      input: 'دفعت مية وخمسين جنيه',
      expectedAmount: 150,
      expectedCategory: null,
      expectedCandidatesCount: 1,
    },
    {
      input: 'دفعت خمسمية إلا عشرة',
      expectedAmount: 490,
      expectedCategory: null,
      expectedCandidatesCount: 1,
    },
    {
      input: 'دفعت خمسين جنيه، لأ، ستين',
      expectedAmount: 60,
      expectedCategory: null,
      expectedCandidatesCount: 1,
    },
    {
      input: 'دفعت ١٢٥ جنيه',
      expectedAmount: 125,
      expectedCategory: null,
      expectedCandidatesCount: 1,
    },
    {
      input: 'دفعت 250 جنيه أكل و40 مواصلات',
      expectedAmount: 250,
      expectedCategory: 'cat-food',
      expectedCandidatesCount: 2,
    },
    {
      input: 'دفعت مية جنيه يوم الخميس',
      expectedAmount: 100,
      expectedDate: '2026-10-15',
      expectedCandidatesCount: 1,
    },
    {
      input: 'دفعت مية وخمسين جنيه يوم 15 أكتوبر',
      expectedAmount: 150,
      expectedDate: '2026-10-15',
      expectedCandidatesCount: 1,
    },
    {
      input: 'ما دفعتش حاجة',
      expectedCandidatesCount: 0,
      isNegation: true,
    },
  ];

  it('evaluates accuracy metrics against curated Egyptian Arabic corpus', () => {
    let exactAmountMatches = 0;
    let exactDateMatches = 0;
    let exactCategoryMatches = 0;
    let totalEvaluated = 0;

    for (const item of corpus) {
      const result = parseExpenseUtterance(item.input, {
        referenceDate: refDate,
        categories,
      });

      if (item.isNegation) {
        expect(result.isNegationOrNonExpense).toBe(true);
        expect(result.candidates).toHaveLength(0);
        continue;
      }

      if (result.candidates.length !== item.expectedCandidatesCount) {
        throw new Error(
          `Failed on input "${item.input}": expected ${item.expectedCandidatesCount} candidate(s), got ${result.candidates.length}: ` +
            JSON.stringify(result.candidates.map((c) => ({ amt: c.amount.value, desc: c.description.value, cand: c }))),
        );
      }
      const firstCand = result.candidates[0];

      if (item.expectedAmount !== undefined) {
        totalEvaluated++;
        if (firstCand.amount.value === item.expectedAmount) {
          exactAmountMatches++;
        }
      }

      if (item.expectedCategory) {
        if (firstCand.categoryId.value === item.expectedCategory) {
          exactCategoryMatches++;
        }
      }

      if (item.expectedDate) {
        if (firstCand.date.value === item.expectedDate) {
          exactDateMatches++;
        }
      }
    }

    const amountAccuracy = (exactAmountMatches / totalEvaluated) * 100;
    expect(amountAccuracy).toBe(100);
  });
});
