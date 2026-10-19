# ADR-009: Cash-Flow Forecasting

**Status**: Accepted  
**Date**: 2026-10-19  
**Author**: Engineering (Flowsy Backend)

---

## Context

Users need to know how their finances are likely to evolve over the next 1–3 months based on their recurring commitments, so they can plan spending and identify months with high obligations.

---

## Decision

### Deterministic, commitment-based projection only

The forecasting service projects **only recorded recurring commitments** forward. No ML, no AI, no heuristics based on past transaction patterns. This ensures:

1. The output is explainable and auditable.
2. AI is not authoritative for any financial figure (hard constraint).
3. The feature works correctly from day one without historical data.

### Single currency per request — never mix currencies

Each `/forecasting/cashflow` call accepts a `currency` query param. Only commitments in that currency are projected. Cross-currency totals are **never** computed — the client must call once per currency if it wants a multi-currency view.

This is the same rule enforced by the budget system and the Safe-to-Spend calculation.

### dataQuality: 'ESTIMATE' is mandatory on the response

Every response includes `dataQuality: 'ESTIMATE'`. This is a non-nullable literal field. It exists to prevent clients from treating forecast values as account balances or authoritative figures. It should be displayed to the user.

### Projection algorithm

1. Load non-PAID commitments in the requested currency.
2. For `NONE` (non-recurring) commitments: place exactly one occurrence if `dueDate` is within the projection window.
3. For recurring commitments (DAILY/WEEKLY/MONTHLY/YEARLY): advance `dueDate` using `CommitmentsService.calculateNextDueDate()`, which already implements the month-end clamping rules from DAT-01.
4. Fast-forward optimisation: for old commitments with a dueDate far in the past, skip ahead by full periods before the per-occurrence loop to avoid O(years × frequency) iterations.
5. Safety limit: 500 iterations per commitment maximum to prevent runaway loops.

### FlowType (INCOME vs EXPENSE)

If a commitment has `flowType: 'INCOME'`, it is counted as inflow. Otherwise it is counted as outflow. This allows recurring salary deposits to offset recurring expense commitments in the monthly net.

---

## Alternatives Considered

| Alternative | Rejected Reason |
|---|---|
| AI/ML-based spending pattern projection | AI must not be authoritative for financial figures (hard constraint). Also requires historical data and introduces hallucination risk. |
| Include past actual transaction averages | More complex, error-prone with sparse data, and mixes confirmed actuals with estimates. Future enhancement if demanded. |
| Single aggregate total without buckets | Monthly breakdown is required for the mobile UI calendar/chart view. |

---

## Consequences

- Forecasts are only as good as the user's commitment records. If commitments are stale or incomplete, the forecast will be inaccurate — but this is made clear via `dataQuality: 'ESTIMATE'`.
- The feature is immediately useful from day one, even before historical transaction patterns have accumulated.
- Future enhancement: include budget periods in the projection to show months where projected expenses exceed budget allocations.
