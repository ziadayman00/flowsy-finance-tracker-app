import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountResponseDto } from './dto/account-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class FinancialAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapToDto(account: {
    id: string;
    name: string;
    type: any;
    currency: string;
    initialBalance: Prisma.Decimal;
    currentBalance: Prisma.Decimal;
    isArchived: boolean;
    excludeFromSafeToSpend: boolean;
    createdAt: Date;
  }): AccountResponseDto {
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      initialBalance: account.initialBalance.toFixed(2),
      currentBalance: account.currentBalance.toFixed(2),
      isArchived: account.isArchived,
      excludeFromSafeToSpend: account.excludeFromSafeToSpend,
      createdAt: account.createdAt,
    };
  }

  async findAll(
    userId: string,
    includeArchived: boolean = false,
  ): Promise<AccountResponseDto[]> {
    const accounts = await this.prisma.financialAccount.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: { createdAt: 'asc' },
    });

    return accounts.map((acc) => this.mapToDto(acc));
  }

  async findById(userId: string, accountId: string): Promise<AccountResponseDto> {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new NotFoundException('Financial account not found');
    }

    return this.mapToDto(account);
  }

  async create(
    userId: string,
    dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    const existing = await this.prisma.financialAccount.findFirst({
      where: { userId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException(
        `An account with the name "${dto.name}" already exists`,
      );
    }

    const initialAmount = dto.initialBalance ? dto.initialBalance : 0.0;

    const account = await this.prisma.financialAccount.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        currency: dto.currency || 'EGP',
        initialBalance: initialAmount,
        currentBalance: initialAmount,
        excludeFromSafeToSpend: dto.excludeFromSafeToSpend || false,
      },
    });

    return this.mapToDto(account);
  }

  async update(
    userId: string,
    accountId: string,
    dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    // Confirm ownership
    await this.findById(userId, accountId);

    if (dto.name) {
      const existingName = await this.prisma.financialAccount.findFirst({
        where: {
          userId,
          name: dto.name,
          NOT: { id: accountId },
        },
      });

      if (existingName) {
        throw new ConflictException(
          `Another account with the name "${dto.name}" already exists`,
        );
      }
    }

    const updated = await this.prisma.financialAccount.update({
      where: { id: accountId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.excludeFromSafeToSpend !== undefined
          ? { excludeFromSafeToSpend: dto.excludeFromSafeToSpend }
          : {}),
        ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
      },
    });

    return this.mapToDto(updated);
  }

  async delete(
    userId: string,
    accountId: string,
  ): Promise<{ success: boolean; message: string }> {
    // Confirm ownership
    await this.findById(userId, accountId);

    // Guard: check if transactions or commitments reference this account
    const transactionCount = await this.prisma.transaction.count({
      where: {
        OR: [{ accountId }, { destinationAccountId: accountId }],
      },
    });

    if (transactionCount > 0) {
      throw new BadRequestException(
        'Cannot permanently delete an account with recorded transactions. Please archive the account instead to preserve financial history.',
      );
    }

    const commitmentCount = await this.prisma.commitment.count({
      where: { accountId },
    });

    if (commitmentCount > 0) {
      throw new BadRequestException(
        'Cannot permanently delete an account linked to commitments. Please unlink or archive the account instead.',
      );
    }

    await this.prisma.financialAccount.delete({
      where: { id: accountId },
    });

    return { success: true, message: 'Account deleted successfully' };
  }
}
