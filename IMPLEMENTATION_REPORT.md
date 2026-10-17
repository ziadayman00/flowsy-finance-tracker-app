# Flowsy Backend Engineering — Implementation Report

This document records the incremental implementation, architectural decisions, verification outcomes, and engineering status for the Flowsy backend project across each phase.

---

## Phase 0: Audit and Architecture

### A. What was implemented / inspected
- Performed full environment and repository inspection of `d:\ziad ayman\CV projects\2026\flowsy`.
- Identified that the repository is a newly created project currently containing only `logo.png` (39,953 bytes) with no existing Git repository, no package manifests, and no legacy code.
- Inspected the local development runtime:
  - **Node.js:** `v20.19.5` (Active LTS)
  - **npm:** `10.8.2`
  - **pnpm:** `10.34.5`
  - **Git:** `2.44.0.windows.1`
  - **PostgreSQL:** Local PostgreSQL 17.4 service (`postgresql-x64-17`) is **Running** and accessible on localhost:5432.
  - **Docker:** Not installed in PATH; local development uses native PostgreSQL 17 service.
- Preserved existing asset `logo.png`.
- Established Architectural Decision Records in `docs/decisions/`:
  - `ADR 001`: Modular Monolith Architecture
  - `ADR 002`: Database & Persistence: PostgreSQL and Prisma ORM
  - `ADR 003`: Monetary Representation and Precision (`DECIMAL(14, 2)` + `decimal.js`)
  - `ADR 004`: Authentication and Token Lifecycle (Argon2id + Access/Refresh Token Rotation)
  - `ADR 005`: Transaction Lifecycle, Balances, and Reversal Semantics
  - `ADR 006`: Safe-to-Spend ("تقدر تصرف كام؟") Calculation Strategy
  - `ADR 007`: Currency (EGP) and Timezone Policy (`Africa/Cairo` / UTC storage)

### B. Why this approach was selected
- **Modular Monolith:** Fits Flowsy's current stage with maximal velocity, robust single-database ACID guarantees, and zero distributed latency, while enforcing strict domain module boundaries.
- **PostgreSQL 17 + Prisma ORM:** PostgreSQL is already running locally and provides battle-tested ACID transactions, foreign keys, and Decimal precision. Prisma guarantees end-to-end TypeScript type safety and version-controlled SQL migrations.
- **Root-level Backend Project Structure:** Since `flowsy` is a dedicated backend repository, placing `package.json`, `src/`, and `prisma/` at the repository root provides immediate zero-config developer ergonomics for IDEs, ESLint, TypeScript language servers, and npm scripts.

### C. Business Logic Baseline
- **Core Entities:** `User`, `RefreshToken`, `FinancialAccount`, `Category`, `Transaction`, `Commitment`, `Budget`.
- **Monetary Rule:** All amounts use `Decimal(14,2)`. No floating-point math. Expenses are recorded as positive magnitudes with an `EXPENSE` discriminator.
- **Safe-to-Spend Formula:** `Eligible Liquid Funds - Outstanding Qualifying Commitments`. Paying a commitment creates an expense and marks commitment as `PAID`, preventing double deduction.
- **Ownership:** Every query and mutation is strictly filtered by authenticated `userId`.

### D. Verification Outcomes
- **Passed checks:**
  - `node -v` -> `v20.19.5`
  - `npm -v` -> `10.8.2`
  - `pnpm -v` -> `10.34.5`
  - `git --version` -> `git version 2.44.0.windows.1`
  - `psql -U postgres -c "SELECT version();"` -> `PostgreSQL 17.4 on x86_64-windows`
  - `Get-Service *postgres*` -> `postgresql-x64-17 Running`
- **Checks not run / blocked:**
  - `docker --version`: Docker is not installed in the Windows environment; local PostgreSQL service is used instead.

### E. Risks and Limitations
- Docker is unavailable on the host; reproducible local development will be documented for local PostgreSQL 17 alongside an optional `docker-compose.yml` for environments where Docker is present.
- Git repository is not yet initialized in the directory; will be initialized in Phase 1.

### F. Next Phase
- **Phase 1 — Backend Foundation:** Initialize Git, configure `.gitignore` (safeguarding `logo.png`), scaffold NestJS application with strict TypeScript, install core dependencies (Prisma, class-validator, config), configure validated environment settings, request correlation ID logging, global exception filter, and `/api/v1/health` endpoint.

