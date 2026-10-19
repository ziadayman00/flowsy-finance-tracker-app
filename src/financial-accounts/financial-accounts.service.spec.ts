import { Test, TestingModule } from '@nestjs/testing';
import { FinancialAccountsService } from './financial-accounts.service';
import { PrismaService } from '../database/prisma.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AccountType, Prisma } from '@prisma/client';

describe('FinancialAccountsService', () => {
  let service: FinancialAccountsService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      financialAccount: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      transaction: {
        count: jest.fn(),
      },
      commitment: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialAccountsService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<FinancialAccountsService>(FinancialAccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ConflictException if account name exists for user', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue({ id: 'acc-1' });

      await expect(
        service.create('user-1', {
          name: 'كاش',
          type: AccountType.CASH,
          initialBalance: 100,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create account with initialBalance equaling currentBalance', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue(null);
      prismaService.financialAccount.create.mockResolvedValue({
        id: 'acc-1',
        name: 'كاش',
        type: AccountType.CASH,
        currency: 'EGP',
        initialBalance: new Prisma.Decimal('100.00'),
        currentBalance: new Prisma.Decimal('100.00'),
        isArchived: false,
        excludeFromSafeToSpend: false,
        createdAt: new Date(),
      });

      const result = await service.create('user-1', {
        name: 'كاش',
        type: AccountType.CASH,
        initialBalance: 100,
      });

      expect(result.currentBalance).toBe('100.00');
      expect(result.initialBalance).toBe('100.00');
    });
  });

  describe('delete', () => {
    it('should throw BadRequestException if account has transactions', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        name: 'كاش',
        type: AccountType.CASH,
        currency: 'EGP',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        isArchived: false,
        excludeFromSafeToSpend: false,
        createdAt: new Date(),
      });
      prismaService.transaction.count.mockResolvedValue(5);

      await expect(service.delete('user-1', 'acc-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete account if it has no transactions or commitments', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        name: 'كاش',
        type: AccountType.CASH,
        currency: 'EGP',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        isArchived: false,
        excludeFromSafeToSpend: false,
        createdAt: new Date(),
      });
      prismaService.transaction.count.mockResolvedValue(0);
      prismaService.commitment.count.mockResolvedValue(0);
      prismaService.financialAccount.delete.mockResolvedValue({ id: 'acc-1' });

      const result = await service.delete('user-1', 'acc-1');
      expect(result.success).toBe(true);
    });
  });
});
