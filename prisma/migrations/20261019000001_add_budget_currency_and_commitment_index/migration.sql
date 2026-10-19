-- Migration: 20261019000001_add_budget_currency_and_commitment_index
--
-- Purpose:
--   1. Add `currency` column to `budgets` table.
--      Budgets must be single-currency instruments so that expense aggregation
--      only sums transactions in the same currency. Without this column,
--      multi-currency users (e.g. EGP + USD accounts) would have all expense
--      transactions summed together regardless of currency, corrupting budget
--      "spent" and "remaining" values.
--      Backfills all existing rows to 'EGP' (the system default). This is safe:
--      at the time of this migration no production data exists with non-EGP budgets.
--
--   2. Add index on `commitments.paidTransactionId`.
--      The transaction delete flow calls `findMany` on commitments filtered by
--      `paidTransactionId`. Without an index this is a full commitments table scan
--      per transaction deletion, which degrades as the user's commitment history grows.
--
-- Rollback notes:
--   - Adding a column with a DEFAULT is safe and reversible (DROP COLUMN).
--   - Adding an index is safe and reversible (DROP INDEX).
--   - No data loss on rollback. Existing budget rows retain 'EGP'.

-- AddColumn: budgets.currency (NOT NULL with DEFAULT 'EGP', backfills existing rows)
ALTER TABLE "budgets" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EGP';

-- AddIndex: fast lookup of commitments by paidTransactionId
-- Used by TransactionsService.delete() to restore linked commitments on tx reversal.
CREATE INDEX "commitments_paidTransactionId_idx" ON "commitments"("paidTransactionId");
