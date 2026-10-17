# 7. Currency and Timezone Policy

## Status
Accepted

## Context
Flowsy is targeted primarily at Egyptian users whose primary domestic currency is Egyptian Pound (EGP). Users conduct transactions locally, but may maintain USD/EUR savings or deal with month boundaries across Cairo local time (`Africa/Cairo`, UTC+2 / UTC+3 with daylight saving).

## Decision
1. **Primary Currency:**
   - Default currency is `EGP`.
   - Each financial account records its currency code (`currency = "EGP"`).
   - In the initial release, consolidated totals and Safe-to-Spend calculations aggregate accounts matching the user's primary currency (default `EGP`). Accounts with differing currencies are excluded from direct summation with a clear warning/breakdown to avoid summing incompatible currency units without an FX rate engine.
2. **Timestamps & Date Handling:**
   - All server timestamps (`createdAt`, `updatedAt`, transaction instant) are stored in PostgreSQL as `TIMESTAMPTZ` (UTC).
   - Date-only concepts (such as `dueDate` for commitments or budget `startDate`/`endDate`) are handled as explicit UTC midnight dates or ISO-8601 calendar dates (`YYYY-MM-DD`) to avoid accidental shifts caused by server/client timezone offsets.
   - User profile allows storing preferred timezone (defaulting to `Africa/Cairo`).

## Alternatives Considered
- **Automatic dynamic FX currency conversion:**
  - *Rejected for Initial Scope:* Introduces external third-party API dependencies, conversion volatility, and unpredictable balance calculations.
- **Local machine time without UTC normalization:**
  - *Rejected:* Breaks portability and causes bugs across server migrations or daylight saving switches.

## Consequences & Evolution Path
- Guarantees financial math consistency without artificial multi-currency inflation errors.
- Prepares for future FX module if international accounts are supported.
