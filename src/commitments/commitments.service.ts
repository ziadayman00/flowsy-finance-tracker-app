import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCommitmentDto } from './dto/create-commitment.dto';
import { UpdateCommitmentDto } from './dto/update-commitment.dto';
import { PayCommitmentDto } from './dto/pay-commitment.dto';
import { CommitmentResponseDto } from './dto/commitment-response.dto';
import {
  CommitmentStatus,
  RecurrenceFrequency,
  TransactionType,
  Prisma,
} from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class CommitmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapToDto(c: any): CommitmentResponseDto {
    return {
      id: c.id,
      name: c.name,
      amount: new Decimal(c.amount.toString()).toFixed(2),
      currency: c.currency,
      dueDate: c.dueDate,
      status: c.status,
      recurrence: c.recurrence,
      accountId: c.accountId,
      categoryId: c.categoryId,
      paidTransactionId: c.paidTransactionId,
      createdAt: c.createdAt,
    };
  }

  /**
   * Calculates the next due date for recurring commitments.
   * Month-end clamping rule (DAT-01):
   * When a monthly commitment is configured for the 28th, 29th, 30th, or 31st (or the last day of the month):
   * 1. Preserves the intended day of the month (targetDay).
   * 2. If target month has fewer days than targetDay (e.g. Feb in non-leap year has 28 days),
   *    clamps to the final valid day of that target month (e.g. Feb 28).
   * 3. Subsequent occurrences restore the original target day if the target month has enough days
   *    (e.g., Jan 31 -> Feb 28 -> Mar 31; Aug 31 -> Sep 30 -> Oct 31).
   * 4. For YEARLY recurrence, Feb 29 in leap years advances to Feb 28 in non-leap years.
   */
  public calculateNextDueDate(
    currentDueDate: Date,
    recurrence: RecurrenceFrequency,
    targetDay?: number,
  ): Date {
    const next = new Date(currentDueDate);
    switch (recurrence) {
      case RecurrenceFrequency.DAILY:
        next.setDate(next.getDate() + 1);
        break;
      case RecurrenceFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case RecurrenceFrequency.MONTHLY: {
        const currentYear = next.getFullYear();
        const currentMonth = next.getMonth(); // 0-indexed: 0=Jan, 11=Dec
        const currentDay = next.getDate();

        // Check if current date is the last day of its month
        const daysInCurrentMonth = new Date(
          currentYear,
          currentMonth + 1,
          0,
        ).getDate();
        const isCurrentLastDay = currentDay === daysInCurrentMonth;

        let intendedDay = targetDay ?? currentDay;
        if (!targetDay && isCurrentLastDay && currentDay >= 28) {
          intendedDay = 31;
        }

        const targetYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        const targetMonth = (currentMonth + 1) % 12;

        const daysInTargetMonth = new Date(
          targetYear,
          targetMonth + 1,
          0,
        ).getDate();
        const clampedDay = Math.min(intendedDay, daysInTargetMonth);

        next.setFullYear(targetYear, targetMonth, clampedDay);
        break;
      }
      case RecurrenceFrequency.YEARLY: {
        const currentYear = next.getFullYear();
        const currentMonth = next.getMonth();
        const currentDay = next.getDate();
        const targetYear = currentYear + 1;
        const daysInTargetMonth = new Date(
          targetYear,
          currentMonth + 1,
          0,
        ).getDate();
        const clampedDay = Math.min(currentDay, daysInTargetMonth);
        next.setFullYear(targetYear, currentMonth, clampedDay);
        break;
      }
      default:
        break;
    }
    return next;
  }

  /**
   * Marks past-due PENDING commitments for a user as OVERDUE.
   *
   * This is intentionally a separate method from findAll() to avoid write-on-read
   * side effects (GAP-04). It should be called:
   *   - By a scheduled job (e.g. nightly) to keep statuses current.
   *   - Explicitly before a commitment list read where up-to-date status is critical.
   *
   * Calling it inside findAll() created a race condition: two concurrent GET /commitments
   * requests would both attempt to updateMany() the same rows, and any scheduled job
   * would compete with API reads. Separating it makes the intent explicit.
   */
  async markOverdueForUser(userId: string): Promise<number> {
    const now = new Date();
    const result = await this.prisma.commitment.updateMany({
      where: {
        userId,
        status: CommitmentStatus.PENDING,
        dueDate: { lt: now },
      },
      data: {
        status: CommitmentStatus.OVERDUE,
      },
    });
    return result.count;
  }

  async findAll(
    userId: string,
    status?: CommitmentStatus,
  ): Promise<CommitmentResponseDto[]> {
    // Note: OVERDUE status transitions happen via markOverdueForUser(), called by
    // a scheduled job. findAll() is a pure read — it does not modify commitment status.
    // Clients that require up-to-date status should call the reconcile endpoint first.
    const commitments = await this.prisma.commitment.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: { dueDate: 'asc' },
    });

    return commitments.map((c) => this.mapToDto(c));
  }

  async findById(
    userId: string,
    commitmentId: string,
  ): Promise<CommitmentResponseDto> {
    const c = await this.prisma.commitment.findFirst({
      where: { id: commitmentId, userId },
    });

    if (!c) {
      throw new NotFoundException('Commitment not found');
    }

    return this.mapToDto(c);
  }

  async create(
    userId: string,
    dto: CreateCommitmentDto,
  ): Promise<CommitmentResponseDto> {
    if (dto.accountId) {
      const acc = await this.prisma.financialAccount.findFirst({
        where: { id: dto.accountId, userId },
      });
      if (!acc) throw new NotFoundException('Linked financial account not found');
    }

    if (dto.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, OR: [{ userId: null }, { userId }] },
      });
      if (!cat) throw new NotFoundException('Linked category not found');
    }

    const dueDate = new Date(dto.dueDate);
    const now = new Date();
    const status =
      dueDate < now ? CommitmentStatus.OVERDUE : CommitmentStatus.PENDING;

    const commitment = await this.prisma.commitment.create({
      data: {
        userId,
        name: dto.name,
        amount: new Prisma.Decimal(dto.amount.toFixed(2)),
        currency: dto.currency || 'EGP',
        dueDate,
        status,
        recurrence: dto.recurrence || RecurrenceFrequency.NONE,
        accountId: dto.accountId || null,
        categoryId: dto.categoryId || null,
      },
    });

    return this.mapToDto(commitment);
  }

  async update(
    userId: string,
    commitmentId: string,
    dto: UpdateCommitmentDto,
  ): Promise<CommitmentResponseDto> {
    await this.findById(userId, commitmentId);

    const updated = await this.prisma.commitment.update({
      where: { id: commitmentId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.amount !== undefined
          ? { amount: new Prisma.Decimal(dto.amount.toFixed(2)) }
          : {}),
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.recurrence ? { recurrence: dto.recurrence } : {}),
        ...(dto.accountId !== undefined ? { accountId: dto.accountId } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      },
    });

    return this.mapToDto(updated);
  }

  async delete(
    userId: string,
    commitmentId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.findById(userId, commitmentId);

    await this.prisma.commitment.delete({
      where: { id: commitmentId },
    });

    return { success: true, message: 'Commitment deleted successfully' };
  }

  async pay(
    userId: string,
    commitmentId: string,
    dto: PayCommitmentDto,
  ): Promise<{ commitment: CommitmentResponseDto; transactionId: string }> {
    const commitment = await this.prisma.commitment.findFirst({
      where: { id: commitmentId, userId },
    });

    if (!commitment) {
      throw new NotFoundException('Commitment not found');
    }

    if (commitment.status === CommitmentStatus.PAID) {
      throw new BadRequestException('This commitment has already been marked as paid');
    }

    // Verify paying account
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: dto.accountId, userId },
    });

    if (!account) {
      throw new NotFoundException('Financial account not found');
    }

    if (account.currency !== commitment.currency) {
      throw new BadRequestException(
        `Cross-currency payments are not supported. Account currency is ${account.currency}, commitment currency is ${commitment.currency}.`,
      );
    }

    const paymentDate = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const amountDecimal = commitment.amount;

    // Execute atomic payment: claim commitment lock, create EXPENSE transaction, deduct account balance, mark PAID, schedule recurrence
    const result = await this.prisma.$transaction(async (prismaTx) => {
      // 1. Atomically claim/lock the commitment using conditional update (CON-01)
      // Only one concurrent request can transition a non-PAID commitment to PAID.
      const lockResult = await prismaTx.commitment.updateMany({
        where: {
          id: commitmentId,
          userId,
          status: { not: CommitmentStatus.PAID },
        },
        data: {
          status: CommitmentStatus.PAID,
          accountId: dto.accountId,
        },
      });

      if (lockResult.count === 0) {
        throw new BadRequestException(
          'This commitment has already been marked as paid',
        );
      }

      // 2. Create corresponding expense transaction
      const tx = await prismaTx.transaction.create({
        data: {
          userId,
          accountId: dto.accountId,
          categoryId: commitment.categoryId,
          type: TransactionType.EXPENSE,
          amount: amountDecimal,
          currency: commitment.currency,
          note: dto.note || `سداد التزام: ${commitment.name}`,
          transactionDate: paymentDate,
        },
      });

      // 3. Decrement account balance
      await prismaTx.financialAccount.update({
        where: { id: dto.accountId },
        data: {
          currentBalance: { decrement: amountDecimal },
        },
      });

      // 4. Link paidTransactionId on the commitment
      const updatedCommitment = await prismaTx.commitment.update({
        where: { id: commitmentId },
        data: {
          paidTransactionId: tx.id,
        },
      });

      // 4. If recurring, spawn the next occurrence for future due date
      if (commitment.recurrence !== RecurrenceFrequency.NONE) {
        const nextDueDate = this.calculateNextDueDate(
          commitment.dueDate,
          commitment.recurrence,
        );

        await prismaTx.commitment.create({
          data: {
            userId,
            name: commitment.name,
            amount: commitment.amount,
            currency: commitment.currency,
            dueDate: nextDueDate,
            status: CommitmentStatus.PENDING,
            recurrence: commitment.recurrence,
            accountId: commitment.accountId,
            categoryId: commitment.categoryId,
          },
        });
      }

      return {
        commitment: this.mapToDto(updatedCommitment),
        transactionId: tx.id,
      };
    });

    return result;
  }
}
