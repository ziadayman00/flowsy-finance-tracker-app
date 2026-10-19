ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EGP';
CREATE INDEX IF NOT EXISTS "commitments_paidTransactionId_idx" ON "commitments"("paidTransactionId");
