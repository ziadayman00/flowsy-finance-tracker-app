# 6. Safe-to-Spend ("تقدر تصرف كام؟") Calculation

## Status
Accepted

## Context
Flowsy's core differentiator and primary dashboard metric is "تقدر تصرف كام؟" — an accurate, stress-reducing estimate of spendable money remaining for the user. Everyday users often see their bank balance (e.g. 15,000 EGP) and spend it, forgetting that upcoming obligations (rent: 6,000 EGP, electricity: 800 EGP, loan installment: 3,500 EGP) are due before their next income.

## Decision
1. **Mathematical Definition:**
   `Safe-to-Spend = Total Eligible Liquid Funds - Total Outstanding Qualifying Commitments`

   Where:
   - **Eligible Liquid Funds:** Sum of `currentBalance` across all active liquid accounts (`CASH`, `BANK`, `MOBILE_WALLET`). Savings or investment accounts marked `excludeFromSafeToSpend = true` are excluded so emergency funds are not treated as disposable spending money.
   - **Outstanding Qualifying Commitments:** Commitments with status `PENDING` or `OVERDUE` due within the active evaluation horizon (by default, within the current billing cycle / month, or up to the user's next expected income cycle).
   - Commitments marked `PAID` or `CANCELLED` are excluded so that paying a commitment does not deduct the expense twice (since the payment transaction already reduced the account balance).
2. **Deficit Handling:**
   If `Outstanding Qualifying Commitments > Eligible Liquid Funds`, the safe-to-spend figure becomes negative (or zero with a clear deficit breakdown in the API response: `spendableAmount: "-1200.00"`, `isDeficit: true`, `deficitAmount: "1200.00"`). The API explicitly provides the breakdown components so the mobile client can explain the number clearly in Arabic (e.g., "التزاماتك تتجاوز رصيدك الحالي بمقدار 1,200 ج.م").
3. **Single Ownership:**
   This calculation is encapsulated in a dedicated, isolated domain service (`DashboardService` / `SafeToSpendCalculator`) with extensive unit and edge-case tests.
4. **Transparency & Breakdown:**
   The API response returns:
   ```json
   {
     "safeToSpend": "4700.00",
     "currency": "EGP",
     "totalLiquidFunds": "15000.00",
     "totalPendingCommitments": "10300.00",
     "pendingCommitmentsCount": 3,
     "calculatedAt": "2026-10-17T20:00:00.000Z",
     "isDeficit": false,
     "deficitAmount": "0.00"
   }
   ```

## Alternatives Considered
- **Trusting Client-Side Calculations:**
  - *Rejected:* Security and financial risk. Clients might calculate differently across iOS and Android, or miscalculate timezone boundaries.
- **Deducting Budgets directly from Safe-to-Spend:**
  - *Rejected:* A budget is a spending limit/target for discretionary categories (e.g. Dining, Groceries), not a locked debt like rent or an installment. Combining them directly would cause double-counting when grocery expenses are logged. Budgets are evaluated independently as category progress bars.

## Consequences & Evolution Path
- Provides immediate clarity and relief to Egyptian users navigating high inflation and multiple monthly obligations.
