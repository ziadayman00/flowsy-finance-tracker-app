# 3. Monetary Representation and Precision

## Status
Accepted

## Context
Floating-point mathematics in standard IEEE 754 (such as JavaScript `number`) suffers from binary rounding artifacts (e.g. `0.1 + 0.2 === 0.30000000000000004`). In a personal finance app where Egyptian Pounds (EGP) and Piastres (1 EGP = 100 Piastres) are tracked, rounding errors and floating point inaccuracies undermine user trust and cause dashboard totals to misalign.

## Decision
1. **Database Storage:**
   All monetary amounts (balances, transactions, commitment amounts, budget allocations) are stored in PostgreSQL as `DECIMAL(14, 2)` (or `NUMERIC(14, 2)`). This supports amounts up to 999,999,999,999.99 with exact 2 decimal places (piastres/cents).
2. **Runtime Computations:**
   Arithmetic is performed using Prisma's underlying `Decimal` type (powered by `decimal.js`). Native JavaScript `+`, `-`, `*` on numbers are strictly forbidden for financial calculations.
3. **API Serialization:**
   Monetary values are exposed across the REST API as formatted numeric strings (e.g. `"1250.50"`) or standard Decimal-compatible representations to avoid truncation or floating-point coercion in mobile JSON parsers.
4. **Validation:**
   Amounts submitted via DTOs must be verified as valid positive numbers with at most 2 decimal places using custom class-validators / regex before processing. Negative amounts for expenses are normalized: expenses are stored as positive magnitudes with a `type = EXPENSE` discriminator rather than negative numbers.

## Alternatives Considered
- **Integer Cents / Piastres:**
  - *Trade-off:* Storing integer piastres (e.g., 100 EGP as 10000) avoids decimals, but increases confusion across reporting, DTOs, and direct database queries, and complicates integrations where fractional sub-piastre interest or fees might eventually occur.
  - *Decision:* `Decimal(14, 2)` offers standard database clarity with native Prisma Decimal support without developer conversion slip-ups.

## Consequences & Evolution Path
- Eliminates financial calculation drift.
- DTOs and frontend parsers must treat money as exact decimal strings or explicitly validated representations.
