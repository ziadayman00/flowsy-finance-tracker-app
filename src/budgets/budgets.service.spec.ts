import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      budget: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      category: {
        findFirst: jest.fn(),
      },
      transaction: {
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException if startDate >= endDate', async () => {
      await expect(
        service.create('user-1', {
          name: 'Invalid Budget',
          amount: 1000,
          startDate: '2026-10-31T00:00:00.000Z',
          endDate: '2026-10-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate budget progress accurately with expenses', async () => {
      const budgetData = {
        id: 'b-1',
        name: 'بقالة',
        amount: new Prisma.Decimal('4000.00'),
        currency: 'EGP',
        categoryId: 'cat-1',
        category: { name: 'بقالة ومستلزمات' },
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2026-10-31T23:59:59.000Z'),
        isArchived: false,
      };

      prismaService.category.findFirst.mockResolvedValue({ id: 'cat-1' });
      prismaService.budget.create.mockResolvedValue(budgetData);
      prismaService.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('1000.00') },
      });

      const result = await service.create('user-1', {
        name: 'بقالة',
        amount: 4000,
        categoryId: 'cat-1',
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-31T23:59:59.000Z',
      });

      expect(result.amount).toBe('4000.00');
      expect(result.currency).toBe('EGP');
      expect(result.spent).toBe('1000.00');
      expect(result.remaining).toBe('3000.00');
      expect(result.percentage).toBe(25);

      // GAP-03: verify the aggregation was called with currency filter
      expect(prismaService.transaction.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ currency: 'EGP' }),
        }),
      );
    });

    it('should not include USD transactions in an EGP budget (GAP-03 currency isolation)', async () => {
      const egpBudget = {
        id: 'b-2',
        name: 'مصاريف',
        amount: new Prisma.Decimal('5000.00'),
        currency: 'EGP',
        categoryId: null,
        category: null,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2026-10-31T23:59:59.000Z'),
        isArchived: false,
      };

      prismaService.budget.findFirst.mockResolvedValue(egpBudget);
      // Only EGP transactions should contribute — mock returns EGP-scoped total
      prismaService.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('2000.00') },
      });

      const result = await service.findById('user-1', 'b-2');

      expect(result.currency).toBe('EGP');
      expect(result.spent).toBe('2000.00');
      expect(result.remaining).toBe('3000.00');

      // Verify currency filter was applied in the DB query
      const callArgs = prismaService.transaction.aggregate.mock.calls[0][0];
      expect(callArgs.where.currency).toBe('EGP');
    });
  });
});

