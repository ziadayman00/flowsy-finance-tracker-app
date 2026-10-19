# Flowsy Frontend Rebuild Audit & Classification (`docs/rebuild-audit.md`)

> **Date**: October 18, 2026  
> **Status**: Completed Phase 1 Audit  
> **Author**: Senior React Native / Frontend Engineering Agent  
> **Reference**: `docs/flowsy-complete-frontend-rebuild-master-prompt.md` & `docs/backend-frontend-integration-report.md`

---

## 1. Environment & Stack Verification

- **Expo SDK**: `57.0.30`
- **React**: `19.2.3` / **React Native**: `0.86.3`
- **TypeScript**: `5.7.3`
- **Safe Area**: `react-native-safe-area-context` `5.10.1`
- **Icons**: `@expo/vector-icons` `^15.1.1` (Ionicons outline set available)
- **Haptics**: `expo-haptics` `~57.0.3`
- **Speech Recognition**: `expo-speech-recognition` `57.1.1`
- **Secure Storage**: `expo-secure-store` `^58.0.2` (with graceful fallback for web/testing)
- **Brand Assets**: Preserved as-is (`./assets/icon.png`, `./assets/android-icon-*.png`, and Flowsy green wordmark)
- **Native Configuration (`mobile/app.json`)**: Preserved as-is, with portrait orientation and speech recognition permissions.

---

## 2. Resolution of §1.4 Ambiguities ([U] Items)

1. **Commitment Overdue vs. Pending**:
   - *Status*: Resolved [V]. `CommitmentsService.findAll` dynamically marks past-due `PENDING` obligations as `OVERDUE` before returning them. To display all active commitments, the client queries both `OVERDUE` and `PENDING` (or requests `GET /commitments` without status filter, which returns all commitments sorted by `dueDate asc`).
2. **Transfer Exclusion from Monthly Inflow/Outflow**:
   - *Status*: Resolved [V]. Verified in `DashboardService.ts` lines 142–161: `monthlySummary.income` aggregates only `type: INCOME`, and `monthlySummary.expenses` aggregates only `type: EXPENSE`. `TRANSFER` transactions are excluded.
3. **Overall Budget Aggregation (`categoryId: null`)**:
   - *Status*: Resolved [V]. Verified in `BudgetsService.ts` lines 24–33: when `categoryId` is null, the query aggregates all `EXPENSE` transactions within the start and end dates. The client renders the server's computed `spent`, `remaining`, and `percentage` verbatim.
4. **Transaction / Commitment Mutations**:
   - *Status*: Resolved [V]. `PATCH /transactions/:id` updates only `amount`, `categoryId`, `transactionDate`, and `note`. It does not affect commitment statuses. `POST /commitments/:id/pay` is the only mechanism to mark a commitment paid and generate an expense transaction.
5. **Negative Balances & Overdrafts**:
   - *Status*: Resolved [V]. The database schema and services do not constrain balances to be non-negative. An account balance can become negative if expenses exceed current balance.
6. **Auto-Created Cash Account**:
   - *Status*: Resolved [V]. `AuthService.register` creates account `"كاش / Cash"` with `initialBalance: 0.00` and `currentBalance: 0.00`.
7. **Voice Parsing Engine**:
   - *Status*: Resolved [V]. `mobile/src/services/voice/` already implements deterministic Egyptian Arabic voice parsing, category matching, and date extraction, backed by 43 passing unit tests. It is retained and connected to the S10 capture bar and S12 review sheet.
8. **Bilingual Name Handling**:
   - *Status*: Resolved [V]. Backend seed data uses format `"عربي / English"`. The client implements `displayName(name)` to extract the Arabic segment for UI rendering while preserving the original string when communicating with the backend.

---

## 3. File-by-File Classification: Remove / Replace / Retain / Migrate

