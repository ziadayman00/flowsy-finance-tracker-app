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

  private calculateNextDueDate(
    currentDueDate: Date,
    recurrence: RecurrenceFrequency,
  ): Date {
    const next = new Date(currentDueDate);
    switch (recurrence) {
      case RecurrenceFrequency.DAILY:
        next.setDate(next.getDate() + 1);
        break;
      case RecurrenceFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case RecurrenceFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        break;
      case RecurrenceFrequency.YEARLY:
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        break;
    }
    return next;
  }

  async findAll(
    userId: string,
    status?: CommitmentStatus,
  ): Promise<CommitmentResponseDto[]> {
    const now = new Date();

    // Dynamically mark past-due PENDING commitments as OVERDUE
    await this.prisma.commitment.updateMany({
      where: {
        userId,
        status: CommitmentStatus.PENDING,
        dueDate: { lt: now },
      },
      data: {
        status: CommitmentStatus.OVERDUE,
      },
    });

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

    const paymentDate = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const amountDecimal = commitment.amount;

    // Execute atomic payment: create EXPENSE transaction, deduct account balance, mark PAID, schedule recurrence
    const result = await this.prisma.$transaction(async (prismaTx) => {
      // 1. Create corresponding expense transaction
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

      // 2. Decrement account balance
      await prismaTx.financialAccount.update({
        where: { id: dto.accountId },
        data: {
          currentBalance: { decrement: amountDecimal },
        },
      });

      // 3. Mark current commitment as PAID with reference to transaction
      const updatedCommitment = await prismaTx.commitment.update({
        where: { id: commitmentId },
        data: {
          status: CommitmentStatus.PAID,
          paidTransactionId: tx.id,
          accountId: dto.accountId,
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
