import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionType, Prisma } from '@prisma/client';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      financialAccount: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      category: {
        findFirst: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      commitment: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaService);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException if primary account does not belong to user', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          type: TransactionType.EXPENSE,
          amount: 50,
          accountId: 'unknown-acc',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if transferring to the same account', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        currency: 'EGP',
      });

      await expect(
        service.create('user-1', {
          type: TransactionType.TRANSFER,
          amount: 50,
          accountId: 'acc-1',
          destinationAccountId: 'acc-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should atomicaly debit source and credit destination for transfers', async () => {
      const sourceAcc = { id: 'acc-1', userId: 'user-1', currency: 'EGP' };
      const destAcc = { id: 'acc-2', userId: 'user-1', currency: 'EGP' };

      prismaService.financialAccount.findFirst
        .mockResolvedValueOnce(sourceAcc)
        .mockResolvedValueOnce(destAcc);

      prismaService.transaction.create.mockResolvedValue({
        id: 'tx-1',
        type: TransactionType.TRANSFER,
        amount: new Prisma.Decimal('100.00'),
        currency: 'EGP',
        note: null,
        transactionDate: new Date(),
        account: sourceAcc,
        destinationAccount: destAcc,
        category: null,
        createdAt: new Date(),
      });

      const result = await service.create('user-1', {
        type: TransactionType.TRANSFER,
        amount: 100,
        accountId: 'acc-1',
        destinationAccountId: 'acc-2',
      });

      expect(prismaService.financialAccount.update).toHaveBeenCalledTimes(2);
      expect(result.amount).toBe('100.00');
    });

    it('should atomicaly decrease balance for EXPENSE', async () => {
      const acc = { id: 'acc-1', userId: 'user-1', currency: 'EGP' };
      prismaService.financialAccount.findFirst.mockResolvedValue(acc);

      prismaService.transaction.create.mockResolvedValue({
        id: 'tx-2',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('250.50'),
        currency: 'EGP',
        note: 'Supermarket',
        transactionDate: new Date(),
        account: acc,
        destinationAccount: null,
        category: null,
        createdAt: new Date(),
      });

      const result = await service.create('user-1', {
        type: TransactionType.EXPENSE,
        amount: 250.5,
        accountId: 'acc-1',
      });

      expect(prismaService.financialAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1' },
          data: { currentBalance: { decrement: expect.any(Object) } },
        }),
      );
      expect(result.amount).toBe('250.50');
    });
  });

  describe('delete', () => {
    it('should reverse expense balance by incrementing account balance', async () => {
      prismaService.transaction.findFirst.mockResolvedValue({
        id: 'tx-1',
        userId: 'user-1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('50.00'),
        accountId: 'acc-1',
        destinationAccountId: null,
      });

      const result = await service.delete('user-1', 'tx-1');

      expect(prismaService.financialAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1' },
          data: { currentBalance: { increment: expect.any(Object) } },
        }),
      );
      expect(prismaService.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
      });
      expect(result.success).toBe(true);
    });
  });
});