| File Path | Action | Rationale |
| :--- | :--- | :--- |
| **`App.tsx`** | **Replace** | Monolithic state container containing card-based UI; replaced with the new architectural shell, session gate (S00), and master-prompt compliant screens. |
| **`src/api/client.ts`** | **Migrate** | Migrate to support single-flight token refresh, correlation IDs, `expo-secure-store` token persistence, and the ambiguous-outcome protocol. |
| **`src/api/auth.ts`** | **Migrate** | Update to export clean payload builders adhering to the strict whitelisted DTOs. |
| **`src/api/accounts.ts`** | **Migrate** | Align with updated payload types and strict DTO whitelist. |
| **`src/api/categories.ts`** | **Migrate** | Align with updated payload types and strict DTO whitelist. |
| **`src/api/commitments.ts`** | **Migrate** | Align with merged status queries and `:id/pay` atomic contract. |
| **`src/api/transactions.ts`** | **Migrate** | Add batch creation helper, pagination helpers, and strict update payload filtering. |
| **`src/api/budgets.ts`** | **Migrate** | Align with budget progress types and ISO date parameters. |
| **`src/api/dashboard.ts`** | **Migrate** | Align with complete `DashboardSummaryDto` contract. |
| **`src/api/types.ts`** | **Replace** | Replaced with exact contracts matching `backend-frontend-integration-report.md` §10. |
| **`src/theme/*`** | **Replace** | Replaced with semantic token architecture (`theme/tokens.ts`, light/dark palettes, no card shadows, #F5F3EB ivory background, #173F35 forest action, #D9B879 warning/committed, #B84C45 negative). |
| **`src/context/PrivacyContext.tsx`**| **Remove** | Unused privacy blurring overlay not specified in the product experience. |
| **`src/components/common/*`** | **Replace** | Replace legacy Button, Card, AmountDisplay, Badge with unified primitives: `Screen`, `AppText`, `Button`, `Field`, `Icon`, `Money`, `ListRow`, `Divider`, `Skeleton`. |
| **`src/components/dashboard/*`** | **Replace** | Replace legacy card stacks (FinancialHero, SpendingDistribution, RecentActivity) with the clean S10 layout, Split Line signature, and question-answer hero. |
| **`src/components/modals/*`** | **Replace** | Replace legacy modals with master-prompt compliant bottom sheets: S10a, S11, S12, S21, S22, S31, S32, S33, S34, S35, S41a, S42, S52, S53. |
| **`src/components/navigation/BottomTabBar.tsx`** | **Replace** | Replace floating action button & 5-tab bar with the 4 primary tabs (Home, Transactions, Plan, Accounts) and docked capture bar per §5. |
| **`src/screens/HomeScreen.tsx`** | **Replace** | Replaced with S10 screen specification (headline Safe-to-Spend, Split Line, supporting figures, upcoming obligations, docked capture bar). |
| **`src/screens/TransactionsScreen.tsx`** | **Replace** | Replaced with S20 screen specification (day headers, filter summary, pagination, tap to detail sheet). |
| **`src/screens/AccountsScreen.tsx`** | **Replace** | Replaced with S40 screen specification (liquid vs. protected savings vs. other currencies). |
| **`src/screens/CommitmentsScreen.tsx`** | **Replace** | Subsumed into S30 (Plan tab with Commitments and Budgets segments). |
| **`src/screens/ProfileScreen.tsx`** | **Replace** | Subsumed into S50 (Settings stack accessed via avatar button on Home). |
| **`src/services/voice/*`** | **Retain** | Retained in full: contains speech provider abstraction, normalizer, amount parser, date parser, category matcher, and tests. |
| **`src/utils/formatters.ts`** | **Replace** | Replaced with pure utility modules: `money.ts`, `format.ts`, `names.ts`, `dates.ts`, `plural.ts`, `splitLine.ts`. |
| **`src/utils/haptics.ts`** | **Migrate** | Update to enforce §12 haptic rules (only on discrete selections, confirmed server mutations, with user opt-out). |
| **`src/utils/rtl.ts`** | **Migrate** | Update to enforce whole-app RTL and logical styling. |
| **`__tests__/*`** | **Retain & Extend** | Retain existing voice and contract tests, and add comprehensive unit tests for `money`, `format`, `names`, `dates`, `plural`, `splitLine`, and `errors`. |

---

## 4. Next Phase: Phase 2 Foundations

We will now implement Phase 2:
1. Semantic design tokens (`tokens.ts`) with light/dark themes and contrast verification.
2. Pure utility libraries with 100% test coverage:
   - `money.ts`: Exact decimal operations on 2-decimal strings (no floating-point math).
   - `format.ts`: Western digits, Arabic currency placement, separate LTR runs for numbers.
   - `names.ts`: Arabic extraction for bilingual seeded names.
   - `dates.ts`: Cairo timezone handling, month boundaries, relative day formatting.
   - `plural.ts`: Arabic grammatical plural rules (dual, 3-10 plural, 11+ singular).
   - `errors.ts`: Complete Arabic error mapping for status codes and backend message substrings.
   - `splitLine.ts`: Mathematical geometry for the signature Split Line.
   - `payloads.ts`: Whitelisted DTO builders preventing `forbidNonWhitelisted` 400 errors.
3. API Client & Auth Engine (`client.ts`, `tokenStorage.ts`): Single-flight refresh token rotation with mutex, correlation ID injection, and error normalization.
4. Core UI Primitives: `Screen`, `AppText`, `Button`, `Field`, `Icon`, `Money`, `ListRow`, `SplitLine`, `Sheet`, `ConfirmDialog`, `Toast`.
