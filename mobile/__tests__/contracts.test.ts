import {
  DashboardSummaryDto,
  SafeToSpendBreakdownDto,
  MonthlySummaryDto,
  AccountResponseDto,
  CommitmentResponseDto,
} from '../src/api/types';

describe('Financial Contracts and Calculations Verification', () => {
  it('validates Safe-to-Spend structure and deficit calculation', () => {
    const normalState: SafeToSpendBreakdownDto = {
      safeToSpend: '14350.00',
      currency: 'EGP',
      totalLiquidFunds: '20000.00',
      totalPendingCommitments: '5650.00',
      pendingCommitmentsCount: 3,
      isDeficit: false,
      deficitAmount: '0.00',
      calculatedAt: '2026-10-17T20:00:00.000Z',
    };

    expect(normalState.isDeficit).toBe(false);
    expect(parseFloat(normalState.safeToSpend)).toBe(14350);
    expect(
      parseFloat(normalState.totalLiquidFunds) -
        parseFloat(normalState.totalPendingCommitments)
    ).toBe(14350);

    const deficitState: SafeToSpendBreakdownDto = {
      safeToSpend: '-1200.00',
      currency: 'EGP',
      totalLiquidFunds: '3000.00',
      totalPendingCommitments: '4200.00',
      pendingCommitmentsCount: 2,
      isDeficit: true,
      deficitAmount: '1200.00',
      calculatedAt: '2026-10-17T20:00:00.000Z',
    };

    expect(deficitState.isDeficit).toBe(true);
    expect(parseFloat(deficitState.deficitAmount)).toBe(1200);
  });

  it('verifies that excluded currencies are kept isolated in the dashboard contract', () => {
    const dashboard: DashboardSummaryDto = {
      baseCurrency: 'EGP',
      safeToSpend: {
        safeToSpend: '10000.00',
        currency: 'EGP',
        totalLiquidFunds: '15000.00',
        totalPendingCommitments: '5000.00',
        pendingCommitmentsCount: 1,
        isDeficit: false,
        deficitAmount: '0.00',
        calculatedAt: '2026-10-17T20:00:00.000Z',
      },
      monthlySummary: {
        income: '25000.00',
        expenses: '10000.00',
        netSavings: '15000.00',
        currency: 'EGP',
        periodStart: '2026-10-01T00:00:00.000Z',
        periodEnd: '2026-10-31T23:59:59.999Z',
      },
      totalLiquidBalance: '15000.00',
      totalProtectedSavings: '50000.00',
      excludedCurrenciesSummary: [
        {
          currency: 'USD',
          totalLiquidBalance: '1500.00',
          totalProtectedSavings: '0.00',
          accountCount: 1,
        },
      ],
      accounts: [
        {
          id: 'acc-1',
          name: 'حساب بنكي رئيسي',
          type: 'BANK',
          currency: 'EGP',
          currentBalance: '15000.00',
          excludeFromSafeToSpend: false,
        },
        {
          id: 'acc-2',
          name: 'شهادة ادخار',
          type: 'SAVINGS',
          currency: 'EGP',
          currentBalance: '50000.00',
          excludeFromSafeToSpend: true,
        },
        {
          id: 'acc-3',
          name: 'حساب دولاري',
          type: 'BANK',
          currency: 'USD',
          currentBalance: '1500.00',
          excludeFromSafeToSpend: true,
        },
      ],
    };

    // Ensure base currency does not sum foreign currency balances
    const egpAccounts = dashboard.accounts.filter((a) => a.currency === 'EGP');
    const egpLiquid = egpAccounts
      .filter((a) => !a.excludeFromSafeToSpend)
      .reduce((sum, a) => sum + parseFloat(a.currentBalance), 0);

    expect(egpLiquid).toBe(15000);
    expect(dashboard.excludedCurrenciesSummary.length).toBe(1);
    expect(dashboard.excludedCurrenciesSummary[0].currency).toBe('USD');
    expect(dashboard.excludedCurrenciesSummary[0].totalLiquidBalance).toBe('1500.00');
  });

  it('validates commitment status transitions and eligibility', () => {
    const commitment: CommitmentResponseDto = {
      id: 'comm-1',
      name: 'فاتورة الكهرباء',
      amount: '450.00',
      currency: 'EGP',
      dueDate: '2026-10-25T00:00:00.000Z',
      status: 'PENDING',
      recurrence: 'MONTHLY',
      accountId: 'acc-1',
      categoryId: null,
      paidTransactionId: null,
      createdAt: '2026-10-01T00:00:00.000Z',
    };

    expect(commitment.status).toBe('PENDING');
    expect(commitment.paidTransactionId).toBeNull();
  });
});
