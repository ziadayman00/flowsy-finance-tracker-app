import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ImportService } from './import.service';
import { PrismaService } from '../database/prisma.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACCOUNT_ID = 'acc-uuid-1';
const USER_ID = 'user-uuid-1';

const mockAccount = {
  id: ACCOUNT_ID,
  userId: USER_ID,
  currentBalance: { toString: () => '1000.00' },
  isArchived: false,
};

const baseRow = {
  date: '2026-10-15',
  amount: 250.5,
  currency: 'EGP',
  type: 'EXPENSE' as const,
  note: 'سوبر ماركت',
};

const basePreviewDto = {
  accountId: ACCOUNT_ID,
  rows: [{ ...baseRow }],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportService', () => {
  let service: ImportService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      financialAccount: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<ImportService>(ImportService);
  });

  // -------------------------------------------------------------------------
  // preview
  // -------------------------------------------------------------------------

  describe('preview', () => {
    it('throws NotFoundException when account is not found', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue(null);

      await expect(service.preview(USER_ID, basePreviewDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when rows array is empty', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue(mockAccount);
      prismaService.transaction.findMany.mockResolvedValue([]);

      await expect(
        service.preview(USER_ID, { accountId: ACCOUNT_ID, rows: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns a sessionId and classifies a new row as NEW', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue(mockAccount);
      prismaService.transaction.findMany.mockResolvedValue([]); // no existing transactions

      const result = await service.preview(USER_ID, basePreviewDto);

      expect(result.sessionId).toBeTruthy();
      expect(result.totalRows).toBe(1);
      expect(result.newCount).toBe(1);
      expect(result.duplicateCount).toBe(0);
      expect(result.rows[0].status).toBe('NEW');
    });

    it('classifies a row as LIKELY_DUPLICATE when a matching transaction exists', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue(mockAccount);
      // An existing transaction: same amount, type, and date within 1 day
      prismaService.transaction.findMany.mockResolvedValue([
        {
          id: 'txn-existing-1',
          amount: { toString: () => '250.50' },
          type: 'EXPENSE',
          transactionDate: new Date('2026-10-15T08:00:00.000Z'),
        },
      ]);

      const result = await service.preview(USER_ID, basePreviewDto);

      expect(result.rows[0].status).toBe('LIKELY_DUPLICATE');
      expect(result.rows[0].duplicateCandidateId).toBe('txn-existing-1');
      expect(result.duplicateCount).toBe(1);
    });

    it('does NOT flag as duplicate when amounts differ', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue(mockAccount);
      prismaService.transaction.findMany.mockResolvedValue([
        {
          id: 'txn-other',
          amount: { toString: () => '999.00' }, // different amount
          type: 'EXPENSE',
          date: new Date('2026-10-15T00:00:00.000Z'),
        },
      ]);

      const result = await service.preview(USER_ID, basePreviewDto);

      expect(result.rows[0].status).toBe('NEW');
    });

    it('does NOT flag as duplicate when date is more than 1 day apart', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue(mockAccount);
      prismaService.transaction.findMany.mockResolvedValue([
        {
          id: 'txn-old',
          amount: { toString: () => '250.50' },
          type: 'EXPENSE',
          transactionDate: new Date('2026-10-01T00:00:00.000Z'), // 14 days before
        },
      ]);

      const result = await service.preview(USER_ID, basePreviewDto);

      expect(result.rows[0].status).toBe('NEW');
    });

    it('amounts are normalised to 2 decimal places in the response', async () => {
      prismaService.financialAccount.findFirst.mockResolvedValue(mockAccount);
      prismaService.transaction.findMany.mockResolvedValue([]);

      const result = await service.preview(USER_ID, basePreviewDto);

      expect(result.rows[0].amount).toBe('250.50');
    });
  });

  // -------------------------------------------------------------------------
  // commit
  // -------------------------------------------------------------------------

  describe('commit', () => {
    /** Helper: run a preview and return the sessionId. */
    async function runPreview(): Promise<string> {
      prismaService.financialAccount.findFirst.mockResolvedValue(mockAccount);
      prismaService.transaction.findMany.mockResolvedValue([]);
      const result = await service.preview(USER_ID, basePreviewDto);
      return result.sessionId;
    }

    it('throws BadRequestException when sessionId is not found', async () => {
      await expect(
        service.commit(USER_ID, { sessionId: 'non-existent-session' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when session belongs to a different user', async () => {
      const sessionId = await runPreview();

      await expect(
        service.commit('other-user', { sessionId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls $transaction and returns imported count', async () => {
      const sessionId = await runPreview();

      prismaService.financialAccount.findFirst.mockResolvedValue(mockAccount);

      // Mock the $transaction to run the callback and return the created ID.
      prismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          transaction: {
            create: jest
              .fn()
              .mockResolvedValue({ id: 'txn-new-1' }),
          },
          financialAccount: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        await cb(tx);
      });

      const result = await service.commit(USER_ID, { sessionId });

      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(result.imported).toBe(1);
      expect(result.transactionIds).toHaveLength(1);
    });

    it('invalidates the session after a successful commit', async () => {
      const sessionId = await runPreview();

      prismaService.financialAccount.findFirst.mockResolvedValue(mockAccount);
      prismaService.$transaction.mockImplementation(async (cb: any) => {
        await cb({
          transaction: { create: jest.fn().mockResolvedValue({ id: 'txn-1' }) },
          financialAccount: { update: jest.fn() },
        });
      });

      await service.commit(USER_ID, { sessionId });

      // Second commit with the same sessionId must fail.
      await expect(
        service.commit(USER_ID, { sessionId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('commits zero rows when all rows are NEW and rowIndices is empty array', async () => {
      const sessionId = await runPreview();
      prismaService.financialAccount.findFirst.mockResolvedValue(mockAccount);

      // Pass an empty rowIndices — defaults to ALL NEW rows.
      prismaService.$transaction.mockImplementation(async (cb: any) => {
        await cb({
          transaction: { create: jest.fn().mockResolvedValue({ id: 'txn-1' }) },
          financialAccount: { update: jest.fn() },
        });
      });

      const result = await service.commit(USER_ID, { sessionId });
      expect(result.imported).toBe(1); // 1 NEW row
    });
  });
});
