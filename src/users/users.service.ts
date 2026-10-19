import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileDto } from '../auth/dto/auth-response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      currency: user.currency,
      timezone: user.timezone,
      createdAt: user.createdAt,
    };
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserProfileDto> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.displayName ? { displayName: dto.displayName } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
      },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      currency: user.currency,
      timezone: user.timezone,
      createdAt: user.createdAt,
    };
  }

  /**
   * Exports all data belonging to the user as a structured JSON object.
   *
   * Intended for GDPR / data-portability requests. No sensitive auth
   * material (password hash, refresh tokens) is included.
   *
   * The export is produced in a single read (no streaming required at this
   * scale). If the dataset grows very large, this method should be converted
   * to a background job with a download link.
   */
  async exportData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        financialAccounts: {
          include: {
            transactions: true,
          },
        },
        categories: true,
        commitments: true,
        budgets: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Omit passwordHash and any refresh token data for security.
    const { passwordHash: _pw, ...safeUser } = user as any;

    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: '1.0',
      user: safeUser,
    };
  }

  /**
   * Permanently deletes the user account and all associated data.
   *
   * Cascade deletes via Prisma relations handle:
   *   - FinancialAccounts → Transactions
   *   - Categories
   *   - Commitments
   *   - Budgets
   *   - RefreshTokens (if modelled)
   *
   * This is a destructive, irreversible operation. The caller is responsible
   * for revoking active JWT tokens before calling this method (done in
   * UsersController via the auth token invalidation step).
   *
   * NOTE: SavingsGoals will also be cascade-deleted once the migration
   * that adds them is applied (ON DELETE CASCADE is set in the migration SQL).
   */
  async deleteAccount(userId: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete the user. Prisma cascade rules (set in schema via onDelete) handle
    // child records. For tables without Prisma-level cascades, we delete
    // explicitly within a transaction to guarantee atomicity.
    await this.prisma.$transaction(async (tx) => {
      // Explicit deletes for tables that reference userId directly.
      // These must come before the user deletion.
      await tx.commitment.deleteMany({ where: { userId } });
      await tx.budget.deleteMany({ where: { userId } });
      await tx.category.deleteMany({ where: { userId } });
      // Transactions belong to financialAccounts which belong to the user.
      // Delete transactions first, then accounts.
      const accounts = await tx.financialAccount.findMany({
        where: { userId },
        select: { id: true },
      });
      const accountIds = accounts.map((a) => a.id);
      await tx.transaction.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await tx.financialAccount.deleteMany({ where: { userId } });
      // Finally delete the user record itself.
      await tx.user.delete({ where: { id: userId } });
    });

    return {
      success: true,
      message:
        'Account and all associated data have been permanently deleted. This action cannot be undone.',
    };
  }
}
