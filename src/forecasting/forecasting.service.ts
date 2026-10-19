import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CashFlowForecastDto, MonthlyForecastDto, ProjectedCommitmentDto } from './dto/cash-flow-forecast.dto';
import { CommitmentsService } from '../commitments/commitments.service';
import { RecurrenceFrequency, CommitmentStatus } from '@prisma/client';
import Decimal from 'decimal.js';

/** Sentinel: NONE (non-recurring) commitments appear only once. */
const ONE_TIME_FREQUENCIES = new Set([RecurrenceFrequency.NONE]);

@Injectable()
export class ForecastingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commitmentsService: CommitmentsService,
  ) {}

  /**
   * Projects recurring commitments forward for `months` calendar months
   * starting from the current UTC month.
   *
   * Design rules (enforced):
   * 1. All values are in a single `currency` — never mix currencies.
   * 2. ONE_TIME commitments that are still PENDING and fall within the window
   *    appear exactly once; completed ones are excluded entirely.
   * 3. Recurring (DAILY/WEEKLY/MONTHLY/YEARLY) commitments are projected by
   *    advancing dueDate via CommitmentsService.calculateNextDueDate() until
   *    the date falls beyond the projection window.
   * 4. The response always labels dataQuality: 'ESTIMATE'. No AI is involved.
   * 5. Cross-currency totals are never computed here. The caller selects one
   *    currency via the `currency` query param (defaults to the user's timezone/
   *    region default — currently EGP if not specified).
   */
  async getCashFlowForecast(
    userId: string,
    months: number,
    currency: string,
  ): Promise<CashFlowForecastDto> {
    if (months < 1 || months > 12) {
      throw new BadRequestException('months must be between 1 and 12');
    }

    // -----------------------------------------------------------------------
    // 1. Determine the projection window (UTC month boundaries).
    // -----------------------------------------------------------------------
    const now = new Date();
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, 1));
    // windowEnd is exclusive (first moment of the month AFTER the last projected month)

    // -----------------------------------------------------------------------
    // 2. Build a monthly bucket array.
    // -----------------------------------------------------------------------
    const buckets: MonthlyForecastDto[] = [];
    for (let m = 0; m < months; m++) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + m, 1));
      const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + m + 1, 1) - 1);
      const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
      buckets.push({
        month: label,
        startDate: start,
        endDate: end,
        projectedExpenses: '0.00',
        projectedIncome: '0.00',
        netCashFlow: '0.00',
        commitments: [],
      });
    }

    // -----------------------------------------------------------------------
    // 3. Load non-paid commitments in the requested currency.
    // -----------------------------------------------------------------------
    const rawCommitments = await this.prisma.commitment.findMany({
      where: {
        userId,
        currency,
        status: { not: CommitmentStatus.PAID },
      },
    });

    // -----------------------------------------------------------------------
    // 4. Project each commitment into the appropriate monthly bucket(s).
    // -----------------------------------------------------------------------
    for (const rawCommitment of rawCommitments) {
      // Cast to any: the Prisma client types are stale (DLL locked). The actual
      // fields (amount, currency, recurrence, dueDate, flowType, targetDay) exist
      // in the DB and schema; they're just missing from generated TypeScript types.
      // See TODO in SavingsGoalsService for the regeneration instructions.
      const commitment: any = rawCommitment;
      const isOneTime = (commitment.recurrence as string) === RecurrenceFrequency.NONE;

      if (isOneTime) {
        // ONE_TIME: appears only once at its dueDate, if within the window.
        const due = new Date(commitment.dueDate);
        if (due >= windowStart && due < windowEnd) {
          const bucketIdx = this.bucketIndex(due, now);
          if (bucketIdx >= 0 && bucketIdx < buckets.length) {
            this.addCommitmentToBucket(buckets[bucketIdx], commitment);
          }
        }
      } else {
        // Recurring: advance from dueDate until past windowEnd.
        // We start from the commitment's current dueDate and advance forward.
        let cursor = new Date(commitment.dueDate);

        // If the cursor is before the window, fast-forward until we're in or
        // past the window (avoid O(years) of tiny steps for old commitments).
        cursor = this.fastForwardToWindow(cursor, commitment.recurrence as RecurrenceFrequency, windowStart);

        // Project occurrences within the window.
        let safety = 0;
        while (cursor < windowEnd && safety < 500) {
          safety++;
          if (cursor >= windowStart) {
            const bucketIdx = this.bucketIndex(cursor, now);
            if (bucketIdx >= 0 && bucketIdx < buckets.length) {
              this.addCommitmentToBucket(buckets[bucketIdx], commitment, new Date(cursor));
            }
          }
          cursor = this.commitmentsService.calculateNextDueDate(
            cursor,
            commitment.recurrence as RecurrenceFrequency,
            commitment.targetDay ?? undefined,
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // 5. Compute totals for each bucket using decimal.js.
    // -----------------------------------------------------------------------
    for (const bucket of buckets) {
      let expenses = new Decimal('0');
      let income   = new Decimal('0');

      for (const c of bucket.commitments) {
        const amt = new Decimal(c.amount);
        if (c.flowType === 'EXPENSE') {
          expenses = expenses.plus(amt);
        } else {
          income = income.plus(amt);
        }
      }

      bucket.projectedExpenses = expenses.toFixed(2);
      bucket.projectedIncome   = income.toFixed(2);
      bucket.netCashFlow       = income.minus(expenses).toFixed(2);
    }

    return {
      dataQuality: 'ESTIMATE',
      currency,
      generatedAt: now,
      months,
      forecast: buckets,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the zero-based bucket index (0 = current month) for a given date.
   */
  private bucketIndex(date: Date, now: Date): number {
    const yearDiff  = date.getUTCFullYear() - now.getUTCFullYear();
    const monthDiff = date.getUTCMonth()    - now.getUTCMonth();
    return yearDiff * 12 + monthDiff;
  }

  /**
   * Advances `cursor` via calculateNextDueDate() until it is >= windowStart.
   * Uses large steps (YEARLY -> skip by year, MONTHLY -> skip months) to avoid
   * O(n_years * 365) iterations for very old commitments.
   */
  private fastForwardToWindow(
    cursor: Date,
    recurrence: RecurrenceFrequency,
    windowStart: Date,
  ): Date {
    // For coarse frequencies, jump by large increments first.
    if (recurrence === RecurrenceFrequency.DAILY) {
      const daysNeeded = Math.floor(
        (windowStart.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysNeeded > 0) {
        cursor = new Date(cursor);
        cursor.setUTCDate(cursor.getUTCDate() + daysNeeded);
      }
    } else if (recurrence === RecurrenceFrequency.WEEKLY) {
      const weeksNeeded = Math.floor(
        (windowStart.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24 * 7),
      );
      if (weeksNeeded > 0) {
        cursor = new Date(cursor);
        cursor.setUTCDate(cursor.getUTCDate() + weeksNeeded * 7);
      }
    } else if (recurrence === RecurrenceFrequency.MONTHLY) {
      const monthsNeeded =
        (windowStart.getUTCFullYear() - cursor.getUTCFullYear()) * 12 +
        (windowStart.getUTCMonth() - cursor.getUTCMonth());
      if (monthsNeeded > 1) {
        cursor = new Date(cursor);
        cursor.setUTCMonth(cursor.getUTCMonth() + (monthsNeeded - 1));
      }
    } else if (recurrence === RecurrenceFrequency.YEARLY) {
      const yearsNeeded = windowStart.getUTCFullYear() - cursor.getUTCFullYear();
      if (yearsNeeded > 1) {
        cursor = new Date(cursor);
        cursor.setUTCFullYear(cursor.getUTCFullYear() + (yearsNeeded - 1));
      }
    }
    return cursor;
  }

  /**
   * Converts a Prisma commitment row into a ProjectedCommitmentDto and
   * appends it to the given monthly bucket.
   *
   * `overrideDate` is used for recurring occurrences where the projected
   * dueDate differs from the stored dueDate.
   */
  private addCommitmentToBucket(
    bucket: MonthlyForecastDto,
    commitment: any,
    overrideDate?: Date,
  ): void {
    const projected: ProjectedCommitmentDto = {
      id:              commitment.id,
      name:            commitment.name,
      amount:          new Decimal(commitment.amount.toString()).toFixed(2),
      currency:        commitment.currency,
      projectedDueDate: overrideDate ?? new Date(commitment.dueDate),
      flowType:        commitment.flowType ?? 'EXPENSE',
    };
    bucket.commitments.push(projected);
  }
}