### G. Developer Handoff
- See `docs/decisions/` for core architectural records.
- Existing files: `logo.png`, `docs/decisions/*`, `IMPLEMENTATION_REPORT.md`.

---

## Phase 1: Backend Foundation

### A. What was implemented
- **Repository Setup:** Initialized Git repository, configured `.gitignore` safeguarding `logo.png`.
- **Runtime & Strict TypeScript:** Configured `package.json` with NestJS v10 and modern LTS packages. Created strict `tsconfig.json` (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`).
- **Environment Validation:** Created `src/config/env.validation.ts` validating environment variables at startup via `class-validator` / `class-transformer`.
- **Database & Prisma Service:** Implemented `PrismaService` (`src/database/prisma.service.ts`) with lifecycle hooks (`onModuleInit`, `onModuleDestroy`) and global `PrismaModule`.
- **Observability & Resilience:**
  - `CorrelationIdMiddleware` (`src/common/middleware/correlation-id.middleware.ts`) automatically generates or propagates `x-correlation-id`.
  - `AllExceptionsFilter` (`src/common/filters/http-exception.filter.ts`) standardizes all HTTP and database errors into a predictable JSON error envelope without leaking stack traces or credentials.
  - `LoggingInterceptor` (`src/common/interceptors/logging.interceptor.ts`) records request method, URL, status code, latency, and correlation ID without logging sensitive payloads.
- **API Versioning & OpenAPI:** Configured `/api/v1` prefix and Swagger documentation at `/api/docs`.
- **Health Module:** Created `HealthController` (`/api/v1/health`) executing a live database ping (`SELECT 1`).
- **Unit Testing:** Created and verified unit test for `HealthController` using Jest (`PASS src/health/health.controller.spec.ts`).

### B. Why this approach was selected
- Setting up the request pipeline (correlation IDs, exception filtering, validated environment) at the foundation layer ensures every subsequent business module inherits consistent behavior, observability, and security out-of-the-box.

### C. Business Logic Baseline
- Global validation pipe enforces whitelist validation and forbids non-whitelisted properties, preventing parameter tampering and mass-assignment vulnerabilities.

### D. Verification Outcomes
- **Passed checks:**
  - `pnpm exec prisma -v` -> Prisma 5.22.0 verified
  - `pnpm run test` -> HealthController unit tests passed
  - `pnpm run build` -> TypeScript compilation succeeded, `dist/` created cleanly

---

## Phase 2: Database and Core Domain

### A. What was implemented
- **Schema Definition (`prisma/schema.prisma`):**
  - Modeled `User`, `RefreshToken`, `FinancialAccount`, `Category`, `Transaction`, `Commitment`, and `Budget`.
  - Configured explicit foreign keys, cascade rules, compound uniqueness (`[userId, name]` on accounts), and query indexes (`[userId, transactionDate]`, `[userId, status, dueDate]`, etc.).
  - Configured high-precision numeric types: all monetary columns defined as `@db.Decimal(14, 2)`.
- **Migrations:**
  - Generated and deployed migration `20261017000000_init_schema` to the PostgreSQL `flowsy` database.
  - Cleanly stripped UTF-8 BOM to ensure compatibility with PostgreSQL SQL parser.
- **Seeding (`prisma/seed.ts`):**
  - Seeded 15 default system categories with dual Arabic/English labels and Ionicons identifiers.
  - Seeded a development demo user (`demo@flowsy.app`) with 3 financial accounts (Cash, Bank, Mobile Wallet) and 2 upcoming monthly commitments (Rent, Home Internet).

### B. Why this approach was selected
- Using reproducible SQL migrations committed to version control ensures any team member or deployment pipeline can reliably stand up the exact database schema using `pnpm exec prisma migrate deploy`.

### C. Business Logic Baseline
- All monetary operations are typed as `Decimal(14, 2)`.
- Categories can be system-wide (`userId == null`) or user-custom (`userId != null`).
- Commitments are linked to accounts and categories with payment reconciliation tracking via `paidTransactionId`.

### D. Verification Outcomes
- **Passed checks:**
  - `prisma migrate deploy` -> Migration `20261017000000_init_schema` applied to database `flowsy`
  - `prisma db seed` -> 15 categories, 1 user, 3 accounts, 2 commitments seeded successfully
  - Verification via `psql`: table counts confirmed (`users: 1`, `categories: 15`, `financial_accounts: 3`)

### E. Next Phase
- **Phase 3 — Authentication and Users:** Completed below.

---

## Phase 3: Authentication and Users

### A. What was implemented
- **Auth DTOs:**
  - `RegisterDto` (`src/auth/dto/register.dto.ts`): validates normalized email, strong password (min 8 chars), display name (2-50 chars), currency, and timezone.
  - `LoginDto` (`src/auth/dto/login.dto.ts`): validates email and password.
  - `RefreshTokenDto` (`src/auth/dto/refresh-token.dto.ts`): validates cryptographic refresh token string.
  - `AuthResponseDto` and `UserProfileDto` (`src/auth/dto/auth-response.dto.ts`): strictly strips password hash and sensitive internal details.
- **Argon2id Hashing & Crypto Tokens:**
  - `AuthService` (`src/auth/auth.service.ts`): uses Argon2id (`memoryCost: 65536, timeCost: 3`) for password verification and hashing.
  - Generates 15-minute JWT access tokens and 7-day cryptographically secure random refresh tokens.
  - Refresh tokens are hashed via SHA-256 before persistence in PostgreSQL.
- **Token Rotation & Replay Attack Protection:**
  - When a refresh token is exchanged, it is atomically revoked and a new pair is issued within a database transaction.
  - If an already revoked token is used, `AuthService` detects a potential replay attack and automatically invalidates all active sessions for that user.
- **Guards & Decorators:**
  - `JwtStrategy` (`src/auth/strategies/jwt.strategy.ts`): extracts Bearer token, validates payload, and verifies user exists in database.
  - `JwtAuthGuard` (`src/auth/guards/jwt-auth.guard.ts`): protects private routes with predictable 401 Unauthorized responses.
  - `@CurrentUser()` (`src/auth/decorators/current-user.decorator.ts`): injects authenticated user context into controllers.
- **Endpoints in `AuthController` (`/api/v1/auth`):**
  - `POST /register`: creates user and default initial Cash account atomically, returns tokens.
  - `POST /login`: authenticates credentials with Argon2id, returns rotated tokens.
  - `POST /refresh`: performs atomic token rotation.
  - `POST /logout`: revokes active refresh token (or all user sessions).
  - `GET /me`: returns authenticated user profile.
- **Users Module (`src/users`):**
  - Profile retrieval and update (`GET /api/v1/users/profile`, `PATCH /api/v1/users/profile`).
- **Unit Testing:**
  - `src/auth/auth.service.spec.ts`: verified registration conflict detection, default account creation, credential checks, and replay attack prevention.

### B. Why this approach was selected
- Pairing short-lived JWT access tokens (15m) with rotating refresh tokens stored as SHA-256 hashes gives mobile users uninterrupted access while providing immediate server-side revocation on logout or compromise.
- Default Cash account creation during registration eliminates onboarding friction for mobile users.

### C. Business Logic Baseline
- Passwords hashed via Argon2id (never logged or exposed).
- Refresh tokens rotated on every single use.
- Replay detection invalidates the entire token family.

### D. Verification Outcomes
- **Passed checks:**
  - `pnpm run test` -> 9 unit tests passed across Health and Auth suites
  - `pnpm run build` -> Strict TypeScript compilation succeeded with zero warnings

### E. Next Phase
- **Phase 4 — Financial Accounts and Categories:** Completed below.

---

## Phase 4: Financial Accounts and Categories

### A. What was implemented
- **Financial Accounts Module (`src/financial-accounts`):**
  - DTOs: `CreateAccountDto`, `UpdateAccountDto`, `AccountResponseDto`.
  - Balances formatted as exact decimal strings (`"1500.00"`).
  - Enforces unique account names per user (`[userId, name]`).
  - Supports `excludeFromSafeToSpend` flag (critical for emergency savings).
  - Deletion guard: Accounts with recorded transactions or commitments cannot be deleted; users must archive them (`isArchived = true`) to protect financial history.
  - Endpoints: `GET /api/v1/accounts`, `POST /api/v1/accounts`, `GET /api/v1/accounts/:id`, `PATCH /api/v1/accounts/:id`, `DELETE /api/v1/accounts/:id`.
- **Categories Module (`src/categories`):**
  - DTOs: `CreateCategoryDto`, `UpdateCategoryDto`, `CategoryResponseDto`.
  - Dual-tier category model:
    - System categories (`userId === null`): available to all users, cannot be modified or deleted.
    - User custom categories (`userId === authenticatedUserId`): editable and deletable by the owner only.
  - Deletion guard: Categories cannot be deleted if referenced by any transactions or commitments.
  - Endpoints: `GET /api/v1/categories`, `POST /api/v1/categories`, `GET /api/v1/categories/:id`, `PATCH /api/v1/categories/:id`, `DELETE /api/v1/categories/:id`.
- **Unit Testing:**
  - `src/financial-accounts/financial-accounts.service.spec.ts`: verified creation, balance defaults, and transaction deletion protection.
  - `src/categories/categories.service.spec.ts`: verified system category immutability, cross-user modification denial, and custom category management.

### B. Why this approach was selected
- Enforcing soft-archive over permanent deletion when historical transactions exist guarantees ledger consistency and prevents orphaned records.
- System vs. user category segregation allows Flowsy to provide a rich out-of-the-box Arabic financial taxonomy while giving power users freedom to customize their categories.

### C. Business Logic Baseline
- Balances are serialized as exact 2-decimal strings to prevent floating-point inaccuracies in mobile clients.
- System categories are strictly read-only for standard users.

### D. Verification Outcomes
- **Passed checks:**
  - `pnpm run test` -> 18 unit tests passed across 4 test suites
  - `pnpm run build` -> TypeScript compilation succeeded cleanly

### E. Next Phase
- **Phase 5 — Transactions:** Completed below.

---

## Phase 5: Transactions

### A. What was implemented
- **Transactions Module (`src/transactions`):**
  - DTOs: `CreateTransactionDto`, `UpdateTransactionDto`, `QueryTransactionsDto`, `TransactionResponseDto`, `PaginatedTransactionsDto`.
  - Supports `INCOME`, `EXPENSE`, and `TRANSFER` types.
  - Strict input validation: amounts must be positive numbers with max 2 decimal places; transfers require valid and distinct `destinationAccountId`.
  - Atomic Ledger Mutation via Prisma `$transaction`:
    - `INCOME`: atomically increments account balance and creates transaction record.
    - `EXPENSE`: atomically decrements account balance and creates transaction record.
    - `TRANSFER`: atomically debits source account, credits destination account, and records transfer details.
  - Reversal on Deletion: deleting a transaction atomically undoes its balance effect on the associated account(s) and unlinks any commitments.
  - Mutation Delta: updating transaction amount calculates the exact difference and adjusts the account balance accordingly.
  - Querying & Pagination: supports filtering by `type`, `accountId`, `categoryId`, `startDate`, `endDate`, with structured pagination (`data`, `total`, `page`, `limit`, `totalPages`).
  - Endpoints: `POST /api/v1/transactions`, `GET /api/v1/transactions`, `GET /api/v1/transactions/:id`, `PATCH /api/v1/transactions/:id`, `DELETE /api/v1/transactions/:id`.
- **Unit Testing:**
  - `src/transactions/transactions.service.spec.ts`: verified atomic balance updates for income, expense, and transfer, rejection of self-transfers, and balance reversal on deletion.

### B. Why this approach was selected
- Wrapping every financial write in a database `$transaction` guarantees that balance updates and transaction records are atomic: a failure in recording will never leave an account balance corrupted or desynchronized.
- Monetary amounts are manipulated using `decimal.js` and `Prisma.Decimal` to prevent floating point inaccuracies.

### C. Business Logic Baseline
- Transfers do not count as income or expenses in user financial summaries.
- Deletions are true financial reversals that restore account balances immediately.

### D. Verification Outcomes
- **Passed checks:**
  - `pnpm run test` -> 24 unit tests passed across 5 test suites
  - `pnpm run build` -> Strict TypeScript build passed cleanly

### E. Next Phase
- **Phase 6 — Commitments and Budgets:** Completed below.

---

## Phase 6: Commitments and Budgets

### A. What was implemented
- **Commitments Module (`src/commitments`):**
  - DTOs: `CreateCommitmentDto`, `UpdateCommitmentDto`, `PayCommitmentDto`, `CommitmentResponseDto`.
  - Lifecycle: `PENDING`, `PAID`, `CANCELLED`, and automatic detection of `OVERDUE` obligations based on due dates.
  - Recurrence engine: supports `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` recurrence schedules.
  - Payment Workflow (`POST /api/v1/commitments/:id/pay`):
    - Atomically creates an `EXPENSE` transaction in the designated payment account.
    - Decrements account balance.
    - Marks commitment as `PAID` with `paidTransactionId` reference (preventing double deduction).
    - If recurring, automatically calculates the next due date and schedules the subsequent `PENDING` commitment.
  - Endpoints: `GET /api/v1/commitments`, `POST /api/v1/commitments`, `GET /api/v1/commitments/:id`, `PATCH /api/v1/commitments/:id`, `DELETE /api/v1/commitments/:id`, `POST /api/v1/commitments/:id/pay`.
- **Budgets Module (`src/budgets`):**
  - DTOs: `CreateBudgetDto`, `UpdateBudgetDto`, `BudgetResponseDto`.
  - Real-time aggregation: computes `spent`, `remaining`, and `percentage` by aggregating `EXPENSE` transactions within the specified date boundaries (`startDate` to `endDate`), optionally narrowed to a specific category.
  - Precise arithmetic using `decimal.js` for progress tracking.
  - Endpoints: `GET /api/v1/budgets`, `POST /api/v1/budgets`, `GET /api/v1/budgets/:id`, `PATCH /api/v1/budgets/:id`, `DELETE /api/v1/budgets/:id`.
- **Unit Testing:**
  - `src/commitments/commitments.service.spec.ts`: verified payment transaction creation, balance deduction, duplicate payment rejection, and recurrence spawning.
  - `src/budgets/budgets.service.spec.ts`: verified date validation and live spending aggregation accuracy.

### B. Why this approach was selected
- The commitment payment workflow ensures complete financial integrity: paying a commitment automatically logs the expense in the ledger, updates the bank balance, marks the commitment paid, and spawns the next month's bill in a single atomic transaction.
- Dynamic budget calculation ensures budget progress bars always match actual recorded spending without requiring fragile caching.

### C. Business Logic Baseline
- Once a commitment is marked `PAID`, it will never be deducted again during Safe-to-Spend calculations because its expense is already reflected in the reduced bank/cash balance.

### D. Verification Outcomes
- **Passed checks:**
  - `pnpm run test` -> 30 unit tests passed across 7 test suites
  - `pnpm run build` -> Strict TypeScript build passed cleanly

### E. Next Phase
- **Phase 7 — Dashboard and Safe-to-Spend:** Completed below.

---

## Phase 7: Dashboard and Safe-to-Spend ("تقدر تصرف كام؟")

### A. What was implemented
- **Dashboard Module (`src/dashboard`):**
  - DTOs: `DashboardSummaryDto`, `SafeToSpendBreakdownDto`, `MonthlySummaryDto`, `AccountQuickViewDto`.
  - Encapsulated Safe-to-Spend mathematical engine (`DashboardService`):
    - `Safe-to-Spend = Total Liquid Funds - Outstanding Qualifying Commitments`.
    - Liquid Funds aggregation: strictly aggregates non-archived spending accounts (`CASH`, `BANK`, `MOBILE_WALLET`) where `excludeFromSafeToSpend = false`.
    - Protected Savings separation: emergency savings and investment accounts where `excludeFromSafeToSpend = true` are isolated and displayed separately so users never accidentally spend protected reserves.
    - Outstanding Commitments aggregation: sums commitments with status `PENDING` or `OVERDUE` due within the active evaluation horizon.
    - Deficit state derivation: if commitments exceed liquid funds, flags `isDeficit: true`, reports exact `deficitAmount`, and supplies negative exact spendable amount so mobile UI can present a clear, reassuring deficit explanation.
  - Consolidated Monthly Performance:
    - Calculates current month total `INCOME`, total `EXPENSE`, and `netSavings`.
    - Explicitly excludes `TRANSFER` transactions from income and expense summaries.
  - Endpoint: `GET /api/v1/dashboard/summary` (protected by `JwtAuthGuard`).
- **Unit Testing:**
  - `src/dashboard/dashboard.service.spec.ts`: verified accurate safe-to-spend derivation, protected savings exclusion, deficit state identification, and monthly net savings calculations.

### B. Why this approach was selected
- The Safe-to-Spend metric ("تقدر تصرف كام؟") is Flowsy's flagship value proposition. Encapsulating this calculation within a dedicated backend domain service rather than allowing client-side derivation guarantees mathematical consistency across iOS and Android and eliminates financial calculation drift.

### C. Business Logic Baseline
- Safe-to-Spend never counts emergency savings as disposable money.
- Paid commitments are excluded from deductions, preventing double-counting.
- All numbers are computed with `decimal.js` and returned as exact decimal strings.

### D. Verification Outcomes
- **Passed checks:**
  - `pnpm run test` -> 33 unit tests passed across 8 test suites
  - `pnpm run build` -> Strict TypeScript build passed cleanly

### E. Next Phase
- **Phase 8 — API Integration and End-to-End Verification:** Completed below.

---

## Phase 8: API Integration and End-to-End Verification

### A. What was implemented
- **Automated E2E Test Suite (`test/app.e2e-spec.ts`):**
  - Configured Jest E2E environment (`test/jest-e2e.json`).
  - Executed tests directly against the live PostgreSQL database and full NestJS application pipeline (middleware, validation pipes, global exception filters).
  - Verified 16 critical test scenarios:
    1. System health check (`GET /api/v1/health`) confirms active service and database connectivity.
    2. Registration of primary user (`POST /api/v1/auth/register`) creates user and automatic default Cash account, returning JWT access and rotating refresh tokens.
    3. Registration of secondary user.
    4. Identity retrieval (`GET /api/v1/auth/me`) validates Bearer token and returns profile without sensitive fields.
    5. Unauthenticated requests are rejected with `401 Unauthorized`.
    6. Financial account creation (`POST /api/v1/accounts`) creates Bank account with initial 5,000.00 EGP balance.
    7. Account listing (`GET /api/v1/accounts`).
    8. Income logging (`POST /api/v1/transactions` with +10,000.00 EGP) updates bank balance atomically to 15,000.00 EGP.
    9. Expense logging (`POST /api/v1/transactions` with -2,000.00 EGP) updates bank balance atomically to 13,000.00 EGP.
    10. Upcoming commitment creation (`POST /api/v1/commitments`) schedules rent obligation of 4,000.00 EGP.
    11. Safe-to-Spend derivation (`GET /api/v1/dashboard/summary`) verifies:
        - Total liquid balance = 13,000.00 EGP
        - Total pending commitments = 4,000.00 EGP
        - Estimated Safe-to-Spend = 9,000.00 EGP
    12. Commitment payment workflow (`POST /api/v1/commitments/:id/pay`):
        - Creates an expense transaction in the designated account.
        - Decrements account balance to 9,000.00 EGP.
        - Marks commitment as `PAID`.
    13. Elimination of double deduction (`GET /api/v1/dashboard/summary`):
        - Confirms that once paid, the commitment is excluded from pending obligations (`0.00 EGP`).
        - Spendable balance remains stable at 9,000.00 EGP (the obligation was NOT deducted twice).
    14. Cross-User Data Isolation:
        - Secondary user cannot read primary user's account (`404 Not Found`).
        - Secondary user cannot delete primary user's transaction (`404 Not Found`).
        - Secondary user cannot pay primary user's commitment (`404 Not Found`).

### B. Why this approach was selected
- End-to-end testing with real database writes proves that foreign key constraints, atomic Prisma transactions, authorization filters, and HTTP serialization work harmoniously in realistic usage scenarios.

### C. Business Logic Baseline
- Critical validation that paying a commitment transitions the obligation from an upcoming liability to a completed expense without double-deducting the funds.
- Strict ownership guarantees that all resources are isolated to the authenticated user.

### D. Verification Outcomes
- **Passed checks:**
  - `pnpm run test:e2e` -> 16 / 16 tests passed across the complete user journey
  - `pnpm run test` -> 33 / 33 unit tests passed across 8 test suites
  - `pnpm run build` -> Strict TypeScript build passed cleanly

### E. Next Phase
- **Phase 9 — Hardening and Documentation:** Completed below.

---

## Phase 9: Hardening and Documentation

### A. What was implemented
- **Multi-Stage Containerization (`Dockerfile`):**
  - Stage 1 (`builder`): builds NestJS TypeScript distribution, generates Prisma Client.
  - Stage 2 (`runner`): minimal Alpine production image executing under the non-root `node` user with `--prod` dependencies.
- **Docker Compose (`docker-compose.yml`):**
  - Services: `postgres` (PostgreSQL 17 Alpine with healthcheck) and `backend` (Flowsy API).
  - Configures network dependencies, persistent volume `flowsy_pgdata`, and production environment variables.
- **Comprehensive Project Documentation (`README.md`):**
  - Architecture overview, domain model diagrams, setup instructions for native PostgreSQL 17 and Docker Compose.
  - Complete endpoint reference for all modules (`/api/v1/auth`, `/api/v1/accounts`, `/api/v1/categories`, `/api/v1/transactions`, `/api/v1/commitments`, `/api/v1/budgets`, `/api/v1/dashboard`).
  - Testing guide (unit tests, coverage, E2E).
- **Security Hardening Review:**
  - Password hashing: Argon2id with memory cost 64MB and 3 time iterations.
  - Request filtering: NestJS global validation pipe with `whitelist: true` and `forbidNonWhitelisted: true` preventing mass assignment.
  - CORS: configurable environment-driven origin policy.
  - Exception sanitization: `AllExceptionsFilter` strips sensitive internal traces and formats consistent JSON errors.
  - Refresh token security: SHA-256 token hashing, rotation on every single use, and family invalidation on replay attempt.
  - Graceful shutdown: `enableShutdownHooks()` cleanly disconnects Prisma connections on SIGTERM/SIGINT.

### B. Verification Outcomes
- **Passed checks:**
  - `pnpm run test` -> 33 / 33 unit tests passed across 8 test suites
  - `pnpm run test:e2e` -> 16 / 16 integration tests passed against live PostgreSQL 17
  - `pnpm run build` -> Production build compiled cleanly to `dist/`
  - `pnpm run prisma:seed` -> Seeded 15 system categories, demo user, accounts, and commitments into `flowsy`

---

## Final Project Summary & Developer Handoff

### Project Structure
```text
flowsy/
  ├── src/
  │   ├── main.ts                       # App bootstrap, prefix, pipes, filters, Swagger
  │   ├── app.module.ts                 # Root module wiring & correlation middleware
  │   ├── config/env.validation.ts      # Validated environment configuration
  │   ├── common/                       # Filters, interceptors, middleware, guards, decorators
  │   ├── database/                     # PrismaService and global PrismaModule
  │   ├── auth/                         # Argon2id, JWT, refresh rotation, /auth endpoints
  │   ├── users/                        # User profile management
  │   ├── financial-accounts/           # Accounts (Cash, Bank, Mobile Wallet)
  │   ├── categories/                   # System & custom categories
  │   ├── transactions/                 # Income, expense, transfer with atomic balance updates
  │   ├── commitments/                  # Obligations lifecycle & payment engine
  │   ├── budgets/                      # Real-time category spending limits
  │   ├── dashboard/                    # "تقدر تصرف كام؟" (Safe-to-Spend) calculation
  │   └── health/                       # Live database healthcheck endpoint
  ├── prisma/
  │   ├── schema.prisma                 # Database models, relations, indexes, Decimal(14,2)
  │   ├── migrations/                   # Committed version-controlled SQL migrations
  │   └── seed.ts                       # System categories & demo user seed script
  ├── test/
  │   ├── app.e2e-spec.ts               # Complete user journey integration test
  │   └── jest-e2e.json                 # E2E test runner configuration
  ├── docs/decisions/                   # ADRs 001 through 007
  ├── Dockerfile                        # Multi-stage production container
  ├── docker-compose.yml                # Local / staging container orchestration
  ├── .env.example                      # Documented configuration variables
  ├── IMPLEMENTATION_REPORT.md          # Complete phase-by-phase engineering journal
  └── README.md                         # Quickstart, architecture, and API documentation
```

### Where to Start
1. Read `README.md` for quickstart and endpoint reference.
2. Read `docs/decisions/` for architectural rationale (modular monolith, monetary representation, safe-to-spend).
3. Run tests with `pnpm run test` and `pnpm run test:e2e`.
4. Launch the development server with `pnpm run start:dev` and visit Swagger docs at `http://localhost:3000/api/docs`.

