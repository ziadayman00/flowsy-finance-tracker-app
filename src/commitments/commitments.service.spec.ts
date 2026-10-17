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
      prismaService.financialAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
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
  });
});
