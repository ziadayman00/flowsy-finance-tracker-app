import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SavingsGoalsService } from './savings-goals.service';
import { PrismaService } from '../database/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock savings-goal + account composite object. */
function makeGoal(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'goal-1',
    name: 'شقة الأحلام',
    targetAmount: { toString: () => '200000.00' },
    targetDate: null,
    note: null,
    isArchived: false,
    userId: 'user-1',
    accountId: 'acc-1',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    account: {
      id: 'acc-1',
      name: 'حساب التوفير',
      type: 'SAVINGS',
      currency: 'EGP',
      currentBalance: { toString: () => '45000.00' },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SavingsGoalsService', () => {
  let service: SavingsGoalsService;
  // typed as `any` because savingsGoal is not yet in stale Prisma client types
  // (prisma generate requires the DLL lock to be released — see docs/decisions/README)
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      savingsGoal: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      financialAccount: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavingsGoalsService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<SavingsGoalsService>(SavingsGoalsService);
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns mapped DTOs with progress derived from account balance', async () => {
      prismaService.savingsGoal.findMany.mockResolvedValue([makeGoal()]);

      const result = await service.findAll('user-1');

      expect(result).toHaveLength(1);
      const dto = result[0];

      expect(dto.id).toBe('goal-1');
      expect(dto.targetAmount).toBe('200000.00');
      expect(dto.currency).toBe('EGP');
      expect(dto.currentAmount).toBe('45000.00');
      // remainingAmount = 200000 - 45000 = 155000
      expect(dto.remainingAmount).toBe('155000.00');
      // percentage = (45000 / 200000) * 100 = 22.5
      expect(dto.percentage).toBe(22.5);
      expect(dto.account.id).toBe('acc-1');
    });

    it('excludes archived goals by default', async () => {
      prismaService.savingsGoal.findMany.mockResolvedValue([]);

      await service.findAll('user-1');

      expect(prismaService.savingsGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isArchived: false }),
        }),
      );
    });

    it('includes archived goals when flag is true (isArchived filter omitted)', async () => {
      prismaService.savingsGoal.findMany.mockResolvedValue([]);

      await service.findAll('user-1', true);

      const whereArg = prismaService.savingsGoal.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('isArchived');
    });
  });

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  describe('findById', () => {
    it('returns the goal when found', async () => {
      prismaService.savingsGoal.findFirst.mockResolvedValue(makeGoal());

      const result = await service.findById('user-1', 'goal-1');

      expect(result.id).toBe('goal-1');
    });

    it('throws NotFoundException when goal does not exist', async () => {
      prismaService.savingsGoal.findFirst.mockResolvedValue(null);

      await expect(service.findById('user-1', 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    const dto = {
      accountId: 'acc-1',
      name: 'صندوق الطوارئ',
      targetAmount: 50000,
      targetDate: null,
      note: null,
    };

    it('throws NotFoundException when account is not found', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue(null);

      await expect(service.create('user-1', dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when account already has an active goal', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue({ id: 'acc-1' });
      prismaService.savingsGoal.findFirst.mockResolvedValue(
        makeGoal({ name: 'الهدف الموجود' }),
      );

      await expect(service.create('user-1', dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates and returns the goal when preconditions pass', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue({ id: 'acc-1' });
      // No existing goal
      prismaService.savingsGoal.findFirst.mockResolvedValue(null);
      prismaService.savingsGoal.create.mockResolvedValue(
        makeGoal({
          name: 'صندوق الطوارئ',
          targetAmount: { toString: () => '50000.00' },
        }),
      );

      const result = await service.create('user-1', dto as any);

      expect(result.name).toBe('صندوق الطوارئ');
      expect(prismaService.savingsGoal.create).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('throws NotFoundException when goal does not exist', async () => {
      prismaService.savingsGoal.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'goal-1', { name: 'جديد' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates mutable fields and returns updated DTO', async () => {
      prismaService.savingsGoal.findFirst.mockResolvedValue(makeGoal());
      const updatedGoal = makeGoal({
        name: 'هدف جديد',
        targetAmount: { toString: () => '300000.00' },
        account: {
          id: 'acc-1',
          name: 'حساب التوفير',
          type: 'SAVINGS',
          currency: 'EGP',
          currentBalance: { toString: () => '45000.00' },
        },
      });
      prismaService.savingsGoal.update.mockResolvedValue(updatedGoal);

      const result = await service.update('user-1', 'goal-1', {
        name: 'هدف جديد',
        targetAmount: 300000,
      } as any);

      expect(result.name).toBe('هدف جديد');
      expect(result.targetAmount).toBe('300000.00');
      // progress: 45000 / 300000 * 100 = 15
      expect(result.percentage).toBe(15);
    });

    it('does NOT pass accountId to the Prisma update call', async () => {
      prismaService.savingsGoal.findFirst.mockResolvedValue(makeGoal());
      prismaService.savingsGoal.update.mockResolvedValue(makeGoal());

      await service.update('user-1', 'goal-1', {
        accountId: 'other-acc',
      } as any);

      const updateCallData = prismaService.savingsGoal.update.mock.calls[0][0].data;
      expect(updateCallData).not.toHaveProperty('accountId');
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete', () => {
    it('throws NotFoundException when goal does not exist', async () => {
      prismaService.savingsGoal.findFirst.mockResolvedValue(null);

      await expect(service.delete('user-1', 'goal-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes the goal record and does not touch the account', async () => {
      prismaService.savingsGoal.findFirst.mockResolvedValue(makeGoal());
      prismaService.savingsGoal.delete.mockResolvedValue(makeGoal());

      const result = await service.delete('user-1', 'goal-1');

      expect(result.success).toBe(true);
      // Account was never touched
      expect(prismaService.financialAccount.findFirst).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Progress math edge cases
  // -------------------------------------------------------------------------

  describe('progress calculation (mapToDto)', () => {
    it('handles 100%+ when balance exceeds target', async () => {
      prismaService.savingsGoal.findMany.mockResolvedValue([
        makeGoal({
          targetAmount: { toString: () => '10000.00' },
          account: {
            id: 'acc-1',
            name: 'acc',
            type: 'SAVINGS',
            currency: 'EGP',
            currentBalance: { toString: () => '12000.00' },
          },
        }),
      ]);

      const [dto] = await service.findAll('user-1');

      expect(dto.percentage).toBe(120);
      expect(dto.remainingAmount).toBe('-2000.00'); // negative = over-funded
    });

    it('returns 0% when target is zero (avoids division by zero)', async () => {
      prismaService.savingsGoal.findMany.mockResolvedValue([
        makeGoal({
          targetAmount: { toString: () => '0.00' },
          account: {
            id: 'acc-1',
            name: 'acc',
            type: 'SAVINGS',
            currency: 'EGP',
            currentBalance: { toString: () => '0.00' },
          },
        }),
      ]);

      const [dto] = await service.findAll('user-1');

      expect(dto.percentage).toBe(0);
    });
  });
});
