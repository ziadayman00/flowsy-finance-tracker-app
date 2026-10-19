import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSavingsGoalDto } from './dto/create-savings-goal.dto';
import { UpdateSavingsGoalDto } from './dto/update-savings-goal.dto';
import { SavingsGoalResponseDto } from './dto/savings-goal-response.dto';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class SavingsGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Maps a raw savings_goal + account record to the response DTO.
   *
   * Progress (currentAmount) is derived from the linked account's currentBalance,
   * not stored separately. This means progress is always accurate as long as
   * transactions against the account are correctly recorded.
   *
   * Currency is the account's currency — never stored on the goal itself to
   * prevent the goal currency and the account currency diverging.
   */
  private mapToDto(goal: any): SavingsGoalResponseDto {
    const target = new Decimal(goal.targetAmount.toString());
    const current = new Decimal(goal.account.currentBalance.toString());
    const remaining = target.minus(current);
    const percentage = target.isZero()
      ? 0
      : current.dividedBy(target).times(100).toNumber();

    return {
      id: goal.id,
      name: goal.name,
      targetAmount: target.toFixed(2),
      currency: goal.account.currency,
      currentAmount: current.toFixed(2),
      remainingAmount: remaining.toFixed(2),
      percentage: Math.round(percentage * 100) / 100,
      account: {
        id: goal.account.id,
        name: goal.account.name,
        type: goal.account.type,
      },
      targetDate: goal.targetDate,
      note: goal.note,
      isArchived: goal.isArchived,
      createdAt: goal.createdAt,
    };
  }

  private readonly includeAccount = {
    account: {
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
        currentBalance: true,
      },
    },
  };

  async findAll(
    userId: string,
    includeArchived: boolean = false,
  ): Promise<SavingsGoalResponseDto[]> {
    const goals = await this.prisma.savingsGoal.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: this.includeAccount,
      orderBy: { createdAt: 'desc' },
    });

    return goals.map((g: any) => this.mapToDto(g));
  }

  async findById(
    userId: string,
    goalId: string,
  ): Promise<SavingsGoalResponseDto> {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id: goalId, userId },
      include: this.includeAccount,
    });

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    return this.mapToDto(goal);
  }

  async create(
    userId: string,
    dto: CreateSavingsGoalDto,
  ): Promise<SavingsGoalResponseDto> {
    // Verify the account exists and belongs to this user
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: dto.accountId, userId, isArchived: false },
    });

    if (!account) {
      throw new NotFoundException(
        'Financial account not found or is archived. Savings goals must be linked to an active account.',
      );
    }

    // Prevent duplicate active goals on the same account
    const existingGoal = await this.prisma.savingsGoal.findFirst({
      where: { accountId: dto.accountId, userId, isArchived: false },
    });

    if (existingGoal) {
      throw new BadRequestException(
        `This account already has an active savings goal: "${existingGoal.name}". ` +
          'Archive or delete that goal before creating a new one for this account.',
      );
    }

    const goal = await this.prisma.savingsGoal.create({
      data: {
        userId,
        accountId: dto.accountId,
        name: dto.name,
        targetAmount: new Prisma.Decimal(dto.targetAmount.toFixed(2)),
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        note: dto.note || null,
      },
      include: this.includeAccount,
    });

    return this.mapToDto(goal);
  }

  async update(
    userId: string,
    goalId: string,
    dto: UpdateSavingsGoalDto,
  ): Promise<SavingsGoalResponseDto> {
    // Ownership check
    const existing = await this.prisma.savingsGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Savings goal not found');
    }

    // NOTE: accountId is deliberately not updatable.
    // Changing the account would silently change the currency and progress baseline
    // (because progress = account.currentBalance). If a user wants to track a
    // different account, they should archive this goal and create a new one.

    const updated = await this.prisma.savingsGoal.update({
      where: { id: goalId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.targetAmount !== undefined
          ? { targetAmount: new Prisma.Decimal(dto.targetAmount.toFixed(2)) }
          : {}),
        ...(dto.targetDate !== undefined
          ? { targetDate: dto.targetDate ? new Date(dto.targetDate) : null }
          : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
      },
      include: this.includeAccount,
    });

    return this.mapToDto(updated);
  }

  async delete(
    userId: string,
    goalId: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.savingsGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Savings goal not found');
    }

    // Deleting a savings goal does not affect the linked account or its balance.
    // The account continues to exist and hold its funds independently.
    await this.prisma.savingsGoal.delete({
      where: { id: goalId },
    });

    return { success: true, message: 'Savings goal deleted successfully' };
  }
}
