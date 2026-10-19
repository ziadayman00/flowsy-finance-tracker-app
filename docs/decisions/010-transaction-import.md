# ADR-010: Transaction Import Design

**Status**: Accepted  
**Date**: 2026-10-19  
**Author**: Engineering (Flowsy Backend)

---

## Context

Users want to bulk-import historical transactions from external sources (bank exports, spreadsheets) without requiring a direct bank API integration. The import must be safe: duplicates should be flagged, data integrity must be maintained, and the user must confirm before any data is written.

---

## Decision

### Two-step preview → commit flow

Import is split into two sequential HTTP requests:

1. `POST /import/preview` — validates rows and runs duplicate detection. **No database writes occur.** Returns a `sessionId` and a per-row classification report.
2. `POST /import/commit` — accepts the `sessionId` and an optional `rowIndices` selection. Persists accepted rows atomically and updates the account balance.

This pattern ensures the user reviews what will happen before data is committed, and makes the operation safe to abort at any point.

### In-memory session store with 15-minute TTL

Preview sessions are held in a `Map<string, ImportSession>` in the service instance. Sessions expire after 15 minutes. Stale sessions are evicted opportunistically on each new `preview()` call.

This avoids the need for Redis or a DB session table at this scale. If the service is horizontally scaled in the future, sessions must be moved to a shared store (Redis). An ADR update will be required at that point.

### Duplicate detection heuristic

A row is flagged as `LIKELY_DUPLICATE` if an existing transaction on the same account matches:
- Same `amount` (exact decimal comparison using `decimal.js`)
- Same `type` (INCOME / EXPENSE / TRANSFER)
- `transactionDate` within ±1 calendar day

This is explicitly a heuristic, not a guarantee. `LIKELY_DUPLICATE` rows can still be committed if the user explicitly includes their `rowIndex` in the commit request. The label is displayed to the user with a reason string.

### Atomic commit with balance update

All `transaction.create` calls happen inside a single Prisma `$transaction`. The `financialAccount.currentBalance` is updated by the net delta within the same transaction. If any insert fails, the entire batch rolls back.

TRANSFER rows do not adjust the account balance during import (the contra account entry is not in scope for a single-account import).

### Batch size limit: 1 000 rows

Importing more than 1 000 rows in a single batch throws a `BadRequestException`. Large historical imports should be split into multiple batches. This prevents memory pressure and long-running transactions.

---

## Alternatives Considered

| Alternative | Rejected Reason |
|---|---|
| CSV file upload via multipart | JSON body is simpler to validate with class-validator and works without `multer`. CSV parsing adds a parser dependency and error surface. Apps can convert CSV to JSON on the client side. |
| Persistent session in DB | Adds a DB table and migration for a transient object. In-memory is sufficient at single-instance scale. |
| Auto-skip all LIKELY_DUPLICATE rows | Forces the user into false safety. The user should decide whether a flagged row is truly a duplicate. |
| Commit without preview step | Removes the safety review step — unacceptable for financial data. |

---

## Consequences

- Horizontal scaling requires a shared session store (Redis). Document this before deploying multiple instances.
- The ±1-day duplicate heuristic will miss duplicates if the date offset is larger, and may falsely flag legitimate same-amount same-day transactions. The user review step mitigates both failure modes.
- No CSV parsing happens server-side. The mobile app or import tool is responsible for parsing and presenting rows in the `ImportRowDto` format before calling `/import/preview`.
