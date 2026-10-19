-- Migration: 20261019000002_add_savings_goals
--
-- Purpose:
--   Add the `savings_goals` table to support the Savings Goals feature.
--
--   A savings goal links to a specific FinancialAccount and tracks progress
--   toward a monetary target. The account's `currentBalance` serves as the
--   progress indicator — no separate ledger is needed. The account's existing
--   currency is the goal's implicit currency, avoiding currency drift.
--
--   Deletion policy: RESTRICT on accountId to prevent orphaned goals when
--   an account with a goal is deleted. Users must archive the goal first
--   or re-link it to a different account.
--
-- Rollback notes:
--   DROP TABLE "savings_goals" — safe, no other tables depend on it.
--   This is a purely additive migration with no impact on existing data.

-- CreateTable
CREATE TABLE "savings_goals" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "accountId"    TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "targetAmount" DECIMAL(14,2) NOT NULL,
    "targetDate"   TIMESTAMP(3),
    "note"         TEXT,
    "isArchived"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "savings_goals_userId_isArchived_idx" ON "savings_goals"("userId", "isArchived");

-- AddForeignKey: user ownership (cascade delete when user is deleted)
ALTER TABLE "savings_goals"
  ADD CONSTRAINT "savings_goals_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: account link (RESTRICT — cannot delete account while goals reference it)
ALTER TABLE "savings_goals"
  ADD CONSTRAINT "savings_goals_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
