# ADR-008: Savings Goals Design

**Status**: Accepted  
**Date**: 2026-10-19  
**Author**: Engineering (Flowsy Backend)

---

## Context

Users need to track progress toward a specific savings target (e.g., "شقة الأحلام — 200 000 EGP"). The mobile app requires a list of active goals with live progress, remaining amount, and percentage completion.

---

## Decision

### One goal per active account

A savings goal is linked to a **FinancialAccount**. Exactly one active goal is permitted per account. This avoids double-counting the same balance toward multiple goals.

### Progress is derived, not stored

`currentAmount` is computed at read time from `account.currentBalance`. There is **no separate progress field** on the SavingsGoal row. This means:

- Progress is always accurate as long as account transactions are correctly recorded.
- No separate "contribute to goal" action is needed — every deposit into the account advances all associated goals automatically.
- No background job is needed to keep a stored `currentAmount` in sync.

### Currency is inherited from the account

`SavingsGoal` does not store a `currency` field. The currency is always `account.currency`. This prevents the goal currency and account currency diverging silently.

### `accountId` is immutable after creation

Changing the linked account would silently change both the currency and the progress baseline. Users must archive the current goal and create a new one if they want to track a different account.

### Archive instead of delete

`isArchived` flag allows soft-archiving. Archived goals are excluded from the default list but retained for history. Hard delete is also supported via `DELETE /savings-goals/:id`.

---

## Alternatives Considered

| Alternative | Rejected Reason |
|---|---|
| Separate `currentAmount` stored on the goal | Would drift from actual balance unless updated by every transaction mutation — fragile and redundant. |
| Allow multiple goals per account | Users would see inflated totals if the same balance counted toward several goals simultaneously. |
| Store currency on the goal | Creates a potential inconsistency with the account's currency. |

---

## Consequences

- `GET /savings-goals` requires an `include: { account: { select: { currentBalance, currency, ... } } }` on every read — a join, but a single-row join that is fast in practice.
- When a user deposits into an account, all linked savings goal progress updates automatically — no extra service calls needed.
- An account can only have one active goal. This is an intentional UX simplification for the initial release.
