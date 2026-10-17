# 5. Transaction Lifecycle, Balances, and Reversal Semantics

## Status
Accepted

## Context
In a personal finance application, users frequently record expenses or income in the moment, sometimes make typos in amounts, change categories, or delete mistake entries. Financial accounts must maintain an accurate balance reflecting this history.

## Decision
1. **Balance Semantics:**
   - Each `FinancialAccount` holds an immutable or audit-logged `initialBalance` (opening balance upon creation) plus a maintained `currentBalance` column updated within the same atomic database transaction as transaction writes.
   - For reconciliation and auditing, the balance is verifiable at any time by:
     `Verified Balance = initialBalance + SUM(INCOME) - SUM(EXPENSE) + SUM(TRANSFERS_IN) - SUM(TRANSFERS_OUT)`.
2. **Transaction Types:**
   - `INCOME`: Credits the associated account.
   - `EXPENSE`: Debits the associated account.
   - `TRANSFER`: Involves a `sourceAccountId` and a `destinationAccountId`. Atomically debits source and credits destination within a single database transaction. Transfers are neutral with respect to total net spending/income.
3. **Deletion & Mutation Semantics:**
   - When a transaction is updated (e.g. amount modified), the delta is atomically adjusted on the account balance.
   - If a transaction is deleted, the balance is reversed (e.g., deleting a 100 EGP expense credits 100 EGP back to the account).
   - In production or future expansion, soft deletion / reversal logs can be introduced; in the initial core release, deletion cleanly and atomically reverses account balance effects within `$transaction`.

## Alternatives Considered
- **Pure Event Sourcing / Calculating Balance solely on-the-fly:**
  - *Trade-off:* While pure `SUM()` on-the-fly guarantees no cache drift, running an aggregation over thousands of transaction rows on every single dashboard load introduces latency and database load.
  - *Decision:* Maintain `currentBalance` atomically with transaction mutations, while retaining full auditability through transaction records and providing an audit/reconciliation verification check.

## Consequences & Evolution Path
- Every create, update, and delete transaction operation must execute inside a Prisma interactive transaction `$transaction` to ensure balance integrity.
