import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  ImportPreviewDto,
  ImportPreviewResponseDto,
  ImportRowResultDto,
  ImportCommitDto,
  ImportCommitResponseDto,
} from './dto/import.dto';
import { TransactionType, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

/**
 * In-memory session store for import previews.
 *
 * Design note: This is intentionally simple. Import sessions are short-lived
 * (the user previews then immediately commits). A persistent session store
 * (Redis, DB table) can be introduced if needed, but for an initial release
 * this avoids extra infrastructure.
 *
 * Sessions expire after 15 minutes. Memory footprint is bounded because each
 * row is small and sessions are evicted on expiry.
 */
interface ImportSession {
  userId: string;
  accountId: string;
  rows: ImportRowResultDto[];
  expiresAt: number; // Unix epoch ms
}

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class ImportService {
  /** In-memory session map. Key = sessionId (UUID). */
  private readonly sessions = new Map<string, ImportSession>();

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Preview
  // ---------------------------------------------------------------------------

  /**
   * Parses and validates an array of transaction rows, runs duplicate detection,
   * stores a short-lived preview session, and returns a classification report.
   *
   * No database writes occur during preview.
   *
   * Duplicate detection heuristic:
   *   Same accountId + amount + type + date within ±1 calendar day.
   * This is a best-effort check — it flags likely duplicates but the user
   * remains in control (LIKELY_DUPLICATE rows can still be committed).
   */
  async preview(
    userId: string,
    dto: ImportPreviewDto,
  ): Promise<ImportPreviewResponseDto> {
    // Verify the account belongs to this user.
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: dto.accountId, userId, isArchived: false },
    });

    if (!account) {
      throw new NotFoundException(
        'Financial account not found or is archived.',
      );
    }

    if (!dto.rows || dto.rows.length === 0) {
      throw new BadRequestException('Import rows array must not be empty.');
    }

    if (dto.rows.length > 1000) {
      throw new BadRequestException(
        'Import batch too large. Maximum 1000 rows per import.',
      );
    }

    // Load existing transactions in the account for duplicate detection.
    // We load only enough data to run the heuristic (id, date, amount, type).
    const existingTransactions = await this.prisma.transaction.findMany({
      where: { accountId: dto.accountId },
      select: { id: true, transactionDate: true, amount: true, type: true },
    });

    // ---------------------------------------------------------------------------
    // Classify each row.
    // ---------------------------------------------------------------------------
    const classifiedRows: ImportRowResultDto[] = dto.rows.map((row, idx) => {
      const rowDate = new Date(row.date);

      // Find any existing transaction that matches on amount + type + date ±1d.
      const duplicate = existingTransactions.find((tx) => {
        const txAmount = new Decimal(tx.amount.toString());
        const rowAmount = new Decimal(row.amount.toString());

        if (!txAmount.equals(rowAmount)) return false;
        if (tx.type !== row.type) return false;

        const txDate = new Date(tx.transactionDate);
        const diffMs = Math.abs(rowDate.getTime() - txDate.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= 1;
      });

      if (duplicate) {
        return {
          rowIndex: idx,
          date: row.date,
          amount: new Decimal(row.amount.toString()).toFixed(2),
          currency: row.currency,
          type: row.type,
          note: row.note,
          status: 'LIKELY_DUPLICATE' as const,
          reason: `Possible duplicate of existing transaction (same amount, type, date ±1d)`,
          duplicateCandidateId: duplicate.id,
        };
      }

      return {
        rowIndex: idx,
        date: row.date,
        amount: new Decimal(row.amount.toString()).toFixed(2),
        currency: row.currency,
        type: row.type,
        note: row.note,
        status: 'NEW' as const,
      };
    });

    // ---------------------------------------------------------------------------
    // Store session.
    // ---------------------------------------------------------------------------
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, {
      userId,
      accountId: dto.accountId,
      rows: classifiedRows,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    // Evict stale sessions opportunistically (no separate cleanup job needed
    // at this scale — eviction runs on each preview call).
    this.evictExpiredSessions();

    return {
      sessionId,
      totalRows: classifiedRows.length,
      newCount: classifiedRows.filter((r) => r.status === 'NEW').length,
      duplicateCount: classifiedRows.filter(
        (r) => r.status === 'LIKELY_DUPLICATE',
      ).length,
      skippedCount: classifiedRows.filter((r) => r.status === 'SKIPPED').length,
      rows: classifiedRows,
    };
  }

  // ---------------------------------------------------------------------------
  // Commit
  // ---------------------------------------------------------------------------

  /**
   * Persists the rows accepted by the user from a previous preview session.
   *
   * If `rowIndices` is provided, only those rows are committed.
   * If omitted, all rows with status NEW are committed automatically.
   * LIKELY_DUPLICATE rows are only committed if explicitly included in rowIndices.
   *
   * All inserts happen inside a single database transaction for atomicity.
   * The account balance is updated within the same transaction to keep it
   * consistent with the new transactions.
   */
  async commit(
    userId: string,
    dto: ImportCommitDto,
  ): Promise<ImportCommitResponseDto> {
    const session = this.sessions.get(dto.sessionId);

    if (!session) {
      throw new BadRequestException(
        'Import session not found or has expired (sessions expire after 15 minutes). ' +
          'Please run /import/preview again.',
      );
    }

    if (session.userId !== userId) {
      throw new BadRequestException('Import session does not belong to this user.');
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(dto.sessionId);
      throw new BadRequestException(
        'Import session has expired. Please run /import/preview again.',
      );
    }

    // Determine which rows to commit.
    let rowsToCommit: ImportRowResultDto[];

    if (dto.rowIndices && dto.rowIndices.length > 0) {
      // User specified explicit indices. Validate them.
      rowsToCommit = dto.rowIndices.map((idx) => {
        const row = session.rows.find((r) => r.rowIndex === idx);
        if (!row) {
          throw new BadRequestException(
            `Row index ${idx} does not exist in the import session.`,
          );
        }
        if (row.status === 'SKIPPED') {
          throw new BadRequestException(
            `Row index ${idx} was skipped due to a validation error and cannot be committed.`,
          );
        }
        return row;
      });
    } else {
      // Default: commit all NEW rows (skip duplicates unless explicitly requested).
      rowsToCommit = session.rows.filter((r) => r.status === 'NEW');
    }

    if (rowsToCommit.length === 0) {
      return { imported: 0, skipped: session.rows.length, transactionIds: [] };
    }

    // Verify the account still exists and belongs to the user.
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: session.accountId, userId, isArchived: false },
    });

    if (!account) {
      throw new NotFoundException(
        'The target account is no longer available.',
      );
    }

    // ---------------------------------------------------------------------------
    // Persist inside a transaction + update account balance.
    // ---------------------------------------------------------------------------
    const createdIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      let balanceDelta = new Decimal('0');

      for (const row of rowsToCommit) {
        const amount = new Decimal(row.amount);

        const created = await tx.transaction.create({
          data: {
            userId,
            accountId: session.accountId,
            amount: new Prisma.Decimal(amount.toFixed(2)),
            currency: row.currency,
            type: row.type as TransactionType,
            transactionDate: new Date(row.date),
            note: row.note || null,
          },
        });

        createdIds.push(created.id);

        // Adjust balance delta: INCOME adds, EXPENSE subtracts, TRANSFER is neutral
        // from an account-level perspective (handled separately if cross-account).
        if (row.type === 'INCOME') {
          balanceDelta = balanceDelta.plus(amount);
        } else if (row.type === 'EXPENSE') {
          balanceDelta = balanceDelta.minus(amount);
        }
        // TRANSFER: no balance change on this account in an import context
        // (the corresponding contra account entry is not in scope for this import).
      }

      // Update account balance atomically.
      if (!balanceDelta.isZero()) {
        await tx.financialAccount.update({
          where: { id: session.accountId },
          data: {
            currentBalance: {
              increment: new Prisma.Decimal(balanceDelta.toFixed(2)),
            },
          },
        });
      }
    });

    // Invalidate the session after a successful commit.
    this.sessions.delete(dto.sessionId);

    return {
      imported: createdIds.length,
      skipped: session.rows.length - createdIds.length,
      transactionIds: createdIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private evictExpiredSessions(): void {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(key);
      }
    }
  }
}
