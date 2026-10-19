import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import {
  PaginatedTransactionsDto,
  TransactionResponseDto,
} from './dto/transaction-response.dto';
import { Prisma, TransactionType, CommitmentStatus } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapToDto(tx: any): TransactionResponseDto {
    return {
      id: tx.id,
      type: tx.type,
      amount: new Decimal(tx.amount.toString()).toFixed(2),
      currency: tx.currency,
      note: tx.note,
      transactionDate: tx.transactionDate,
      account: {
        id: tx.account.id,
        name: tx.account.name,
      },
      category: tx.category
        ? {
            id: tx.category.id,
            name: tx.category.name,
            icon: tx.category.icon,
          }
        : null,
      destinationAccount: tx.destinationAccount
        ? {
            id: tx.destinationAccount.id,
            name: tx.destinationAccount.name,
          }
        : null,
      createdAt: tx.createdAt,
    };
  }

  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    // 1. Verify primary account exists and belongs to user
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: dto.accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Primary financial account not found');
    }

    // 2. Validate category if provided
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

    // 3. Handle TRANSFER specific validation
    let destAccount: any = null;
    if (dto.type === TransactionType.TRANSFER) {
      if (!dto.destinationAccountId) {
        throw new BadRequestException(
          'destinationAccountId is required for transfer transactions',
        );
      }
      if (dto.accountId === dto.destinationAccountId) {
        throw new BadRequestException(
          'Cannot transfer money to the same account',
        );
      }
      destAccount = await this.prisma.financialAccount.findFirst({
        where: { id: dto.destinationAccountId, userId },
      });
      if (!destAccount) {
        throw new NotFoundException('Destination financial account not found');
      }
      if (account.currency !== destAccount.currency) {
        throw new BadRequestException(
          `Cross-currency transfers are not supported. Source account is ${account.currency}, destination account is ${destAccount.currency}.`,
        );
      }
    }

    const txDate = dto.transactionDate
      ? new Date(dto.transactionDate)
      : new Date();
    const amountDecimal = new Prisma.Decimal(dto.amount.toFixed(2));

    // 4. Execute atomic balance mutation and transaction creation
    const createdTx = await this.prisma.$transaction(async (prismaTx) => {
      // Balance updates
      if (dto.type === TransactionType.INCOME) {
        await prismaTx.financialAccount.update({
          where: { id: account.id },
          data: {
            currentBalance: {
              increment: amountDecimal,
            },
          },
        });
      } else if (dto.type === TransactionType.EXPENSE) {
        await prismaTx.financialAccount.update({
          where: { id: account.id },
          data: {
            currentBalance: {
              decrement: amountDecimal,
            },
          },
        });
      } else if (dto.type === TransactionType.TRANSFER) {
        // Debit source account
        await prismaTx.financialAccount.update({
          where: { id: account.id },
          data: {
            currentBalance: {
              decrement: amountDecimal,
            },
          },
        });
        // Credit destination account
        await prismaTx.financialAccount.update({
          where: { id: destAccount.id },
          data: {
            currentBalance: {
              increment: amountDecimal,
            },
          },
        });
      }

      return prismaTx.transaction.create({
        data: {
          userId,
          accountId: dto.accountId,
          categoryId: dto.categoryId || null,
          destinationAccountId: dto.destinationAccountId || null,
          type: dto.type,
          amount: amountDecimal,
          currency: account.currency,
          note: dto.note || null,
          transactionDate: txDate,
        },
        include: {
          account: true,
          category: true,
          destinationAccount: true,
        },
      });
    });

    return this.mapToDto(createdTx);
  }

  async createBatch(
    userId: string,
    dtos: CreateTransactionDto[],
  ): Promise<{ created: TransactionResponseDto[]; count: number }> {
    if (!dtos || dtos.length === 0) {
      throw new BadRequestException('At least one transaction is required');
    }

    // Pre-validate all accounts and categories exist and belong to user
    const accountIds = Array.from(new Set(dtos.map((d) => d.accountId)));
    const categoryIds = Array.from(
      new Set(dtos.map((d) => d.categoryId).filter((id): id is string => Boolean(id))),
    );

    const accounts = await this.prisma.financialAccount.findMany({
      where: { id: { in: accountIds }, userId },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    for (const accId of accountIds) {
      if (!accountMap.has(accId)) {
        throw new NotFoundException(`Financial account ${accId} not found`);
      }
    }

    if (categoryIds.length > 0) {
      const categories = await this.prisma.category.findMany({
        where: {
          id: { in: categoryIds },
          OR: [{ userId: null }, { userId }],
        },
      });
      const categoryMap = new Map(categories.map((c) => [c.id, c]));
      for (const catId of categoryIds) {
        if (!categoryMap.has(catId)) {
          throw new NotFoundException(`Category ${catId} not found`);
        }
      }
    }

    // Atomic execution for all transactions in batch
    const createdTransactions = await this.prisma.$transaction(async (prismaTx) => {
      const results = [];

      for (const dto of dtos) {
        const account = accountMap.get(dto.accountId)!;
        let destAccount: any = null;

        if (dto.type === TransactionType.TRANSFER) {
          if (!dto.destinationAccountId) {
            throw new BadRequestException(
              'destinationAccountId is required for transfer transactions',
            );
          }
          if (dto.accountId === dto.destinationAccountId) {
            throw new BadRequestException(
              'Cannot transfer money to the same account',
            );
          }
          destAccount = await prismaTx.financialAccount.findFirst({
            where: { id: dto.destinationAccountId, userId },
          });
          if (!destAccount) {
            throw new NotFoundException('Destination financial account not found');
          }
          if (account.currency !== destAccount.currency) {
            throw new BadRequestException(
              `Cross-currency transfers are not supported. Source is ${account.currency}, destination is ${destAccount.currency}.`,
            );
          }
        }

        const txDate = dto.transactionDate
          ? new Date(dto.transactionDate)
          : new Date();
        const amountDecimal = new Prisma.Decimal(dto.amount.toFixed(2));

        if (dto.type === TransactionType.INCOME) {
          await prismaTx.financialAccount.update({
            where: { id: account.id },
            data: { currentBalance: { increment: amountDecimal } },
          });
        } else if (dto.type === TransactionType.EXPENSE) {
          await prismaTx.financialAccount.update({
            where: { id: account.id },
            data: { currentBalance: { decrement: amountDecimal } },
          });
        } else if (dto.type === TransactionType.TRANSFER) {
          await prismaTx.financialAccount.update({
            where: { id: account.id },
            data: { currentBalance: { decrement: amountDecimal } },
          });
          await prismaTx.financialAccount.update({
            where: { id: destAccount.id },
            data: { currentBalance: { increment: amountDecimal } },
          });
        }

        const tx = await prismaTx.transaction.create({
          data: {
            userId,
            accountId: dto.accountId,
            categoryId: dto.categoryId || null,
            destinationAccountId: dto.destinationAccountId || null,
            type: dto.type,
            amount: amountDecimal,
            currency: account.currency,
            note: dto.note || null,
            transactionDate: txDate,
          },
          include: {
            account: true,
            category: true,
            destinationAccount: true,
          },
        });

        results.push(tx);
      }

      return results;
    });

    const mapped = createdTransactions.map((tx) => this.mapToDto(tx));
    return {
      created: mapped,
      count: mapped.length,
    };
  }

  async findAll(
    userId: string,
    query: QueryTransactionsDto,
  ): Promise<PaginatedTransactionsDto> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.startDate || query.endDate
        ? {
            transactionDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [total, transactions] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          account: true,
          category: true,
          destinationAccount: true,
        },
      }),
    ]);

    return {
      data: transactions.map((t) => this.mapToDto(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(
    userId: string,
    transactionId: string,
  ): Promise<TransactionResponseDto> {
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: {
        account: true,
        category: true,
        destinationAccount: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    return this.mapToDto(tx);
  }

  async update(
    userId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: { account: true, destinationAccount: true },
    });

    if (!existing) {
      throw new NotFoundException('Transaction not found');
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

    const updatedTx = await this.prisma.$transaction(async (prismaTx) => {
      // If amount changed, adjust balances by difference
      if (dto.amount !== undefined) {
        const oldAmount = new Decimal(existing.amount.toString());
        const newAmount = new Decimal(dto.amount.toFixed(2));
        const diff = newAmount.minus(oldAmount);

        if (!diff.isZero()) {
          const diffDecimal = new Prisma.Decimal(diff.toFixed(2));

          if (existing.type === TransactionType.INCOME) {
            await prismaTx.financialAccount.update({
              where: { id: existing.accountId },
              data: { currentBalance: { increment: diffDecimal } },
            });
          } else if (existing.type === TransactionType.EXPENSE) {
            await prismaTx.financialAccount.update({
              where: { id: existing.accountId },
              data: { currentBalance: { decrement: diffDecimal } },
            });
          } else if (existing.type === TransactionType.TRANSFER) {
            await prismaTx.financialAccount.update({
              where: { id: existing.accountId },
              data: { currentBalance: { decrement: diffDecimal } },
            });
            if (existing.destinationAccountId) {
              await prismaTx.financialAccount.update({
                where: { id: existing.destinationAccountId },
                data: { currentBalance: { increment: diffDecimal } },
              });
            }
          }
        }
      }

      return prismaTx.transaction.update({
        where: { id: transactionId },
        data: {
          ...(dto.amount !== undefined
            ? { amount: new Prisma.Decimal(dto.amount.toFixed(2)) }
            : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.transactionDate !== undefined
            ? { transactionDate: new Date(dto.transactionDate) }
            : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
        },
        include: {
          account: true,
          category: true,
          destinationAccount: true,
        },
      });
    });

    return this.mapToDto(updatedTx);
  }

  async delete(
    userId: string,
    transactionId: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    // Atomic reversal of balance impact
    await this.prisma.$transaction(async (prismaTx) => {
      const amountDecimal = existing.amount;

      if (existing.type === TransactionType.INCOME) {
        // Reversing income = debit account
        await prismaTx.financialAccount.update({
          where: { id: existing.accountId },
          data: { currentBalance: { decrement: amountDecimal } },
        });
      } else if (existing.type === TransactionType.EXPENSE) {
        // Reversing expense = credit account
        await prismaTx.financialAccount.update({
          where: { id: existing.accountId },
          data: { currentBalance: { increment: amountDecimal } },
        });
      } else if (existing.type === TransactionType.TRANSFER) {
        // Reversing transfer = refund source, debit destination
        await prismaTx.financialAccount.update({
          where: { id: existing.accountId },
          data: { currentBalance: { increment: amountDecimal } },
        });
        if (existing.destinationAccountId) {
          await prismaTx.financialAccount.update({
            where: { id: existing.destinationAccountId },
            data: { currentBalance: { decrement: amountDecimal } },
          });
        }
      }

      // If linked to a paid commitment, restore commitment to unpaid state (OVERDUE or PENDING based on dueDate)
      const linkedCommitments = await prismaTx.commitment.findMany({
        where: { paidTransactionId: transactionId },
      });

      const now = new Date();
      for (const commitment of linkedCommitments) {
        const restoredStatus =
          new Date(commitment.dueDate).getTime() < now.getTime()
            ? CommitmentStatus.OVERDUE
            : CommitmentStatus.PENDING;

        await prismaTx.commitment.update({
          where: { id: commitment.id },
          data: {
            status: restoredStatus,
            paidTransactionId: null,
          },
        });
      }

      await prismaTx.transaction.delete({
        where: { id: transactionId },
      });
    });

    return { success: true, message: 'Transaction reversed and deleted successfully' };
  }
}
