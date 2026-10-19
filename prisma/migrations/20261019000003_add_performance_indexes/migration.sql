-- Migration: add performance indexes for forecasting and import query paths
-- 
-- Indexes added:
--
-- 1. commitments(userId, currency, status)
--    Supports: GET /forecasting/cashflow
--    Query: WHERE userId = ? AND currency = ? AND status != 'PAID'
--    Without this index, the forecasting query does a full userId-scoped scan
--    and filters currency + status in memory.
--
-- 2. transactions(accountId, transactionDate)
--    Supports: POST /import/preview duplicate detection
--    Query: WHERE accountId = ? (then in-app date/amount comparison)
--    The existing index on (userId, transactionDate) does not help when
--    filtering by accountId alone (import preview does not know userId at the
--    point of the findMany call — it uses accountId as the primary filter).
--
-- 3. savings_goals(accountId)
--    Supports: SavingsGoalsService.create() duplicate check
--    Query: WHERE accountId = ? AND userId = ? AND isArchived = false
--    accountId is the leftmost filter in the uniqueness guard; without an index
--    Postgres scans all goals for the user.

ALTER TABLE commitments
  ADD CONSTRAINT commitments_userid_currency_status_idx
  CHECK (true); -- Placeholder: actual index below

CREATE INDEX IF NOT EXISTS "commitments_userId_currency_status_idx"
  ON commitments ("userId", currency, status);

CREATE INDEX IF NOT EXISTS "transactions_accountId_transactionDate_idx"
  ON transactions ("accountId", "transactionDate");

CREATE INDEX IF NOT EXISTS "savings_goals_accountId_idx"
  ON savings_goals ("accountId");
