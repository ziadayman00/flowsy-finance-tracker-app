import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionType, Prisma, CommitmentStatus } from '@prisma/client';

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
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
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
    it('should reject cross-currency transfers and leave balances unchanged (FIN-03)', async () => {
      const egpAccount = { id: 'acc-egp', userId: 'user-1', currency: 'EGP' };
      const usdAccount = { id: 'acc-usd', userId: 'user-1', currency: 'USD' };

      prismaService.financialAccount.findFirst
        .mockResolvedValueOnce(egpAccount)
        .mockResolvedValueOnce(usdAccount);

      await expect(
        service.create('user-1', {
          type: TransactionType.TRANSFER,
          amount: 100,
          accountId: 'acc-egp',
          destinationAccountId: 'acc-usd',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaService.financialAccount.update).not.toHaveBeenCalled();
      expect(prismaService.transaction.create).not.toHaveBeenCalled();
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

    it('should restore linked commitment to PENDING if due date is in the future (FIN-01)', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 5); // +5 days
      prismaService.transaction.findFirst.mockResolvedValue({
        id: 'tx-pay-1',
        userId: 'user-1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('500.00'),
        accountId: 'acc-1',
        destinationAccountId: null,
      });

      prismaService.commitment.findMany.mockResolvedValue([
        {
          id: 'comm-1',
          name: 'Internet',
          dueDate: futureDate,
          paidTransactionId: 'tx-pay-1',
        },
      ]);

      await service.delete('user-1', 'tx-pay-1');

      expect(prismaService.commitment.update).toHaveBeenCalledWith({
        where: { id: 'comm-1' },
        data: {
          status: CommitmentStatus.PENDING,
          paidTransactionId: null,
        },
      });
    });

    it('should restore linked commitment to OVERDUE if due date is in the past (FIN-01)', async () => {
      const pastDate = new Date(Date.now() - 86400000 * 5); // -5 days
      prismaService.transaction.findFirst.mockResolvedValue({
        id: 'tx-pay-2',
        userId: 'user-1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('1200.00'),
        accountId: 'acc-1',
        destinationAccountId: null,
      });

      prismaService.commitment.findMany.mockResolvedValue([
        {
          id: 'comm-2',
          name: 'Rent',
          dueDate: pastDate,
          paidTransactionId: 'tx-pay-2',
        },
      ]);

      await service.delete('user-1', 'tx-pay-2');

      expect(prismaService.commitment.update).toHaveBeenCalledWith({
        where: { id: 'comm-2' },
        data: {
          status: CommitmentStatus.OVERDUE,
          paidTransactionId: null,
        },
      });
    });
  });

  describe('createBatch', () => {
    it('should throw BadRequestException if dtos array is empty', async () => {
      await expect(service.createBatch('user-1', [])).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if any account is not found or does not belong to user', async () => {
      prismaService.financialAccount.findMany = jest.fn().mockResolvedValue([
        { id: 'acc-1', userId: 'user-1', currency: 'EGP' },
      ]);

      await expect(
        service.createBatch('user-1', [
          { type: TransactionType.EXPENSE, amount: 100, accountId: 'acc-1' },
          { type: TransactionType.EXPENSE, amount: 200, accountId: 'acc-unknown' },
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should atomically create multiple expenses and decrement account balances', async () => {
      prismaService.financialAccount.findMany = jest.fn().mockResolvedValue([
        { id: 'acc-1', userId: 'user-1', currency: 'EGP' },
      ]);
      prismaService.category.findMany = jest.fn().mockResolvedValue([
        { id: 'cat-1', name: 'Food' },
      ]);
      prismaService.transaction.create = jest
        .fn()
        .mockImplementation(async ({ data }) => ({
          id: 'tx-' + Math.random(),
          ...data,
          createdAt: new Date(),
          account: { id: 'acc-1', name: 'Cash' },
          category: { id: 'cat-1', name: 'Food', icon: 'fast-food' },
          destinationAccount: null,
        }));

      const result = await service.createBatch('user-1', [
        { type: TransactionType.EXPENSE, amount: 50, accountId: 'acc-1', categoryId: 'cat-1' },
        { type: TransactionType.EXPENSE, amount: 75, accountId: 'acc-1' },
      ]);

      expect(result.count).toBe(2);
      expect(result.created).toHaveLength(2);
      expect(prismaService.financialAccount.update).toHaveBeenCalledTimes(2);
      expect(prismaService.transaction.create).toHaveBeenCalledTimes(2);
    });
  });
});
