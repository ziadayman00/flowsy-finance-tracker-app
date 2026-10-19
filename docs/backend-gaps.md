# Flowsy Frontend-Observed Backend Gaps & Design Accommodations

This document details all technical limitations, gaps, and constraints identified in the backend during the mobile rebuild, along with the defensive design decisions implemented in the client.

---

## 1. Opening Balance Mutability
- **Backend Behavior**: The `FinancialAccount` model stores `initialBalance` upon creation. `PATCH /accounts/:id` explicitly forbids modifying `initialBalance`.
- **Frontend Impact**: Users who entered an incorrect starting balance cannot edit it directly on S41 (Account Detail).
- **Client Accommodation**:
  - Implemented **S41a (`CorrectBalanceSheet`)**: allows the user to input their real current balance. The client computes the exact decimal delta (`actual - currentBalance`) and dispatches a balancing `INCOME` or `EXPENSE` transaction with note `"تعديل رصيد"`.
  - Displays a mandatory transparency notice: `"التعديل هيتحسب ضمن دخل/مصروف الشهر ده"` since the backend monthly aggregates include all transactions on that account.

## 2. Auto-Provisioned Cash Account on Registration
- **Backend Behavior**: The backend seeds an empty `"كاش / Cash"` account with `initialBalance: 0` upon user creation.
- **Frontend Impact**: If the user has physical cash in hand during onboarding, they need to set its opening balance in S04.
- **Client Accommodation**:
  - In S04 (`StartingBalancesScreen`), if the user enters a non-zero opening amount for Cash: the client deletes the untouched provisioned empty account and immediately creates a new account with the specified `initialBalance`.

## 3. Atomic Batch Transaction Error Granularity
- **Backend Behavior**: `POST /transactions/batch` is wrapped in a Prisma `$transaction`. If any transaction in the batch fails validation, the entire batch rejects with a 400 error without indicating which array index caused the failure.
- **Frontend Impact**: The client cannot highlight an individual row as the sole cause of failure.
- **Client Accommodation**:
  - Implemented strict client-side validation in S12 before dispatching (ensuring every draft has a positive amount and valid account).
  - If the server rejects the batch, all drafts are retained in the review sheet with the server error message displayed in clear Arabic, preventing data loss.

## 4. Recurring Commitment Payment Side Effects
- **Backend Behavior**: When `POST /commitments/:id/pay` is invoked on a recurring commitment (e.g. `MONTHLY`), the backend creates a payment transaction and clones a new future commitment for the next period, but only returns `{ commitment, transactionId }` for the paid item.
- **Frontend Impact**: The next occurrence date is not returned in the pay response.
- **Client Accommodation**:
  - Client invalidates the commitments query cache and refetches both `PENDING` and `OVERDUE` commitments immediately upon receiving the 200 response, updating the dashboard and Plan screen cleanly.

## 5. Strict Payload Whitelisting (`forbidNonWhitelisted: true`)
- **Backend Behavior**: The global `ValidationPipe` has `forbidNonWhitelisted: true` and `whitelist: true`. Any extraneous field (such as `categoryId` on a `TRANSFER`, or extra attributes) causes an immediate 400 Bad Request.
- **Frontend Impact**: Naive object spreading causes silent request failures.
- **Client Accommodation**:
  - All network dispatches are channeled through strictly typed builders in `mobile/src/utils/payloads.ts` (`buildCreateTransactionPayload`, `buildUpdateTransactionPayload`, etc.) which strip all unpermitted or undefined keys before dispatch.
