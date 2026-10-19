import { Test, TestingModule } from '@nestjs/testing';
import { CommitmentsService } from './commitments.service';
import { PrismaService } from '../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { CommitmentStatus, RecurrenceFrequency, Prisma } from '@prisma/client';

describe('CommitmentsService', () => {
  let service: CommitmentsService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      commitment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      financialAccount: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaService);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommitmentsService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<CommitmentsService>(CommitmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('markOverdueForUser (GAP-04)', () => {
    it('should call updateMany to transition PENDING past-due commitments to OVERDUE', async () => {
      prismaService.commitment.updateMany.mockResolvedValue({ count: 3 });

      const count = await service.markOverdueForUser('user-1');

      expect(count).toBe(3);
      expect(prismaService.commitment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            status: CommitmentStatus.PENDING,
          }),
          data: { status: CommitmentStatus.OVERDUE },
        }),
      );
    });
  });

  describe('findAll (GAP-04)', () => {
    it('should NOT call updateMany — findAll is now a pure read', async () => {
      prismaService.commitment.findMany.mockResolvedValue([]);

      await service.findAll('user-1');

      // Critical: findAll must not trigger a write side-effect
      expect(prismaService.commitment.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('pay', () => {
    it('should throw BadRequestException if commitment is already paid', async () => {
      prismaService.commitment.findFirst.mockResolvedValue({
        id: 'comm-1',
        userId: 'user-1',
        status: CommitmentStatus.PAID,
      });

      await expect(
        service.pay('user-1', 'comm-1', { accountId: 'acc-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should record an expense, decrement account, mark PAID, and spawn next occurrence if recurring', async () => {
      const commitment = {
        id: 'comm-1',
        userId: 'user-1',
        name: 'إيجار شهري',
        amount: new Prisma.Decimal('6000.00'),
        currency: 'EGP',
        dueDate: new Date('2026-10-31T00:00:00.000Z'),
        status: CommitmentStatus.PENDING,
        recurrence: RecurrenceFrequency.MONTHLY,
        accountId: 'acc-1',
        categoryId: 'cat-rent',
      };

      prismaService.commitment.findFirst.mockResolvedValue(commitment);
      prismaService.commitment.updateMany.mockResolvedValue({ count: 1 });
      prismaService.financialAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        currency: 'EGP',
      });
      prismaService.transaction.create.mockResolvedValue({ id: 'tx-payment-1' });
      prismaService.commitment.update.mockResolvedValue({
        ...commitment,
        status: CommitmentStatus.PAID,
        paidTransactionId: 'tx-payment-1',
      });

      const result = await service.pay('user-1', 'comm-1', {
        accountId: 'acc-1',
      });

      // 1. Transaction was created
      expect(prismaService.transaction.create).toHaveBeenCalled();
      // 2. Account balance was decremented
      expect(prismaService.financialAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1' },
          data: { currentBalance: { decrement: commitment.amount } },
        }),
      );
      // 3. Current commitment was marked PAID
      expect(result.commitment.status).toBe(CommitmentStatus.PAID);
      // 4. Next monthly commitment was spawned
      expect(prismaService.commitment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recurrence: RecurrenceFrequency.MONTHLY,
            status: CommitmentStatus.PENDING,
          }),
        }),
      );
    });

    it('should reject losing concurrent payment request atomically without balance mutation (CON-01)', async () => {
      const commitment = {
        id: 'comm-race',
        userId: 'user-1',
        name: 'Gym Subscription',
        amount: new Prisma.Decimal('750.00'),
        currency: 'EGP',
        dueDate: new Date('2026-11-01T00:00:00.000Z'),
        status: CommitmentStatus.PENDING,
        recurrence: RecurrenceFrequency.MONTHLY,
        accountId: 'acc-1',
        categoryId: null,
      };

      prismaService.commitment.findFirst.mockResolvedValue(commitment);
      prismaService.financialAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        currency: 'EGP',
      });

      // Simulate race condition: another concurrent transaction already claimed this commitment
      prismaService.commitment.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.pay('user-1', 'comm-race', { accountId: 'acc-1' }),
      ).rejects.toThrow(BadRequestException);

      // Verify no expense was created and no balance was debited
      expect(prismaService.transaction.create).not.toHaveBeenCalled();
      expect(prismaService.financialAccount.update).not.toHaveBeenCalled();
    });
  });

  describe('calculateNextDueDate (DAT-01)', () => {
    it('should correctly clamp January 31 -> February 28 -> March 31 in non-leap year (2026)', () => {
      const jan31 = new Date(Date.UTC(2026, 0, 31, 12, 0, 0));
      const feb = service.calculateNextDueDate(jan31, RecurrenceFrequency.MONTHLY);

      expect(feb.getUTCFullYear()).toBe(2026);
      expect(feb.getUTCMonth()).toBe(1); // February
      expect(feb.getUTCDate()).toBe(28); // Clamped to 28

      // Next month from Feb 28 advances to March 31 preserving month-end intent
      const mar = service.calculateNextDueDate(feb, RecurrenceFrequency.MONTHLY);
      expect(mar.getUTCFullYear()).toBe(2026);
      expect(mar.getUTCMonth()).toBe(2); // March
      expect(mar.getUTCDate()).toBe(31); // Restored to 31
    });

    it('should correctly handle August 31 -> September 30 -> October 31', () => {
      const aug31 = new Date(Date.UTC(2026, 7, 31, 12, 0, 0));
      const sep = service.calculateNextDueDate(aug31, RecurrenceFrequency.MONTHLY);

      expect(sep.getUTCFullYear()).toBe(2026);
      expect(sep.getUTCMonth()).toBe(8); // September
      expect(sep.getUTCDate()).toBe(30); // Clamped to 30

      const oct = service.calculateNextDueDate(sep, RecurrenceFrequency.MONTHLY);
      expect(oct.getUTCFullYear()).toBe(2026);
      expect(oct.getUTCMonth()).toBe(9); // October
      expect(oct.getUTCDate()).toBe(31); // Restored to 31
    });

    it('should correctly clamp January 31 -> February 29 in a leap year (2024)', () => {
      const jan31Leap = new Date(Date.UTC(2024, 0, 31, 12, 0, 0));
      const febLeap = service.calculateNextDueDate(
        jan31Leap,
        RecurrenceFrequency.MONTHLY,
      );

      expect(febLeap.getUTCFullYear()).toBe(2024);
      expect(febLeap.getUTCMonth()).toBe(1); // February
      expect(febLeap.getUTCDate()).toBe(29); // Clamped to 29 in leap year
    });

    it('should clamp leap-year Feb 29 to Feb 28 on YEARLY recurrence in non-leap year', () => {
      const leapFeb29 = new Date(Date.UTC(2024, 1, 29, 12, 0, 0));
      const nextYear = service.calculateNextDueDate(
        leapFeb29,
        RecurrenceFrequency.YEARLY,
      );

      expect(nextYear.getUTCFullYear()).toBe(2025);
      expect(nextYear.getUTCMonth()).toBe(1); // February
      expect(nextYear.getUTCDate()).toBe(28); // Clamped to 28
    });
  });
});
