import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ForecastingService } from './forecasting.service';
import { PrismaService } from '../database/prisma.service';
import { CommitmentsService } from '../commitments/commitments.service';
import { RecurrenceFrequency, CommitmentStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCommitment(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'cmt-1',
    name: 'إيجار الشقة',
    amount: { toString: () => '5000.00' },
    currency: 'EGP',
    dueDate: new Date('2026-10-01T00:00:00.000Z'),
    recurrence: RecurrenceFrequency.MONTHLY,
    status: CommitmentStatus.PENDING,
    flowType: 'EXPENSE',
    targetDay: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ForecastingService', () => {
  let service: ForecastingService;
  let prismaService: any;
  let commitmentsService: jest.Mocked<CommitmentsService>;

  // We pin "now" so bucket calculations are deterministic.
  // Oct 2026 is month 0; Nov 2026 is month 1; Dec 2026 is month 2.
  const NOW = new Date('2026-10-19T10:00:00.000Z');

  beforeEach(async () => {
    prismaService = {
      commitment: {
        findMany: jest.fn(),
      },
    };

    // CommitmentsService.calculateNextDueDate is the real month-end-aware
    // implementation — we pass the real class and let it run.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastingService,
        { provide: PrismaService, useValue: prismaService },
        CommitmentsService,
        // CommitmentsService needs PrismaService — provide the same mock.
        // CommitmentsService.calculateNextDueDate() doesn't call prisma so
        // the mock is never invoked for that method.
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<ForecastingService>(ForecastingService);
    commitmentsService = module.get(CommitmentsService);

    // Spy on Date construction to pin "now" inside the service.
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  describe('validation', () => {
    it('throws BadRequestException when months < 1', async () => {
      await expect(
        service.getCashFlowForecast('user-1', 0, 'EGP'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when months > 12', async () => {
      await expect(
        service.getCashFlowForecast('user-1', 13, 'EGP'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // Response shape
  // -------------------------------------------------------------------------

  describe('response shape', () => {
    it('always returns dataQuality = ESTIMATE', async () => {
      prismaService.commitment.findMany.mockResolvedValue([]);

      const result = await service.getCashFlowForecast('user-1', 1, 'EGP');

      expect(result.dataQuality).toBe('ESTIMATE');
    });

    it('returns the correct number of monthly buckets', async () => {
      prismaService.commitment.findMany.mockResolvedValue([]);

      const result = await service.getCashFlowForecast('user-1', 3, 'EGP');

      expect(result.forecast).toHaveLength(3);
      expect(result.months).toBe(3);
    });

    it('bucket labels are in YYYY-MM format', async () => {
      prismaService.commitment.findMany.mockResolvedValue([]);

      const result = await service.getCashFlowForecast('user-1', 3, 'EGP');

      expect(result.forecast[0].month).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  // -------------------------------------------------------------------------
  // Currency scoping
  // -------------------------------------------------------------------------

  describe('currency scoping', () => {
    it('queries Prisma with the requested currency filter', async () => {
      prismaService.commitment.findMany.mockResolvedValue([]);

      await service.getCashFlowForecast('user-1', 3, 'SAR');

      expect(prismaService.commitment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ currency: 'SAR' }),
        }),
      );
    });

    it('excludes PAID commitments', async () => {
      prismaService.commitment.findMany.mockResolvedValue([]);

      await service.getCashFlowForecast('user-1', 3, 'EGP');

      const where = prismaService.commitment.findMany.mock.calls[0][0].where;
      expect(where.status).toMatchObject({ not: CommitmentStatus.PAID });
    });
  });

  // -------------------------------------------------------------------------
  // ONE_TIME commitments
  // -------------------------------------------------------------------------

  describe('NONE (non-recurring) commitments', () => {
    it('places a NONE-recurrence commitment in the correct month bucket', async () => {
      // Due in Nov 2026 = bucket index 1 relative to Oct 2026
      const commitment = makeCommitment({
        recurrence: RecurrenceFrequency.NONE,
        dueDate: new Date('2026-11-15T00:00:00.000Z'),
      });
      prismaService.commitment.findMany.mockResolvedValue([commitment]);

      const result = await service.getCashFlowForecast('user-1', 3, 'EGP');

      expect(result.forecast[0].commitments).toHaveLength(0); // Oct
      expect(result.forecast[1].commitments).toHaveLength(1); // Nov
      expect(result.forecast[2].commitments).toHaveLength(0); // Dec
    });

    it('excludes a NONE-recurrence commitment that falls outside the window', async () => {
      const commitment = makeCommitment({
        recurrence: RecurrenceFrequency.NONE,
        dueDate: new Date('2027-06-01T00:00:00.000Z'), // beyond 3-month window
      });
      prismaService.commitment.findMany.mockResolvedValue([commitment]);

      const result = await service.getCashFlowForecast('user-1', 3, 'EGP');

      const totalItems = result.forecast.reduce(
        (sum, b) => sum + b.commitments.length,
        0,
      );
      expect(totalItems).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // MONTHLY recurring commitments
  // -------------------------------------------------------------------------

  describe('MONTHLY recurring commitments', () => {
    it('projects a monthly commitment into every bucket in the window', async () => {
      // dueDate is Sep 2026 (before window). Should advance into Oct, Nov, Dec.
      const commitment = makeCommitment({
        recurrence: RecurrenceFrequency.MONTHLY,
        dueDate: new Date('2026-09-01T00:00:00.000Z'),
        amount: { toString: () => '5000.00' },
      });
      prismaService.commitment.findMany.mockResolvedValue([commitment]);

      const result = await service.getCashFlowForecast('user-1', 3, 'EGP');

      // Each of the 3 months should have exactly 1 occurrence.
      expect(result.forecast[0].commitments).toHaveLength(1); // Oct
      expect(result.forecast[1].commitments).toHaveLength(1); // Nov
      expect(result.forecast[2].commitments).toHaveLength(1); // Dec
    });

    it('accumulates expenses correctly using decimal arithmetic', async () => {
      const commitment = makeCommitment({
        recurrence: RecurrenceFrequency.MONTHLY,
        dueDate: new Date('2026-09-01T00:00:00.000Z'),
        amount: { toString: () => '1500.50' },
        flowType: 'EXPENSE',
      });
      prismaService.commitment.findMany.mockResolvedValue([commitment]);

      const result = await service.getCashFlowForecast('user-1', 1, 'EGP');

      expect(result.forecast[0].projectedExpenses).toBe('1500.50');
      expect(result.forecast[0].projectedIncome).toBe('0.00');
      expect(result.forecast[0].netCashFlow).toBe('-1500.50');
    });
  });

  // -------------------------------------------------------------------------
  // INCOME commitments
  // -------------------------------------------------------------------------

  describe('INCOME flow type', () => {
    it('counts income commitments correctly and produces a positive netCashFlow', async () => {
      prismaService.commitment.findMany.mockResolvedValue([
        makeCommitment({
          recurrence: RecurrenceFrequency.MONTHLY,
          dueDate: new Date('2026-09-01T00:00:00.000Z'),
          amount: { toString: () => '3000.00' },
          flowType: 'INCOME',
        }),
        makeCommitment({
          id: 'cmt-2',
          recurrence: RecurrenceFrequency.MONTHLY,
          dueDate: new Date('2026-09-01T00:00:00.000Z'),
          amount: { toString: () => '1000.00' },
          flowType: 'EXPENSE',
        }),
      ]);

      const result = await service.getCashFlowForecast('user-1', 1, 'EGP');

      const oct = result.forecast[0];
      expect(oct.projectedIncome).toBe('3000.00');
      expect(oct.projectedExpenses).toBe('1000.00');
      expect(oct.netCashFlow).toBe('2000.00'); // positive net inflow
    });
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe('empty state (no commitments)', () => {
    it('returns zeroed buckets when there are no commitments', async () => {
      prismaService.commitment.findMany.mockResolvedValue([]);

      const result = await service.getCashFlowForecast('user-1', 3, 'EGP');

      for (const bucket of result.forecast) {
        expect(bucket.projectedExpenses).toBe('0.00');
        expect(bucket.projectedIncome).toBe('0.00');
        expect(bucket.netCashFlow).toBe('0.00');
        expect(bucket.commitments).toHaveLength(0);
      }
    });
  });
});
