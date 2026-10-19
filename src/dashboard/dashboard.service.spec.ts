import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../database/prisma.service';
import { AccountType, Prisma } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', currency: 'EGP' }),
      },
      financialAccount: {
        findMany: jest.fn(),
      },
      commitment: {
        findMany: jest.fn(),
      },
      transaction: {
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSummary', () => {
    it('should accurately calculate Safe-to-Spend and separate protected savings', async () => {
      // Setup accounts: Cash (2,500), Bank (15,000), Emergency Savings (10,000 - excluded)
      prismaService.financialAccount.findMany.mockResolvedValue([
        {
          id: 'acc-cash',
          name: 'كاش',
          type: AccountType.CASH,
          currentBalance: new Prisma.Decimal('2500.00'),
          excludeFromSafeToSpend: false,
        },
        {
          id: 'acc-bank',
          name: 'بنك',
          type: AccountType.BANK,
          currentBalance: new Prisma.Decimal('15000.00'),
          excludeFromSafeToSpend: false,
        },
        {
          id: 'acc-emergency',
          name: 'طوارئ',
          type: AccountType.SAVINGS,
          currentBalance: new Prisma.Decimal('10000.00'),
          excludeFromSafeToSpend: true,
        },
      ]);

      // Outstanding commitments: 6,000 + 450 = 6,450
      prismaService.commitment.findMany.mockResolvedValue([
        { id: 'c-1', amount: new Prisma.Decimal('6000.00') },
        { id: 'c-2', amount: new Prisma.Decimal('450.00') },
      ]);

      // Monthly aggregates: Income 20,000, Expense 5,000
      prismaService.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('20000.00') } }) // Income
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('5000.00') } }); // Expense

      const summary = await service.getSummary('user-1');

      // Total liquid = 2,500 + 15,000 = 17,500.00
      expect(summary.totalLiquidBalance).toBe('17500.00');
      // Total protected = 10,000.00
      expect(summary.totalProtectedSavings).toBe('10000.00');
      // Total commitments = 6,450.00
      expect(summary.safeToSpend.totalPendingCommitments).toBe('6450.00');
      // Safe to spend = 17,500 - 6,450 = 11,050.00
      expect(summary.safeToSpend.safeToSpend).toBe('11050.00');
      expect(summary.safeToSpend.isDeficit).toBe(false);

      // Monthly performance
      expect(summary.monthlySummary.income).toBe('20000.00');
      expect(summary.monthlySummary.expenses).toBe('5000.00');
      expect(summary.monthlySummary.netSavings).toBe('15000.00');
    });

    it('should detect deficit condition when commitments exceed liquid funds', async () => {
      prismaService.financialAccount.findMany.mockResolvedValue([
        {
          id: 'acc-cash',
          name: 'كاش',
          type: AccountType.CASH,
          currentBalance: new Prisma.Decimal('1000.00'),
          excludeFromSafeToSpend: false,
        },
      ]);

      // Commitments = 3,500
      prismaService.commitment.findMany.mockResolvedValue([
        { id: 'c-1', amount: new Prisma.Decimal('3500.00') },
      ]);

      prismaService.transaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      const summary = await service.getSummary('user-1');

      // Deficit: 1,000 - 3,500 = -2,500
      expect(summary.safeToSpend.safeToSpend).toBe('-2500.00');
      expect(summary.safeToSpend.isDeficit).toBe(true);
      expect(summary.safeToSpend.deficitAmount).toBe('2500.00');
    });

    it('should isolate non-base currencies and report them separately without mixing USD and EGP (FIN-02)', async () => {
      // User currency is EGP
      prismaService.financialAccount.findMany.mockResolvedValue([
        {
          id: 'acc-egp-cash',
          name: 'كاش مصري',
          type: AccountType.CASH,
          currency: 'EGP',
          currentBalance: new Prisma.Decimal('5000.00'),
          excludeFromSafeToSpend: false,
        },
        {
          id: 'acc-usd-card',
          name: 'USD Debit Card',
          type: AccountType.BANK,
          currency: 'USD',
          currentBalance: new Prisma.Decimal('200.00'),
          excludeFromSafeToSpend: false,
        },
        {
          id: 'acc-usd-savings',
          name: 'USD Safe Box',
          type: AccountType.SAVINGS,
          currency: 'USD',
          currentBalance: new Prisma.Decimal('100.00'),
          excludeFromSafeToSpend: true,
        },
      ]);

      // Only commitments in base currency (EGP) are returned for safe-to-spend
      prismaService.commitment.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.currency === 'EGP') {
          return [{ id: 'comm-egp', amount: new Prisma.Decimal('1000.00') }];
        }
        return [];
      });

      prismaService.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('8000.00') } })
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('3000.00') } });

      const summary = await service.getSummary('user-1');

      // Base currency check
      expect(summary.baseCurrency).toBe('EGP');
      expect(summary.safeToSpend.currency).toBe('EGP');

      // Liquid balance should ONLY reflect EGP (5000.00), NEVER 5200.00
      expect(summary.totalLiquidBalance).toBe('5000.00');
      expect(summary.totalProtectedSavings).toBe('0.00');

      // Safe-to-Spend = 5000 - 1000 = 4000
      expect(summary.safeToSpend.safeToSpend).toBe('4000.00');
      expect(summary.safeToSpend.totalLiquidFunds).toBe('5000.00');
      expect(summary.safeToSpend.totalPendingCommitments).toBe('1000.00');

      // Excluded currencies must clearly report USD breakdown
      expect(summary.excludedCurrenciesSummary).toBeDefined();
      expect(summary.excludedCurrenciesSummary.length).toBe(1);
      const usdSummary = summary.excludedCurrenciesSummary[0];
      expect(usdSummary.currency).toBe('USD');
      expect(usdSummary.totalLiquidBalance).toBe('200.00');
      expect(usdSummary.totalProtectedSavings).toBe('100.00');
      expect(usdSummary.accountCount).toBe(2);

      // Account items should have currency set
      expect(summary.accounts[0].currency).toBe('EGP');
      expect(summary.accounts[1].currency).toBe('USD');
      expect(summary.accounts[2].currency).toBe('USD');
    });
  });
});
