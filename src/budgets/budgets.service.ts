import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetResponseDto } from './dto/budget-response.dto';
import { TransactionType, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  private async calculateBudgetProgress(
    userId: string,
    budget: any,
  ): Promise<BudgetResponseDto> {
    const budgetAmount = new Decimal(budget.amount.toString());

    // GAP-03 FIX: Scope expense aggregation to transactions whose currency
    // matches the budget's declared currency (default EGP).
    //
    // Without this, a user with USD and EGP accounts would have their USD
    // transaction amounts summed into an EGP budget total — a category of
    // financial calculation corruption. Budgets are single-currency instruments.
    const budgetCurrency: string = budget.currency || 'EGP';

    // Aggregate all expenses during this budget interval, scoped to currency
    const expenseWhere: Prisma.TransactionWhereInput = {
      userId,
      type: TransactionType.EXPENSE,
      currency: budgetCurrency,
      transactionDate: {
        gte: budget.startDate,
        lte: budget.endDate,
      },
      ...(budget.categoryId ? { categoryId: budget.categoryId } : {}),
    };

    const expenseAggregate = await this.prisma.transaction.aggregate({
      where: expenseWhere,
      _sum: {
        amount: true,
      },
    });

    const spentDecimal = expenseAggregate._sum.amount
      ? new Decimal(expenseAggregate._sum.amount.toString())
      : new Decimal(0);

    const remainingDecimal = budgetAmount.minus(spentDecimal);
    const percentage = budgetAmount.isZero()
      ? 0
      : spentDecimal.dividedBy(budgetAmount).times(100).toNumber();

    return {
      id: budget.id,
      name: budget.name,
      amount: budgetAmount.toFixed(2),
      currency: budgetCurrency,
      spent: spentDecimal.toFixed(2),
      remaining: remainingDecimal.toFixed(2),
      percentage: Math.min(Math.round(percentage * 100) / 100, 999.99),
      categoryId: budget.categoryId,
      categoryName: budget.category ? budget.category.name : null,
      startDate: budget.startDate,
      endDate: budget.endDate,
      isArchived: budget.isArchived,
    };
  }

  async findAll(
    userId: string,
    includeArchived: boolean = false,
  ): Promise<BudgetResponseDto[]> {
    const budgets = await this.prisma.budget.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: {
        category: true,
      },
      orderBy: { startDate: 'desc' },
    });

    return Promise.all(
      budgets.map((b) => this.calculateBudgetProgress(userId, b)),
    );
  }

  async findById(userId: string, budgetId: string): Promise<BudgetResponseDto> {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, userId },
      include: { category: true },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    return this.calculateBudgetProgress(userId, budget);
  }

  async create(
    userId: string,
    dto: CreateBudgetDto,
  ): Promise<BudgetResponseDto> {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (start >= end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          OR: [{ userId: null }, { userId }],
        },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createData: any = {
      userId,
      name: dto.name,
      amount: new Prisma.Decimal(dto.amount.toFixed(2)),
      // currency is present in schema (migration 20261019000001) but stale Prisma
      // generated types may not reflect it until `prisma generate` is run.
      // This cast is removed once the generated client is regenerated.
      currency: dto.currency || 'EGP',
      categoryId: dto.categoryId || null,
      startDate: start,
      endDate: end,
    };

    const budget = await this.prisma.budget.create({
      data: createData,
      include: { category: true },
    });

    return this.calculateBudgetProgress(userId, budget);
  }

  async update(
    userId: string,
    budgetId: string,
    dto: UpdateBudgetDto,
  ): Promise<BudgetResponseDto> {
    await this.findById(userId, budgetId);

    if (dto.startDate && dto.endDate) {
      if (new Date(dto.startDate) >= new Date(dto.endDate)) {
        throw new BadRequestException('startDate must be before endDate');
      }
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          OR: [{ userId: null }, { userId }],
        },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const updated = await this.prisma.budget.update({
      where: { id: budgetId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.amount !== undefined
          ? { amount: new Prisma.Decimal(dto.amount.toFixed(2)) }
          : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
      },
      include: { category: true },
    });

    return this.calculateBudgetProgress(userId, updated);
  }

  async delete(
    userId: string,
    budgetId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.findById(userId, budgetId);

    await this.prisma.budget.delete({
      where: { id: budgetId },
    });

    return { success: true, message: 'Budget deleted successfully' };
  }
}
