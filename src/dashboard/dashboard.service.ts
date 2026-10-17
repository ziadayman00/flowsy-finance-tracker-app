import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  DashboardSummaryDto,
  SafeToSpendBreakdownDto,
  MonthlySummaryDto,
} from './dto/dashboard-summary.dto';
import { CommitmentStatus, TransactionType } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string): Promise<DashboardSummaryDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const userCurrency = user?.currency || 'EGP';

    // 1. Fetch all active accounts
    const accounts = await this.prisma.financialAccount.findMany({
      where: { userId, isArchived: false },
      orderBy: { createdAt: 'asc' },
    });

    let liquidFunds = new Decimal(0);
    let protectedSavings = new Decimal(0);

    const accountSummaries = accounts.map((acc) => {
      const balance = new Decimal(acc.currentBalance.toString());
      if (acc.excludeFromSafeToSpend) {
        protectedSavings = protectedSavings.plus(balance);
      } else {
        liquidFunds = liquidFunds.plus(balance);
      }

      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        currentBalance: balance.toFixed(2),
        excludeFromSafeToSpend: acc.excludeFromSafeToSpend,
      };
    });

    // 2. Fetch outstanding qualifying commitments (PENDING or OVERDUE)
    // By default, obligations within the current month / cycle
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const pendingCommitments = await this.prisma.commitment.findMany({
      where: {
        userId,
        status: { in: [CommitmentStatus.PENDING, CommitmentStatus.OVERDUE] },
        dueDate: { lte: endOfMonth },
      },
    });

    let totalPendingCommitments = new Decimal(0);
    for (const c of pendingCommitments) {
      totalPendingCommitments = totalPendingCommitments.plus(
        new Decimal(c.amount.toString()),
      );
    }

    // 3. Compute Safe-to-Spend ("تقدر تصرف كام؟")
    const spendableDiff = liquidFunds.minus(totalPendingCommitments);
    const isDeficit = spendableDiff.isNegative();
    const deficitAmount = isDeficit ? spendableDiff.abs() : new Decimal(0);

    const safeToSpend: SafeToSpendBreakdownDto = {
      safeToSpend: spendableDiff.toFixed(2),
      currency: userCurrency,
      totalLiquidFunds: liquidFunds.toFixed(2),
      totalPendingCommitments: totalPendingCommitments.toFixed(2),
      pendingCommitmentsCount: pendingCommitments.length,
      isDeficit,
      deficitAmount: deficitAmount.toFixed(2),
      calculatedAt: now,
    };

    // 4. Calculate Current Month Inflow vs Outflow
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [incomeAggregate, expenseAggregate] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: TransactionType.INCOME,
          transactionDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: TransactionType.EXPENSE,
          transactionDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    const income = incomeAggregate._sum.amount
      ? new Decimal(incomeAggregate._sum.amount.toString())
      : new Decimal(0);

    const expenses = expenseAggregate._sum.amount
      ? new Decimal(expenseAggregate._sum.amount.toString())
      : new Decimal(0);

    const netSavings = income.minus(expenses);

    const monthlySummary: MonthlySummaryDto = {
      income: income.toFixed(2),
      expenses: expenses.toFixed(2),
      netSavings: netSavings.toFixed(2),
      periodStart: startOfMonth,
      periodEnd: endOfMonth,
    };

    return {
      safeToSpend,
      monthlySummary,
      totalLiquidBalance: liquidFunds.toFixed(2),
      totalProtectedSavings: protectedSavings.toFixed(2),
      accounts: accountSummaries,
    };
  }
}
