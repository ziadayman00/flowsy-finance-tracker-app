# Flowsy — Backend Technical Audit & Frontend Integration Reference Report

> **Audience**: Frontend Engineering Agent & Frontend Pair Programmers  
> **Status**: Verified via full backend codebase inspection, schema analysis, and test suite execution  
> **Date**: October 18, 2026  
> **Backend Version**: 1.0.0 (NestJS 10 + Prisma 5.22 + PostgreSQL)  
> **Repository Path**: `d:\ziad ayman\CV projects\2026\flowsy`

---

## 1. Executive Summary

This report provides a complete, evidence-based audit of the **Flowsy** personal finance backend API. It is written specifically as an authoritative, self-contained reference for frontend developers and autonomous agents implementing the mobile client.

### Core Architectural Characteristics
1. **NestJS 10 Application**: Modular structure built on Express, secured via `@nestjs/throttler` (global rate limit + auth route overrides), `helmet` (CSP/security headers), strict class-validator whitelisting, centralized exception filtering with correlation IDs (`x-correlation-id`), and strict CORS origin validation.
2. **PostgreSQL & Prisma 5.22 ORM**: Highly normalized schema utilizing PostgreSQL `Decimal(14, 2)` for exact monetary representations, preventing any IEEE 754 floating-point inaccuracies.
3. **Stateless JWT + Rotating Refresh Tokens**: Dual-token authentication with short-lived JWT access tokens (15 minutes) and rotating cryptographic refresh tokens (7 days) stored hashed (SHA-256) in the database with automated replay-attack detection.
4. **Strict Atomic Financial Invariants**: Account balances mutate inside Prisma transactions (`$transaction`) whenever transactions are created, batch-imported, updated, or deleted. Deleted transactions reverse their impact on account balances and restore paid commitments. Cross-currency transfers and payments are strictly rejected.
5. **Deterministic "Safe-to-Spend" ("تقدر تصرف كام؟") Engine**: Evaluates liquid funds across non-excluded spending accounts in the user's base reporting currency, subtracting upcoming and overdue commitments within the active calendar month. Non-base currency accounts are segregated into a distinct summary.

---

## 2. Repository and Architecture Overview

### 2.1 Backend Technology Stack
- **Framework**: NestJS `^10.4.15` on Node.js / `@types/node` `^20.17.10`
- **Language**: TypeScript `^5.6.3` (Strict mode configured)
- **Database & ORM**: PostgreSQL via Prisma Client `^5.22.0`
- **Security & Crypto**: `argon2` `^0.41.1` (Argon2id password hashing), Node built-in `crypto` (SHA-256 for token hashing), `passport-jwt` `^4.0.1`, `helmet` `^8.3.0`
- **Math Precision**: `decimal.js` `^10.4.3` and Prisma `Decimal(14, 2)`
- **Validation & Transformation**: `class-validator` `^0.14.1`, `class-transformer` `^0.5.1`
- **API Documentation**: `@nestjs/swagger` `^7.4.2` (`swagger-ui-express` `^5.0.1`) available at `/api/docs`
- **Rate Limiting**: `@nestjs/throttler` `^6.7.1` (Global: 100 req/min; Auth: 10 req/min)

### 2.2 Global Configuration & Middleware Pipeline
All backend requests pass through the following global pipeline configured in `src/main.ts` and `src/app.module.ts`:

1. **Correlation ID Middleware** (`src/common/middleware/correlation-id.middleware.ts`):
   - Reads incoming `x-correlation-id` header or generates a fresh `uuidv4`.
   - Injects the ID into request headers and sets response header `x-correlation-id`.
2. **HTTP Security Headers** (`src/main.ts`):
   - `helmet` applied with custom CSP directives and disabled cross-origin embedder policy to allow Swagger assets.
3. **Global Route Prefix** (`src/main.ts`):
   - Every route is mounted under `/api/v1` (e.g., `/api/v1/auth/login`).
   - Swagger documentation UI is mounted at `/api/docs`.
4. **Global Validation Pipe** (`src/main.ts`):
   - `whitelist: true`: Drops undeclared request body properties.
   - `forbidNonWhitelisted: true`: Immediately rejects payloads with unmapped fields with `400 Bad Request`.
   - `transform: true` & `enableImplicitConversion: true`: Autocasts primitive types based on TypeScript/DTO metadata.
5. **Global Exception Filter** (`src/common/filters/http-exception.filter.ts`):
   - Catches all HttpExceptions and unhandled errors.
   - Translates Prisma known errors (e.g. `P2002` duplicate unique key $\rightarrow$ `409 Conflict`, `P2025` record not found $\rightarrow$ `404 Not Found`).
   - Standardizes response JSON envelope with `statusCode`, `error`, `message`, `path`, `correlationId`, `timestamp`.
6. **Global Logging Interceptor** (`src/common/interceptors/logging.interceptor.ts`):
   - Logs request method, route, correlation ID, and execution latency in milliseconds.
7. **Global Rate Limiting Guard** (`src/app.module.ts`):
   - ThrottlerGuard bound via `APP_GUARD`.
   - Default: 100 requests per 60,000 ms per client IP.
   - Authentication routes (`/api/v1/auth/*`) override this to a strict 10 requests per 60,000 ms.

### 2.3 CORS Configuration Rules (`src/config/cors.config.ts`)
- **Native Mobile Clients**: Native HTTP requests (such as Axios or Fetch inside React Native / Expo on iOS and Android) do **not** send an `Origin` header. The backend explicitly allows requests without an `Origin` header (`if (!origin) return callback(null, true);`).
- **Web Clients / Dev Tools**: Validated against `CORS_ORIGIN` env variable. In development, defaults to `http://localhost:3000`, `http://localhost:5173`, `http://localhost:8081`. Wildcard `*` is strictly forbidden.
- **Allowed Headers**: `Authorization`, `Content-Type`, `Accept`, `x-correlation-id`.
- **Exposed Headers**: `x-correlation-id`.
- **Credentials**: `true`.

---

## 3. Complete Feature Inventory

| Feature Domain | Feature Name | Implementation Status | Controller / Service Files | Primary Model(s) | Key Constraints & Capabilities |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Auth** | User Registration | Implemented | `src/auth/auth.controller.ts`<br>`src/auth/auth.service.ts` | `User`, `FinancialAccount`, `RefreshToken` | Creates user with Argon2id hash; automatically provisions initial "كاش / Cash" account; returns JWT + refresh token. |
| **Auth** | User Login | Implemented | `src/auth/auth.controller.ts`<br>`src/auth/auth.service.ts` | `User`, `RefreshToken` | Verifies credentials; issues short-lived JWT (15m) + cryptographic refresh token (7d). |
| **Auth** | Refresh Token Rotation | Implemented | `src/auth/auth.controller.ts`<br>`src/auth/auth.service.ts` | `RefreshToken`, `User` | Revokes incoming token and issues a new pair atomically. Detects replay attacks and revokes all user sessions if a revoked token is reused. |
| **Auth** | User Logout | Implemented | `src/auth/auth.controller.ts`<br>`src/auth/auth.service.ts` | `RefreshToken` | Revokes either the provided refresh token or all active sessions for the user. |
| **Auth** | Get Profile (`/auth/me`) | Implemented | `src/auth/auth.controller.ts`<br>`src/auth/auth.service.ts` | `User` | Returns current authenticated user metadata. |
| **Users** | Get Profile (`/users/profile`) | Implemented | `src/users/users.controller.ts`<br>`src/users/users.service.ts` | `User` | Returns profile details (id, email, displayName, currency, timezone, createdAt). |
| **Users** | Update Profile | Implemented | `src/users/users.controller.ts`<br>`src/users/users.service.ts` | `User` | Updates `displayName`, `currency`, `timezone`. |
| **Accounts** | List Accounts | Implemented | `src/financial-accounts/financial-accounts.controller.ts`<br>`src/financial-accounts/financial-accounts.service.ts` | `FinancialAccount` | Filters by `isArchived` (defaults to active accounts only). Shows exact 2-decimal string balances. |
| **Accounts** | Create Account | Implemented | `src/financial-accounts/*` | `FinancialAccount` | Enforces unique `name` per user. Supports CASH, BANK, SAVINGS, MOBILE_WALLET. Allows `excludeFromSafeToSpend`. |
| **Accounts** | Update Account | Implemented | `src/financial-accounts/*` | `FinancialAccount` | Modifies name, type, `excludeFromSafeToSpend`, and `isArchived`. Name uniqueness enforced on rename. |
| **Accounts** | Delete / Archive Account | Implemented | `src/financial-accounts/*` | `FinancialAccount` | Hard delete only allowed if account has 0 transactions and 0 linked commitments. Accounts with transactions must be archived instead. |
| **Categories** | List Categories | Implemented | `src/categories/categories.controller.ts`<br>`src/categories/categories.service.ts` | `Category` | Returns system-provided defaults (`userId: null`) plus user custom categories (`userId: current`). Optional filter by `type` (INCOME/EXPENSE). |
| **Categories** | Create Custom Category | Implemented | `src/categories/*` | `Category` | Creates user-specific category with optional icon. |
| **Categories** | Update Custom Category | Implemented | `src/categories/*` | `Category` | Modifies name, icon, archive status. System-provided categories (`isSystem: true`) are immutable (returns 403 Forbidden). |
| **Categories** | Delete Custom Category | Implemented | `src/categories/*` | `Category` | Hard delete permitted only if 0 transactions and 0 commitments are linked. System categories cannot be deleted (403 Forbidden). |
| **Transactions** | Create Transaction | Implemented | `src/transactions/transactions.controller.ts`<br>`src/transactions/transactions.service.ts` | `Transaction`, `FinancialAccount` | Atomic balance mutation. Handles INCOME (increment), EXPENSE (decrement), and TRANSFER (debit source, credit dest). Rejects cross-currency transfers. |
| **Transactions** | Batch Create Transactions | Implemented | `src/transactions/*` | `Transaction`, `FinancialAccount` | Creates between 1 and 20 transactions in a single atomic database transaction. Perfect for voice entry batch saving. |
| **Transactions** | Query / Paginate Transactions | Implemented | `src/transactions/*` | `Transaction` | Paginated with `page` and `limit` (max 100). Filterable by `type`, `accountId`, `categoryId`, `startDate`, `endDate`. Sorted descending by date. |
| **Transactions** | Update Transaction | Implemented | `src/transactions/*` | `Transaction`, `FinancialAccount` | Modifies note, date, category, or amount. If amount changes, the balance delta is calculated and applied atomically. Account/type cannot be changed. |
| **Transactions** | Delete Transaction | Implemented | `src/transactions/*` | `Transaction`, `FinancialAccount`, `Commitment` | Reverses account balance changes atomically. If the transaction paid a commitment, the commitment is restored to PENDING or OVERDUE. |
| **Commitments** | List Commitments | Implemented | `src/commitments/commitments.controller.ts`<br>`src/commitments/commitments.service.ts` | `Commitment` | Automatically marks past-due PENDING obligations as OVERDUE on query. Filterable by `status`. Sorted by due date ascending. |
| **Commitments** | Create Commitment | Implemented | `src/commitments/*` | `Commitment` | Schedules recurring or one-off obligations. Initial status evaluates to OVERDUE if dueDate is in the past, else PENDING. |
| **Commitments** | Update Commitment | Implemented | `src/commitments/*` | `Commitment` | Updates name, amount, dueDate, status, recurrence, linked account, or category. |
| **Commitments** | Delete Commitment | Implemented | `src/commitments/*` | `Commitment` | Hard deletes commitment record. |
| **Commitments** | Pay Commitment (`:id/pay`) | Implemented | `src/commitments/*` | `Commitment`, `Transaction`, `FinancialAccount` | Atomic payment execution: concurrency-locked update to status PAID, generates EXPENSE transaction, deducts account balance, links transaction ID, and automatically schedules the next occurrence with month-end clamping (e.g. Jan 31 -> Feb 28 -> Mar 31). |
| **Budgets** | List Budgets | Implemented | `src/budgets/budgets.controller.ts`<br>`src/budgets/budgets.service.ts` | `Budget`, `Transaction` | Computes live spending aggregate (`spent`), remaining spendable (`remaining`), and percentage (`percentage`) across budget date range. |
| **Budgets** | Create Budget | Implemented | `src/budgets/*` | `Budget` | Category-specific or overall spending limit over an ISO date range. Enforces `startDate < endDate`. |
| **Budgets** | Update Budget | Implemented | `src/budgets/*` | `Budget` | Updates amount, dates, category, archive flag. Recalculates live progress. |
| **Budgets** | Delete Budget | Implemented | `src/budgets/*` | `Budget` | Hard deletes budget record. |
| **Dashboard** | Financial Summary | Implemented | `src/dashboard/dashboard.controller.ts`<br>`src/dashboard/dashboard.service.ts` | `User`, `FinancialAccount`, `Commitment`, `Transaction` | Calculates Safe-to-Spend ("تقدر تصرف كام؟"), liquid funds, upcoming commitments due this month, deficit flags, monthly income/expense/net savings, and non-base currency summaries. |
| **Health** | System Health Check | Implemented | `src/health/health.controller.ts` | N/A (`SELECT 1`) | Unauthenticated endpoint returning API uptime, environment, version, and database connection state. |

---

## 4. Complete API Endpoint Catalog

All routes are prefixed with `/api/v1`.

### 4.1 Health Check

#### `GET /api/v1/health`
- **Purpose**: System health check and database connectivity verification.
- **Authentication**: None (Public).
- **Query Parameters**: None.
- **Request Body**: None.
- **Success Response (200 OK)**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-18T13:20:00.000Z",
    "uptime": 142.5,
    "environment": "development",
    "version": "1.0.0",
    "database": {
      "status": "connected"
    }
  }
  ```
- **Error Response (503 Service Unavailable)**: Returned if the database query fails. `status: "degraded"`, `database.status: "unreachable"`.

---

### 4.2 Authentication & Profile (`/api/v1/auth`)

Rate limited to **10 requests per minute** per client.

#### `POST /api/v1/auth/register`
- **Purpose**: Register a new user account, seed default "Cash" account, and issue token pair.
- **Authentication**: None.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",       // string, valid email, trimmed & lowercased [Required]
    "password": "StrongPassword123!",  // string, min 8 chars [Required]
    "displayName": "زياد أيمن",         // string, 2-50 chars, trimmed [Required]
    "currency": "EGP",                 // string, optional, default: "EGP"
    "timezone": "Africa/Cairo"         // string, optional, default: "Africa/Cairo"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "user": {
      "id": "c1f7a28e-5d1b-4cf3-a75d-318e4760ba21",
      "email": "user@example.com",
      "displayName": "زياد أيمن",
      "currency": "EGP",
      "timezone": "Africa/Cairo",
      "createdAt": "2026-10-18T13:20:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08...",
    "expiresIn": 900
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation failure (invalid email, password < 8 chars).
  - `409 Conflict`: `"An account with this email address already exists"`

#### `POST /api/v1/auth/login`
- **Purpose**: Authenticate user and issue fresh access + refresh tokens.
- **Authentication**: None.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",       // string, valid email, trimmed & lowercased [Required]
    "password": "StrongPassword123!"   // string, non-empty [Required]
  }
  ```
- **Success Response (200 OK)**: Identical to `POST /api/v1/auth/register` response.
- **Error Response**: `401 Unauthorized`: `"Invalid email or password"`.

#### `POST /api/v1/auth/refresh`
- **Purpose**: Rotate refresh token. Invalidate old refresh token and issue a new token pair.
- **Authentication**: None (Refresh token provided in body).
- **Request Body**:
  ```json
  {
    "refreshToken": "9f86d081884c7d659a2feaa0c55ad015..." // string, non-empty [Required]
  }
  ```
- **Success Response (200 OK)**: Identical to `POST /api/v1/auth/register` response.
- **Error Response**: `401 Unauthorized`: `"Invalid refresh token"` or `"Refresh token has expired"`.
- **Security Note**: If a token with `revokedAt != null` is presented, **all** active tokens for that user are revoked immediately (replay attack prevention).

#### `POST /api/v1/auth/logout`
- **Purpose**: Revoke active session(s).
- **Authentication**: Bearer JWT (`JwtAuthGuard`).
- **Request Body**:
  ```json
  {
    "refreshToken": "9f86d081884c7d659a2feaa0c55ad015..." // string, optional
  }
  ```
  *(Note: If `refreshToken` is omitted, ALL active sessions for the user are revoked.)*
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

#### `GET /api/v1/auth/me`
- **Purpose**: Get current authenticated user profile.
- **Authentication**: Bearer JWT (`JwtAuthGuard`).
- **Success Response (200 OK)**:
  ```json
  {
    "id": "c1f7a28e-5d1b-4cf3-a75d-318e4760ba21",
    "email": "user@example.com",
    "displayName": "زياد أيمن",
    "currency": "EGP",
    "timezone": "Africa/Cairo",
    "createdAt": "2026-10-18T13:20:00.000Z"
  }
  ```

---

### 4.3 Users (`/api/v1/users`)

#### `GET /api/v1/users/profile`
- **Purpose**: Alternate endpoint for retrieving current user profile.
- **Authentication**: Bearer JWT.
- **Success Response (200 OK)**: Same schema as `/api/v1/auth/me`.

#### `PATCH /api/v1/users/profile`
- **Purpose**: Update user display name, currency, or timezone.
- **Authentication**: Bearer JWT.
- **Request Body**:
  ```json
  {
    "displayName": "زياد أيمن",  // string, optional, 2-50 chars, trimmed
    "currency": "EGP",           // string, optional
    "timezone": "Africa/Cairo"   // string, optional
  }
  ```
- **Success Response (200 OK)**: Returns updated `UserProfileDto`.

---

### 4.4 Financial Accounts (`/api/v1/accounts`)

#### `GET /api/v1/accounts`
- **Purpose**: List user financial accounts.
- **Authentication**: Bearer JWT.
- **Query Parameters**:
  - `includeArchived` (boolean, optional, default: `false`): Include archived accounts.
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "acc-uuid-1",
      "name": "كاش / Cash",
      "type": "CASH",
      "currency": "EGP",
      "initialBalance": "2500.00",
      "currentBalance": "2500.00",
      "isArchived": false,
      "excludeFromSafeToSpend": false,
      "createdAt": "2026-10-18T13:20:00.000Z"
    }
  ]
  ```

#### `GET /api/v1/accounts/:id`
- **Purpose**: Get single account details.
- **Authentication**: Bearer JWT. Ownership verified.
- **Success Response (200 OK)**: Single `AccountResponseDto`.
- **Error Response**: `404 Not Found`: `"Financial account not found"`.

#### `POST /api/v1/accounts`
- **Purpose**: Create a new financial account.
- **Authentication**: Bearer JWT.
- **Request Body**:
  ```json
  {
    "name": "حساب بنك مصر",                 // string, 1-50 chars, trimmed [Required]
    "type": "BANK",                         // enum: CASH | BANK | SAVINGS | MOBILE_WALLET [Required]
    "currency": "EGP",                      // string, optional, default: "EGP"
    "initialBalance": 5000.00,              // number, optional, >= 0, max 2 decimals, default: 0.00
    "excludeFromSafeToSpend": false         // boolean, optional, default: false
  }
  ```
- **Success Response (201 Created)**: Returns created `AccountResponseDto`.
- **Error Response**: `409 Conflict`: `"An account with the name \"...\" already exists"`.

#### `PATCH /api/v1/accounts/:id`
- **Purpose**: Update account metadata.
- **Authentication**: Bearer JWT. Ownership verified.
- **Request Body**:
  ```json
  {
    "name": "حساب بنك مصر المعدل",          // string, optional, 1-50 chars, trimmed
    "type": "BANK",                         // enum: CASH | BANK | SAVINGS | MOBILE_WALLET, optional
    "excludeFromSafeToSpend": true,         // boolean, optional
    "isArchived": false                     // boolean, optional
  }
  ```
  *(Note: Opening/initial balance cannot be altered via this endpoint to preserve financial auditability.)*
- **Success Response (200 OK)**: Returns updated `AccountResponseDto`.

#### `DELETE /api/v1/accounts/:id`
- **Purpose**: Delete an unused account.
- **Authentication**: Bearer JWT. Ownership verified.
- **Behavior**:
  - If account has $\ge 1$ transactions: rejects with `400 Bad Request`: `"Cannot permanently delete an account with recorded transactions. Please archive the account instead to preserve financial history."`
  - If account has $\ge 1$ commitments: rejects with `400 Bad Request`: `"Cannot permanently delete an account linked to commitments. Please unlink or archive the account instead."`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Account deleted successfully"
  }
  ```

---

### 4.5 Categories (`/api/v1/categories`)

#### `GET /api/v1/categories`
- **Purpose**: List system default categories (`isSystem: true`) and user custom categories (`isSystem: false`).
- **Authentication**: Bearer JWT.
- **Query Parameters**:
  - `type` (`INCOME` | `EXPENSE`, optional): Filter by category classification.
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "cat-uuid-1",
      "name": "Groceries / بقالة ومستلزمات",
      "type": "EXPENSE",
      "icon": "cart-outline",
      "isSystem": true,
      "isArchived": false
    },
    {
      "id": "cat-uuid-2",
      "name": "اشتراكات نتفلكس",
      "type": "EXPENSE",
      "icon": "tv-outline",
      "isSystem": false,
      "isArchived": false
    }
  ]
  ```

#### `GET /api/v1/categories/:id`
- **Purpose**: Retrieve category details.
- **Authentication**: Bearer JWT. Access permitted if system category or owned by user.
- **Success Response (200 OK)**: Single `CategoryResponseDto`.
- **Error Response**: `404 Not Found`: `"Category not found"`.

#### `POST /api/v1/categories`
- **Purpose**: Create a custom user category.
- **Authentication**: Bearer JWT.
- **Request Body**:
  ```json
  {
    "name": "اشتراكات برامج",   // string, 1-50 chars, trimmed [Required]
    "type": "EXPENSE",          // enum: INCOME | EXPENSE [Required]
    "icon": "code-slash-outline" // string, optional
  }
  ```
- **Success Response (201 Created)**: Returns created `CategoryResponseDto` with `isSystem: false`.

#### `PATCH /api/v1/categories/:id`
- **Purpose**: Update custom user category.
- **Authentication**: Bearer JWT.
- **Restrictions**: System categories (`isSystem: true`) reject modifications with `403 Forbidden`: `"System default categories cannot be modified"`.
- **Request Body**:
  ```json
  {
    "name": "اشتراكات معدلة",   // string, optional
    "icon": "tv-outline",       // string, optional
    "isArchived": true          // boolean, optional
  }
  ```
- **Success Response (200 OK)**: Returns updated `CategoryResponseDto`.

#### `DELETE /api/v1/categories/:id`
- **Purpose**: Delete custom user category.
- **Authentication**: Bearer JWT.
- **Restrictions**:
  - System categories: `403 Forbidden`: `"System default categories cannot be deleted"`.
  - Categories with transactions: `400 Bad Request`: `"Cannot delete category with associated transactions. Please archive it instead."`.
  - Categories with commitments: `400 Bad Request`: `"Cannot delete category with associated commitments. Please archive it instead."`.
- **Success Response (200 OK)**: `{"success": true, "message": "Category deleted successfully"}`.

---

### 4.6 Transactions (`/api/v1/transactions`)

#### `POST /api/v1/transactions`
- **Purpose**: Record a single financial transaction with atomic account balance updates.
- **Authentication**: Bearer JWT.
- **Request Body**:
  ```json
  {
    "type": "EXPENSE",                            // enum: INCOME | EXPENSE | TRANSFER [Required]
    "amount": 250.75,                             // number, > 0, max 2 decimal places [Required]
    "accountId": "acc-uuid-1",                    // UUID v4 [Required]
    "categoryId": "cat-uuid-1",                   // UUID v4, optional (ignored if TRANSFER)
    "destinationAccountId": "acc-uuid-2",         // UUID v4, REQUIRED if type == TRANSFER
    "transactionDate": "2026-10-18T13:30:00.000Z", // ISO 8601 string, optional (default: now)
    "note": "سوبرماركت زهران"                     // string, max 200 chars, trimmed, optional
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "id": "tx-uuid-1",
    "type": "EXPENSE",
    "amount": "250.75",
    "currency": "EGP",
    "note": "سوبرماركت زهران",
    "transactionDate": "2026-10-18T13:30:00.000Z",
    "account": {
      "id": "acc-uuid-1",
      "name": "محفظة الكاش"
    },
    "category": {
      "id": "cat-uuid-1",
      "name": "Groceries / بقالة ومستلزمات",
      "icon": "cart-outline"
    },
    "destinationAccount": null,
    "createdAt": "2026-10-18T13:30:05.123Z"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Missing `destinationAccountId` on TRANSFER; `accountId === destinationAccountId`; or cross-currency transfer attempt (`"Cross-currency transfers are not supported. Source account is EGP, destination account is USD."`).
  - `404 Not Found`: Account or Category does not exist or belongs to another user.

#### `POST /api/v1/transactions/batch`
- **Purpose**: Atomically create multiple transactions in a single database transaction. Highly recommended for multi-expense voice recording workflows.
- **Authentication**: Bearer JWT.
- **Request Body**:
  ```json
  {
    "transactions": [
      {
        "type": "EXPENSE",
        "amount": 120.00,
        "accountId": "acc-uuid-1",
        "categoryId": "cat-uuid-groceries",
        "note": "خضار وفاكهة"
      },
      {
        "type": "EXPENSE",
        "amount": 85.50,
        "accountId": "acc-uuid-1",
        "categoryId": "cat-uuid-dining",
        "note": "قهوة الصباح"
      }
    ]
  }
  ```
  *(Constraint: 1 to 20 transactions per batch.)*
- **Success Response (201 Created)**:
  ```json
  {
    "created": [
      {
        "id": "tx-1",
        "type": "EXPENSE",
        "amount": "120.00",
        "currency": "EGP",
        "note": "خضار وفاكهة",
        "transactionDate": "2026-10-18T13:30:00.000Z",
        "account": { "id": "acc-uuid-1", "name": "كاش / Cash" },
        "category": { "id": "cat-uuid-groceries", "name": "Groceries", "icon": "cart-outline" },
        "destinationAccount": null,
        "createdAt": "2026-10-18T13:30:01.000Z"
      },
      {
        "id": "tx-2",
        "type": "EXPENSE",
        "amount": "85.50",
        "currency": "EGP",
        "note": "قهوة الصباح",
        "transactionDate": "2026-10-18T13:30:00.000Z",
        "account": { "id": "acc-uuid-1", "name": "كاش / Cash" },
        "category": { "id": "cat-uuid-dining", "name": "Dining", "icon": "restaurant-outline" },
        "destinationAccount": null,
        "createdAt": "2026-10-18T13:30:01.000Z"
      }
    ],
    "count": 2
  }
  ```
- **Error Behavior**: If **any** single transaction fails validation or references an invalid account/category, the entire batch is rolled back and no balance is modified.

#### `GET /api/v1/transactions`
- **Purpose**: Paginated transaction list with filtering and search.
- **Authentication**: Bearer JWT.
- **Query Parameters**:
  - `type` (`INCOME` | `EXPENSE` | `TRANSFER`, optional)
  - `accountId` (UUID v4, optional)
  - `categoryId` (UUID v4, optional)
  - `startDate` (ISO 8601 string, optional)
  - `endDate` (ISO 8601 string, optional)
  - `page` (number, optional, default: 1)
  - `limit` (number, optional, default: 20, max: 100)
- **Success Response (200 OK)**:
  ```json
  {
    "data": [ /* Array of TransactionResponseDto */ ],
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
  ```

#### `GET /api/v1/transactions/:id`
- **Purpose**: Retrieve single transaction details.
- **Authentication**: Bearer JWT. Ownership verified.
- **Success Response (200 OK)**: Single `TransactionResponseDto`.

#### `PATCH /api/v1/transactions/:id`
- **Purpose**: Update transaction amount, category, date, or note.
- **Authentication**: Bearer JWT. Ownership verified.
- **Behavior**: If `amount` changes, the exact delta `(newAmount - oldAmount)` is calculated and applied to the linked account balance atomically.
- **Request Body**:
  ```json
  {
    "amount": 300.00,                             // number, > 0, optional
    "categoryId": "cat-uuid-new",                 // UUID v4, optional
    "transactionDate": "2026-10-18T15:00:00.000Z", // ISO 8601, optional
    "note": "ملاحظة معدلة"                         // string, max 200 chars, optional
  }
  ```
- **Success Response (200 OK)**: Returns updated `TransactionResponseDto`.

#### `DELETE /api/v1/transactions/:id`
- **Purpose**: Delete transaction and atomically reverse its balance effect.
- **Authentication**: Bearer JWT. Ownership verified.
- **Side Effects**:
  1. Reverses account balance (e.g. deleting an EXPENSE increments account balance by the amount; deleting an INCOME decrements it; deleting a TRANSFER refunds source and debits destination).
  2. If the transaction was created by paying a commitment (`paidTransactionId == transactionId`), the commitment is restored to `paidTransactionId: null`, and its status reverts to `OVERDUE` (if `dueDate < now`) or `PENDING` (if `dueDate >= now`).
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Transaction reversed and deleted successfully"
  }
  ```

---

### 4.7 Commitments (`/api/v1/commitments`)

#### `GET /api/v1/commitments`
- **Purpose**: List upcoming and past financial commitments.
- **Authentication**: Bearer JWT.
- **Query Parameters**:
  - `status` (`PENDING` | `PAID` | `CANCELLED` | `OVERDUE`, optional)
- **Automatic Side Effect**: Automatically updates any past-due `PENDING` commitments (`dueDate < now`) to `OVERDUE` before returning results.
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "comm-uuid-1",
      "name": "إيجار الشقة",
      "amount": "6000.00",
      "currency": "EGP",
      "dueDate": "2026-10-31T00:00:00.000Z",
      "status": "PENDING",
      "recurrence": "MONTHLY",
      "accountId": "acc-uuid-1",
      "categoryId": "cat-uuid-rent",
      "paidTransactionId": null,
      "createdAt": "2026-10-18T12:00:00.000Z"
    }
  ]
  ```

#### `GET /api/v1/commitments/:id`
- **Purpose**: Get specific commitment details.
- **Authentication**: Bearer JWT. Ownership verified.
- **Success Response (200 OK)**: Single `CommitmentResponseDto`.

#### `POST /api/v1/commitments`
- **Purpose**: Create a commitment.
- **Authentication**: Bearer JWT.
- **Request Body**:
  ```json
  {
    "name": "فاتورة الكهرباء",          // string, 1-100 chars, trimmed [Required]
    "amount": 750.00,                   // number, > 0, max 2 decimals [Required]
    "currency": "EGP",                  // string, optional, default: "EGP"
    "dueDate": "2026-10-25T00:00:00Z",  // ISO 8601 string [Required]
    "recurrence": "MONTHLY",            // enum: NONE | DAILY | WEEKLY | MONTHLY | YEARLY, default: NONE
    "accountId": "acc-uuid-1",          // UUID v4, optional default account
    "categoryId": "cat-uuid-util"       // UUID v4, optional category
  }
  ```
- **Success Response (201 Created)**: Returns created `CommitmentResponseDto`. Status defaults to `OVERDUE` if `dueDate < now`, else `PENDING`.

#### `PATCH /api/v1/commitments/:id`
- **Purpose**: Update commitment fields.
- **Authentication**: Bearer JWT. Ownership verified.
- **Request Body**:
  ```json
  {
    "name": "فاتورة الكهرباء والغاز",
    "amount": 800.00,
    "dueDate": "2026-10-27T00:00:00Z",
    "status": "CANCELLED",
    "recurrence": "MONTHLY",
    "accountId": "acc-uuid-1",
    "categoryId": "cat-uuid-util"
  }
  ```
- **Success Response (200 OK)**: Returns updated `CommitmentResponseDto`.

#### `DELETE /api/v1/commitments/:id`
- **Purpose**: Delete commitment record.
- **Authentication**: Bearer JWT. Ownership verified.
- **Success Response (200 OK)**: `{"success": true, "message": "Commitment deleted successfully"}`.

#### `POST /api/v1/commitments/:id/pay`
- **Purpose**: Execute atomic payment of a commitment.
- **Authentication**: Bearer JWT. Ownership verified.
- **Request Body**:
  ```json
  {
    "accountId": "acc-uuid-1",                   // UUID v4, account to deduct payment from [Required]
    "paidAt": "2026-10-18T14:00:00.000Z",        // ISO 8601 string, optional (default: now)
    "note": "سداد إيجار شهر أكتوبر"              // string, max 200 chars, optional
  }
  ```
- **Atomic Operations Performed**:
  1. Claims lock via conditional update (`status != PAID`). Prevents concurrent double-spend.
  2. Creates an `EXPENSE` transaction for the commitment amount.
  3. Decrements current balance of `accountId` by commitment amount.
  4. Sets commitment `status = PAID` and `paidTransactionId = tx.id`.
  5. **Recurring scheduling**: If `recurrence != NONE`, calculates next due date (applying month-end clamping) and creates a new `PENDING` commitment for the next period.
- **Success Response (200 OK)**:
  ```json
  {
    "commitment": {
      "id": "comm-uuid-1",
      "name": "إيجار الشقة",
      "amount": "6000.00",
      "currency": "EGP",
      "dueDate": "2026-10-31T00:00:00.000Z",
      "status": "PAID",
      "recurrence": "MONTHLY",
      "accountId": "acc-uuid-1",
      "categoryId": "cat-uuid-rent",
      "paidTransactionId": "tx-uuid-generated",
      "createdAt": "2026-10-18T12:00:00.000Z"
    },
    "transactionId": "tx-uuid-generated"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `"This commitment has already been marked as paid"`.
  - `400 Bad Request`: Cross-currency payment attempt.

---

### 4.8 Budgets (`/api/v1/budgets`)

#### `GET /api/v1/budgets`
- **Purpose**: List user budgets with dynamically calculated live spending progress.
- **Authentication**: Bearer JWT.
- **Query Parameters**:
  - `includeArchived` (boolean, optional, default: `false`)
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "budget-uuid-1",
      "name": "ميزانية البقالة",
      "amount": "4000.00",
      "spent": "1250.50",
      "remaining": "2749.50",
      "percentage": 31.26,
      "categoryId": "cat-uuid-groceries",
      "categoryName": "Groceries / بقالة ومستلزمات",
      "startDate": "2026-10-01T00:00:00.000Z",
      "endDate": "2026-10-31T23:59:59.999Z",
      "isArchived": false
    }
  ]
  ```

#### `GET /api/v1/budgets/:id`
- **Purpose**: Retrieve single budget with live spending calculation.
- **Authentication**: Bearer JWT. Ownership verified.
- **Success Response (200 OK)**: Single `BudgetResponseDto`.

#### `POST /api/v1/budgets`
- **Purpose**: Create a new budget.
- **Authentication**: Bearer JWT.
- **Request Body**:
  ```json
  {
    "name": "ميزانية البقالة لشهر أكتوبر",         // string, 1-100 chars, trimmed [Required]
    "amount": 4000.00,                            // number, > 0, max 2 decimals [Required]
    "categoryId": "cat-uuid-groceries",           // UUID v4, optional (omit for total spending budget)
    "startDate": "2026-10-01T00:00:00.000Z",       // ISO 8601 string [Required]
    "endDate": "2026-10-31T23:59:59.999Z"          // ISO 8601 string [Required]
  }
  ```
- **Validation**: Enforces `startDate < endDate`.
- **Success Response (201 Created)**: Returns created `BudgetResponseDto` with calculated progress.

#### `PATCH /api/v1/budgets/:id`
- **Purpose**: Update budget amount, name, category, dates, or archive flag.
- **Authentication**: Bearer JWT. Ownership verified.
- **Success Response (200 OK)**: Returns updated `BudgetResponseDto`.

#### `DELETE /api/v1/budgets/:id`
- **Purpose**: Delete a budget.
- **Authentication**: Bearer JWT. Ownership verified.
- **Success Response (200 OK)**: `{"success": true, "message": "Budget deleted successfully"}`.

---

### 4.9 Dashboard (`/api/v1/dashboard`)

#### `GET /api/v1/dashboard/summary`
- **Purpose**: Retrieve the consolidated financial snapshot, Safe-to-Spend ("تقدر تصرف كام؟"), monthly cash flow, and account summaries.
- **Authentication**: Bearer JWT.
- **Success Response (200 OK)**:
  ```json
  {
    "baseCurrency": "EGP",
    "safeToSpend": {
      "safeToSpend": "14350.00",
      "currency": "EGP",
      "totalLiquidFunds": "20800.00",
      "totalPendingCommitments": "6450.00",
      "pendingCommitmentsCount": 2,
      "isDeficit": false,
      "deficitAmount": "0.00",
      "calculatedAt": "2026-10-18T13:30:00.000Z"
    },
    "monthlySummary": {
      "income": "25000.00",
      "expenses": "8500.00",
      "netSavings": "16500.00",
      "currency": "EGP",
      "periodStart": "2026-10-01T00:00:00.000Z",
      "periodEnd": "2026-10-31T23:59:59.999Z"
    },
    "totalLiquidBalance": "20800.00",
    "totalProtectedSavings": "5000.00",
    "excludedCurrenciesSummary": [
      {
        "currency": "USD",
        "totalLiquidBalance": "500.00",
        "totalProtectedSavings": "0.00",
        "accountCount": 1
      }
    ],
    "accounts": [
      {
        "id": "acc-1",
        "name": "كاش / Cash",
        "type": "CASH",
        "currency": "EGP",
        "currentBalance": "2300.00",
        "excludeFromSafeToSpend": false
      },
      {
        "id": "acc-2",
        "name": "حساب التوفير",
        "type": "SAVINGS",
        "currency": "EGP",
        "currentBalance": "5000.00",
        "excludeFromSafeToSpend": true
      }
    ]
  }
  ```

---

## 5. Authentication and Authorization

### 5.1 Token Lifecycle & Security
1. **Access Token**:
   - Standard JWT signed with `JWT_ACCESS_SECRET`.
   - Expiration: 15 minutes (`900` seconds returned in `expiresIn`).
   - Format: `Bearer <token>` in the HTTP `Authorization` header.
   - Payload: `{ "sub": "<userId>", "email": "<userEmail>" }`.
2. **Refresh Token**:
   - High-entropy cryptographic token generated via `crypto.randomBytes(40).toString('hex')`.
   - Expiration: 7 days.
   - Stored in PostgreSQL `refresh_tokens` table as a SHA-256 hash (`tokenHash`).
   - **Rotation**: On every invocation of `POST /api/v1/auth/refresh`, the old token is marked `revokedAt = now()`, and a fresh refresh token is created in the same database transaction.
   - **Replay Attack Detection**: If a client attempts to use an already-revoked refresh token, the server immediately revokes **all** active tokens for that user account (`revokedAt = now()`), forcing re-login across all devices.
3. **Session Revocation (Logout)**:
   - Calling `POST /api/v1/auth/logout` with `{ refreshToken: "..." }` revokes that specific session.
   - Calling `POST /api/v1/auth/logout` with an empty body revokes **all** active sessions for the user.

### 5.2 Ownership & Tenancy Rules
- Every resource (`FinancialAccount`, `Transaction`, `Commitment`, `Budget`) has a mandatory `userId` foreign key referencing the `users` table.
- Controllers extract `userId` from `@CurrentUser() user: AuthenticatedUser`.
- Services query records with `where: { id: resourceId, userId }`. If no matching row exists, the backend returns `404 Not Found` (rather than 403 Forbidden) to avoid leaking the existence of other users' IDs.
- Categories support a dual tenancy model:
  - System default categories: `userId == null` (visible to all users, editable/deletable by none).
  - User custom categories: `userId == currentUserId` (visible only to the owner, editable/deletable by the owner).

---

## 6. Database and Data Model

### 6.1 Database Schema Diagram (Entity-Relationship)

```mermaid
erDiagram
    User ||--o{ RefreshToken : has
    User ||--o{ FinancialAccount : owns
    User ||--o{ Category : creates
    User ||--o{ Transaction : records
    User ||--o{ Commitment : schedules
    User ||--o{ Budget : defines

    FinancialAccount ||--o{ Transaction : source_account
    FinancialAccount ||--o{ Transaction : destination_account
    FinancialAccount ||--o{ Commitment : default_account

    Category ||--o{ Transaction : categorizes
    Category ||--o{ Commitment : categorizes
    Category ||--o{ Budget : bounds

    Transaction ||--o| Commitment : satisfies

    User {
        string id PK
        string email UK
        string passwordHash
        string displayName
        string currency
        string timezone
        datetime createdAt
        datetime updatedAt
    }

    RefreshToken {
        string id PK
        string tokenHash UK
        string userId FK
        datetime expiresAt
        datetime revokedAt
        datetime createdAt
    }

    FinancialAccount {
        string id PK
        string userId FK
        string name
        AccountType type
        string currency
        decimal initialBalance
        decimal currentBalance
        boolean isArchived
        boolean excludeFromSafeToSpend
        datetime createdAt
        datetime updatedAt
    }

    Category {
        string id PK
        string userId FK
        string name
        CategoryType type
        string icon
        boolean isArchived
        datetime createdAt
        datetime updatedAt
    }

    Transaction {
        string id PK
        string userId FK
        string accountId FK
        string categoryId FK
        TransactionType type
        decimal amount
        string currency
        string note
        datetime transactionDate
        string destinationAccountId FK
        datetime createdAt
        datetime updatedAt
    }

    Commitment {
        string id PK
        string userId FK
        string name
        decimal amount
        string currency
        datetime dueDate
        CommitmentStatus status
        RecurrenceFrequency recurrence
        string accountId FK
        string categoryId FK
        string paidTransactionId FK
        datetime createdAt
        datetime updatedAt
    }

    Budget {
        string id PK
        string userId FK
        string name
        decimal amount
        string categoryId FK
        datetime startDate
        datetime endDate
        boolean isArchived
        datetime createdAt
        datetime updatedAt
    }
```

### 6.2 Database Enums

| Enum Name | Permitted Values | Meaning / Usage |
| :--- | :--- | :--- |
| `AccountType` | `CASH`, `BANK`, `SAVINGS`, `MOBILE_WALLET` | Financial account classification. |
| `CategoryType` | `INCOME`, `EXPENSE` | Category classification. |
| `TransactionType` | `INCOME`, `EXPENSE`, `TRANSFER` | Financial transaction classification. |
| `CommitmentStatus` | `PENDING`, `PAID`, `CANCELLED`, `OVERDUE` | Status of obligation. Evaluated dynamically or via `:id/pay`. |
| `RecurrenceFrequency` | `NONE`, `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` | Recurrence rule for obligations. |

---

## 7. Business Logic and Financial Rules

### 7.1 Precision Monetary Math
- All monetary columns in PostgreSQL are configured as `Decimal(14, 2)` (up to 999,999,999,999.99).
- Inside NestJS services, calculations are conducted using `decimal.js` or Prisma `Decimal`. Floating-point operations (`+`, `-`, `*`, `/` on raw JS numbers) are strictly avoided.
- In DTO responses, amounts are serialized as fixed 2-decimal strings (e.g. `"250.00"`).

### 7.2 Atomic Balance Mutation & Reversal Logic
Whenever a transaction is created, updated, or deleted, balance mutation is executed inside `prisma.$transaction`:

$$\Delta_{\text{create}} = \begin{cases} 
\text{account.balance} + \text{amount} & \text{if } \text{type} = \text{INCOME} \\
\text{account.balance} - \text{amount} & \text{if } \text{type} = \text{EXPENSE} \\
\text{source.balance} - \text{amount}, \quad \text{dest.balance} + \text{amount} & \text{if } \text{type} = \text{TRANSFER}
\end{cases}$$

When deleting a transaction (`DELETE /api/v1/transactions/:id`):
- `INCOME` deletion $\implies$ account balance is **decremented**.
- `EXPENSE` deletion $\implies$ account balance is **incremented**.
- `TRANSFER` deletion $\implies$ source is refunded (**incremented**), destination is **decremented**.
- If `paidCommitment` is attached, the commitment is restored to unpaid state:
  $$\text{status} = \begin{cases} \text{OVERDUE} & \text{if } \text{commitment.dueDate} < \text{now} \\ \text{PENDING} & \text{if } \text{commitment.dueDate} \ge \text{now} \end{cases}$$
  and `paidTransactionId` is reset to `null`.

### 7.3 Multi-Currency & Cross-Currency Restrictions
- Flowsy does not perform automatic FX conversions without user confirmation.
- **Transfers between different currencies are strictly rejected** with `400 Bad Request`.
- **Paying a commitment from an account with a mismatched currency is rejected** with `400 Bad Request`.
- A transaction's currency is strictly inherited from the originating account's currency (`account.currency`).

### 7.4 Safe-to-Spend ("تقدر تصرف كام؟") Formula
The dashboard calculation engine follows a deterministic formula:

$$\text{Total Liquid Funds} = \sum \text{account.currentBalance} \quad \left[\text{where } \text{currency} = \text{user.currency} \ \land \ \neg\text{excludeFromSafeToSpend} \ \land \ \neg\text{isArchived}\right]$$

$$\text{Total Pending Commitments} = \sum \text{commitment.amount} \quad \left[\text{where } \text{currency} = \text{user.currency} \ \land \ \text{status} \in \{\text{PENDING}, \text{OVERDUE}\} \ \land \ \text{dueDate} \le \text{EndOfMonth}\right]$$

$$\text{Safe-to-Spend} = \text{Total Liquid Funds} - \text{Total Pending Commitments}$$

If $\text{Safe-to-Spend} < 0$:
- `isDeficit = true`
- `deficitAmount = |Safe-to-Spend|`
- `safeToSpend` remains negative (e.g. `"-1500.00"`), signaling financial deficit to the UI.

Accounts flagged with `excludeFromSafeToSpend: true` (e.g. emergency savings) are grouped into `totalProtectedSavings`. Accounts in other currencies (e.g. USD, SAR) are grouped into `excludedCurrenciesSummary`.

### 7.5 Commitment Recurrence & Month-End Clamping Rule (`DAT-01`)
When a monthly recurring commitment is paid:
1. If the commitment due day is the 28th, 29th, 30th, or 31st (or the last day of the current month), the system preserves the intended target day of the month ($31$).
2. If the following month has fewer days than the target day (e.g. February has 28 days), the next due date is clamped to the last day of that month (February 28).
3. In subsequent months that contain 31 days (e.g. March), the target day ($31$) is restored.
4. Yearly recurrence on February 29 advances to February 28 in non-leap years.

---

## 8. Frontend Integration Guide

### 8.1 API Client Architecture (Recommended Pattern)
Implement an Axios or Fetch instance with standard request and response interceptors:

```typescript
// mobile/src/services/api/apiClient.ts
import axios from 'axios';
import { getToken, getRefreshToken, saveTokens, clearTokens } from './tokenStorage';

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token available');

        const { data } = await axios.post(`${apiClient.defaults.baseURL}/auth/refresh`, {
          refreshToken,
        });

        await saveTokens(data.accessToken, data.refreshToken);
        failedQueue.forEach((prom) => prom.resolve(data.accessToken));
        failedQueue = [];
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        failedQueue.forEach((prom) => prom.reject(refreshErr));
        failedQueue = [];
        await clearTokens();
        // Redirect to login screen
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
```

### 8.2 Handling Correlation IDs
Every backend response includes `x-correlation-id`. Log this ID on the client whenever an error occurs. When presenting a user-facing error dialog, including the short correlation ID enables rapid tracing in backend server logs.

---

## 9. Screen-to-API Mapping

| Mobile Screen / Component | User Action / Event | Method | Exact API Endpoint | Payload / Params |
| :--- | :--- | :--- | :--- | :--- |
| **Login Screen** | User submits email & password | `POST` | `/api/v1/auth/login` | `{ email, password }` |
| **Register Screen** | User registers new account | `POST` | `/api/v1/auth/register` | `{ email, password, displayName, currency? }` |
| **Home / Dashboard** | Screen focus / pull-to-refresh | `GET` | `/api/v1/dashboard/summary` | None |
| **Home / Dashboard** | Fetch active spending accounts | `GET` | `/api/v1/accounts` | `?includeArchived=false` |
| **Home / Dashboard** | Fetch upcoming obligations | `GET` | `/api/v1/commitments` | `?status=PENDING` |
| **Transactions List** | Screen load / infinite scroll | `GET` | `/api/v1/transactions` | `?page=1&limit=20&type=...` |
| **Add Expense Modal** | Manual single transaction save | `POST` | `/api/v1/transactions` | `{ type, amount, accountId, categoryId, note, transactionDate }` |
| **Voice Entry Review** | User approves parsed batch of expenses | `POST` | `/api/v1/transactions/batch` | `{ transactions: [ { type, amount, accountId, categoryId, note }, ... ] }` |
| **Edit Transaction** | User updates note, amount, or category | `PATCH` | `/api/v1/transactions/:id` | `{ amount?, categoryId?, note?, transactionDate? }` |
| **Delete Transaction** | User deletes an expense/income | `DELETE` | `/api/v1/transactions/:id` | None |
| **Commitments Screen** | View obligations | `GET` | `/api/v1/commitments` | None (or `?status=PENDING`) |
| **Pay Commitment Modal** | User clicks "سداد" (Pay Now) | `POST` | `/api/v1/commitments/:id/pay` | `{ accountId, paidAt?, note? }` |
| **Add Commitment** | Create recurring/one-time bill | `POST` | `/api/v1/commitments` | `{ name, amount, dueDate, recurrence, accountId, categoryId }` |
| **Budgets Screen** | View spending targets & progress | `GET` | `/api/v1/budgets` | `?includeArchived=false` |
| **Add Budget Modal** | Set monthly category limit | `POST` | `/api/v1/budgets` | `{ name, amount, categoryId?, startDate, endDate }` |
| **Accounts Screen** | View and manage wallets/banks | `GET` | `/api/v1/accounts` | `?includeArchived=true` |
| **Create Account Modal**| Add bank account or mobile wallet | `POST` | `/api/v1/accounts` | `{ name, type, initialBalance, currency, excludeFromSafeToSpend }` |
| **Profile / Settings** | Change display name / settings | `PATCH` | `/api/v1/users/profile` | `{ displayName?, currency?, timezone? }` |
| **Settings** | User logs out | `POST` | `/api/v1/auth/logout` | `{ refreshToken? }` |

---

## 10. TypeScript Request and Response Contracts

The frontend codebase can import or mirror these exact TypeScript interfaces:

```typescript
// contracts/flowsy-api.ts

export type AccountType = 'CASH' | 'BANK' | 'SAVINGS' | 'MOBILE_WALLET';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type CommitmentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'OVERDUE';
export type RecurrenceFrequency = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  currency: string;
  timezone: string;
  createdAt: string;
}

export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface FinancialAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: string;
  currentBalance: string;
  isArchived: boolean;
  excludeFromSafeToSpend: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  isSystem: boolean;
  isArchived: boolean;
}

export interface TransactionSummaryItem {
  id: string;
  name: string;
  icon?: string | null;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  currency: string;
  note: string | null;
  transactionDate: string;
  account: TransactionSummaryItem;
  category: TransactionSummaryItem | null;
  destinationAccount: TransactionSummaryItem | null;
  createdAt: string;
}

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateTransactionPayload {
  type: TransactionType;
  amount: number;
  accountId: string;
  categoryId?: string;
  destinationAccountId?: string;
  transactionDate?: string;
  note?: string;
}

export interface BatchCreateTransactionsPayload {
  transactions: CreateTransactionPayload[];
}

export interface BatchCreateTransactionsResponse {
  created: Transaction[];
  count: number;
}

export interface Commitment {
  id: string;
  name: string;
  amount: string;
  currency: string;
  dueDate: string;
  status: CommitmentStatus;
  recurrence: RecurrenceFrequency;
  accountId: string | null;
  categoryId: string | null;
  paidTransactionId: string | null;
  createdAt: string;
}

export interface PayCommitmentPayload {
  accountId: string;
  paidAt?: string;
  note?: string;
}

export interface Budget {
  id: string;
  name: string;
  amount: string;
  spent: string;
  remaining: string;
  percentage: number;
  categoryId: string | null;
  categoryName: string | null;
  startDate: string;
  endDate: string;
  isArchived: boolean;
}

export interface SafeToSpendBreakdown {
  safeToSpend: string;
  currency: string;
  totalLiquidFunds: string;
  totalPendingCommitments: string;
  pendingCommitmentsCount: number;
  isDeficit: boolean;
  deficitAmount: string;
  calculatedAt: string;
}

export interface MonthlySummary {
  income: string;
  expenses: string;
  netSavings: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
}

export interface CurrencyBalanceSummary {
  currency: string;
  totalLiquidBalance: string;
  totalProtectedSavings: string;
  accountCount: number;
}

export interface DashboardSummary {
  baseCurrency: string;
  safeToSpend: SafeToSpendBreakdown;
  monthlySummary: MonthlySummary;
  totalLiquidBalance: string;
  totalProtectedSavings: string;
  excludedCurrenciesSummary: CurrencyBalanceSummary[];
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    currency: string;
    currentBalance: string;
    excludeFromSafeToSpend: boolean;
  }>;
}

export interface ApiErrorEnvelope {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  correlationId: string;
  timestamp: string;
}
```

---

## 11. Backend Capability Matrix

| Operational Capability | Backend Support | Specific Details & Endpoints |
| :--- | :--- | :--- |
| **Batch Expense Ingestion** | Full Support | `POST /api/v1/transactions/batch` accepts 1–20 items; executes atomically in a single Prisma transaction. |
| **Transaction Pagination** | Full Support | `GET /api/v1/transactions` supports `page` and `limit` (1–100, default 20), returning total pages and item count. |
| **Soft Delete / Archival** | Full Support | Accounts and Categories have `isArchived` flags. Hard delete is blocked if transactions exist. |
| **Atomic Balance Reversals** | Full Support | `DELETE /api/v1/transactions/:id` reverses account balances and restores paid commitments. |
| **Commitment Auto-Expiration** | Full Support | Querying commitments automatically marks overdue pending items as `OVERDUE`. |
| **Month-End Date Clamping** | Full Support | Paying monthly recurring commitments clamps Jan 31 $\rightarrow$ Feb 28 $\rightarrow$ Mar 31. |
| **Cross-Currency FX Conversion** | Not Supported | Transfers and commitment payments across currencies are blocked. Must use accounts of identical currency. |
| **Receipt / File Attachments** | Not Implemented | No file upload routes, S3 integration, or image fields exist in the database schema. |
| **Push Notifications / SMS** | Not Implemented | No Firebase Cloud Messaging, APNS, or Twilio integrations exist in the backend. |
| **Social / OAuth Login** | Not Implemented | Only email + Argon2id password authentication is supported. |

---

## 12. Errors, Validation, and Edge Cases

### 12.1 Standard Error Format
All errors conform to `ApiErrorEnvelope`:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "amount must be strictly greater than 0",
    "accountId must be a valid UUID"
  ],
  "path": "/api/v1/transactions",
  "correlationId": "4a737f09-b695-46aa-a477-8d070b4ba7ea",
  "timestamp": "2026-10-18T13:30:15.123Z"
}
```

### 12.2 Critical Edge Cases Handled by Backend
1. **Concurrent Duplicate Payments (`CON-01`)**:
   - If a user taps "Pay" multiple times rapidly, the backend executes an atomic conditional update (`status != PAID`). Only the first request succeeds; the second request is rejected with `400 Bad Request: "This commitment has already been marked as paid"`.
2. **Deleting an Account With Transactions**:
   - Returns `400 Bad Request`: `"Cannot permanently delete an account with recorded transactions. Please archive the account instead to preserve financial history."`
3. **Deleting a Category With Linked Records**:
   - Returns `400 Bad Request`: `"Cannot delete category with associated transactions. Please archive it instead."`
4. **Modifying / Deleting System Categories**:
   - Returns `403 Forbidden`: `"System default categories cannot be modified"` / `"System default categories cannot be deleted"`.
5. **Editing Transaction Amounts**:
   - Balance changes are calculated by delta: `delta = newAmount - oldAmount`. Updating from 100 to 150 EGP subtracts an additional 50 EGP from the account.
6. **Cross-Tenant ID Probing**:
   - Requesting an ID belonging to another user returns `404 Not Found` (never revealing whether the ID exists).

---

## 13. Confirmed Defects and Integration Risks

1. **Transaction Update Restricted Fields**:
   - `PATCH /api/v1/transactions/:id` only allows changing `amount`, `categoryId`, `transactionDate`, and `note`. It does **not** allow moving a transaction from Account A to Account B or switching its `type`. To change accounts or types, the frontend must prompt the user to delete and recreate the transaction.
2. **Strict Whitelist Rejections**:
   - The backend runs `ValidationPipe({ forbidNonWhitelisted: true })`. If the mobile app sends an extra or misspelled property in any request body (e.g. `description` instead of `note`), the server rejects the request with `400 Bad Request`.
3. **Decimal Serialization as String**:
   - Amounts from the backend arrive as formatted strings (e.g. `"250.75"`), **not** JavaScript numbers. The frontend must parse them using `parseFloat(val)` or a decimal library before performing mathematical operations.
4. **Rate Limit on Auth Routes**:
   - `POST /api/v1/auth/*` routes are throttled to 10 requests per minute. Rapid automated retries on login or token refresh will trigger `429 Too Many Requests`.

---

## 14. Missing Capabilities and Backend Dependencies

If the mobile client requires the following features in future iterations, corresponding backend work will be required:
1. **Receipt Image Upload**: Requires adding an image upload endpoint (e.g. S3/Cloudinary presigned URLs) and a `receiptUrl` column to the `transactions` table.
2. **Real-Time WebSockets**: No socket server or Server-Sent Events (SSE) exists; all data synchronization is currently pull/polling based.
3. **Automated Cron for Overdue Commitments**: Overdue statuses update dynamically upon querying the API. A standalone scheduled job (`@nestjs/schedule`) could be added if external notification triggers are desired.
4. **Multi-Currency Live FX Rates**: Required if the frontend wishes to convert foreign currency accounts into the base reporting currency on the dashboard.

---

## 15. Testing and Verification Evidence

The entire backend test suite has been executed and verified in the live local environment:

### Unit & Service Tests (`pnpm test` / `jest --runInBand`)
- **Total Test Suites**: 9 passed, 9 total
- **Total Tests**: 58 passed, 58 total
- **Suites Executed**:
  1. `src/transactions/transactions.service.spec.ts` (Atomic balances, transfer restrictions, batching)
  2. `src/config/cors.config.spec.ts` (Allowed origins, native client pass-through)
  3. `src/auth/auth.service.spec.ts` (Argon2id hashing, token rotation, replay detection)
  4. `src/health/health.controller.spec.ts` (Database connectivity checks)
  5. `src/commitments/commitments.service.spec.ts` (Recurrence rules, month-end clamping, atomic pay)
  6. `src/financial-accounts/financial-accounts.service.spec.ts` (Account lifecycle, delete protections)
  7. `src/budgets/budgets.service.spec.ts` (Date validations, spending aggregations)
  8. `src/categories/categories.service.spec.ts` (System category protections)
  9. `src/dashboard/dashboard.service.spec.ts` (Safe-to-Spend formula, deficit flags, currency groupings)

### End-to-End Tests (`test/app.e2e-spec.ts`)
- Verified full user journey:
  - Registration $\rightarrow$ Initial Cash account provisioning.
  - Creating bank accounts $\rightarrow$ Income & Expense balance updates.
  - Safe-to-Spend calculation $\implies$ Liquid funds minus pending commitments.
  - Payment of commitment $\implies$ Atomic balance deduction and commitment status transition to `PAID`.
  - Anti-double-deduction verification on dashboard.
  - Cross-user tenant isolation (User 2 cannot read or modify User 1 records).
  - Remediation verification: Concurrency lock (`CON-01`), balance refund on payment deletion (`FIN-01`), cross-currency transfer rejection (`FIN-03`).

---

## 16. Environment and Local Development Setup

### 16.1 Required Environment Variables (`.env`)
The backend validates environment variables on startup (`src/config/env.validation.ts`):

```bash
# Environment Mode
NODE_ENV=development
PORT=3000

# PostgreSQL Database Connection URL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/flowsy?schema=public"

# JWT Authentication Secrets (Must be at least 16 characters)
JWT_ACCESS_SECRET="super-secret-jwt-access-key-flowsy-2026"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_SECRET="super-secret-jwt-refresh-key-flowsy-2026"
JWT_REFRESH_EXPIRATION="7d"

# CORS Configuration
# Native mobile apps do not send Origin header and bypass CORS checks automatically.
# Web development requires explicitly listing allowed origins:
CORS_ORIGIN="http://localhost:3000,http://localhost:5173,http://localhost:8081"

# Defaults
DEFAULT_CURRENCY="EGP"
DEFAULT_TIMEZONE="Africa/Cairo"
```

### 16.2 Local Development Commands
```bash
# 1. Install dependencies
pnpm install

# 2. Run Prisma migrations
pnpm prisma:migrate:dev

# 3. Seed default system categories and demo user
pnpm prisma:seed

# 4. Start NestJS dev server with hot reload
pnpm start:dev

# 5. Run test suite
pnpm test
```

### 16.3 Pre-Seeded Development Credentials
- **Email**: `demo@flowsy.app`
- **Password**: `Password123!`
- **Seeded Data**:
  - Cash Account: `كاش / Cash` (Balance: 2,500.00 EGP)
  - Bank Account: `البنك الأهلي المصري / NBE` (Balance: 18,500.00 EGP)
  - Mobile Wallet: `فودافون كاش / Vodafone Cash` (Balance: 1,200.00 EGP)
  - Commitments: Apartment Rent (6,000.00 EGP), Home Internet (450.00 EGP)
  - Standard Arabic/English system categories for Income and Expenses.

---

## 17. Recommended Frontend Integration Order

To construct the mobile client efficiently and avoid integration friction, follow this phased execution plan:

```mermaid
flowchart TD
    Phase1["Phase 1: API Client & Auth Lifecycle<br>• Axios instance with refresh interceptor<br>• SecureStore token persistence<br>• Login & Register screens"]
    Phase2["Phase 2: Master Data & Account State<br>• Fetch categories (system + user)<br>• Fetch financial accounts<br>• Account switcher / selector store"]
    Phase3["Phase 3: Dashboard & Safe-to-Spend<br>• GET /dashboard/summary<br>• 'تقدر تصرف كام؟' hero banner<br>• Liquid vs Protected balance display"]
    Phase4["Phase 4: Transactions & Voice Ingestion<br>• Manual Add Transaction modal<br>• Voice entry parser review flow<br>• Atomic batch save (POST /transactions/batch)"]
    Phase5["Phase 5: Commitments & Budgets<br>• Upcoming obligations list<br>• 'سداد' (Pay Now) modal (:id/pay)<br>• Live budget consumption progress"]

    Phase1 --> Phase2
    Phase2 --> Phase3
    Phase3 --> Phase4
    Phase4 --> Phase5
```

1. **Phase 1: API Client & Token Management**:
   - Implement `apiClient` with token injection and automatic 401 token refresh queue.
   - Build login and signup screens with Egyptian phone/email conventions.
2. **Phase 2: Core Reference Data & Global Context**:
   - Implement Zustand / React Query hooks for `useCategories()` and `useAccounts()`.
   - Allow user to choose their default account for new expenses.
3. **Phase 3: Dashboard & Financial Overview**:
   - Bind `GET /api/v1/dashboard/summary` to the main home screen.
   - Implement visual indicators for deficit state (`isDeficit: true`).
4. **Phase 4: Transaction Recording & Voice Entry**:
   - Build manual single transaction form (`POST /api/v1/transactions`).
   - Wire voice transcription and local parser to the batch creation endpoint (`POST /api/v1/transactions/batch`).
   - Implement transaction deletion with balance refund animations.
5. **Phase 5: Commitments & Budgets**:
   - Build upcoming obligations card with quick "Pay" action (`POST /api/v1/commitments/:id/pay`).
   - Build budget progress bars utilizing `spent`, `remaining`, and `percentage`.

---

## 18. Open Questions and Unverified Assumptions

1. **Offline Sync**:
   - *Finding*: The backend has no sync protocol or version vectors for offline reconciliation.
   - *Recommendation*: The mobile app should treat the backend as the immediate source of truth. When offline, cache recent read queries using React Query or MMKV, and queue mutations only if idempotency can be guaranteed.
2. **Account Opening Balance Edits**:
   - *Finding*: `PATCH /api/v1/accounts/:id` explicitly does not accept `initialBalance` to prevent historical data corruption.
   - *Recommendation*: If a user made a mistake when setting up an account balance, the frontend should prompt them to record an adjustment transaction (`INCOME` or `EXPENSE`) with a note such as "تعديل رصيد افتتاحي".

---

## 19. File Reference Index

The following table lists every relevant backend source file examined in this audit:

| Category | File Path | Primary Function / Scope |
| :--- | :--- | :--- |
| **Bootstrap & Config** | `src/main.ts` | Server bootstrap, helmet, route prefix, Swagger, global pipes. |
| **Bootstrap & Config** | `src/app.module.ts` | Root module, middleware consumer, global rate limit guard. |
| **Bootstrap & Config** | `src/config/env.validation.ts` | Joi/Class-Validator startup environment validation. |
| **Bootstrap & Config** | `src/config/cors.config.ts` | CORS origin allowlist parser and native mobile pass-through. |
| **Common Middleware** | `src/common/middleware/correlation-id.middleware.ts` | `x-correlation-id` injection and tracking. |
| **Common Middleware** | `src/common/filters/http-exception.filter.ts` | Centralized HttpException and Prisma error normalization. |
| **Common Middleware** | `src/common/interceptors/logging.interceptor.ts` | Structured latency and request/response logging. |
| **Database** | `src/database/prisma.service.ts` | Prisma client lifecycle and connection hook. |
| **Database** | `prisma/schema.prisma` | PostgreSQL database schema, enums, indexes, and relations. |
| **Database** | `prisma/seed.ts` | Database seeder for system categories and demo user. |
| **Health** | `src/health/health.controller.ts` | `GET /api/v1/health` connectivity check. |
| **Auth** | `src/auth/auth.controller.ts` | Auth routes: register, login, refresh, logout, me. |
| **Auth** | `src/auth/auth.service.ts` | Argon2id verification, dual JWT/refresh token rotation. |
| **Auth** | `src/auth/guards/jwt-auth.guard.ts` | Passport JWT authentication guard. |
| **Auth** | `src/auth/strategies/jwt.strategy.ts` | JWT bearer extraction and user validation strategy. |
| **Auth** | `src/auth/decorators/current-user.decorator.ts` | `@CurrentUser()` parameter decorator. |
| **Auth DTOs** | `src/auth/dto/register.dto.ts` | Registration payload validation. |
| **Auth DTOs** | `src/auth/dto/login.dto.ts` | Login payload validation. |
| **Auth DTOs** | `src/auth/dto/refresh-token.dto.ts` | Token rotation payload validation. |
| **Auth DTOs** | `src/auth/dto/auth-response.dto.ts` | User profile and token pair response schemas. |
| **Users** | `src/users/users.controller.ts` | Profile endpoints (`/api/v1/users/profile`). |
| **Users** | `src/users/users.service.ts` | User retrieval and profile update operations. |
| **Accounts** | `src/financial-accounts/financial-accounts.controller.ts` | Account CRUD endpoints (`/api/v1/accounts`). |
| **Accounts** | `src/financial-accounts/financial-accounts.service.ts` | Balance formatting, unique names, deletion protections. |
| **Categories** | `src/categories/categories.controller.ts` | Category endpoints (`/api/v1/categories`). |
| **Categories** | `src/categories/categories.service.ts` | System category protection, tenant isolation, cascade guards. |
| **Transactions** | `src/transactions/transactions.controller.ts` | Transaction endpoints and batch endpoint (`/api/v1/transactions`). |
| **Transactions** | `src/transactions/transactions.service.ts` | Atomic balance mutations, reversal logic, FX checks. |
| **Commitments** | `src/commitments/commitments.controller.ts` | Commitment endpoints and pay route (`/api/v1/commitments`). |
| **Commitments** | `src/commitments/commitments.service.ts` | Dynamic overdue updates, month-end clamping, atomic pay. |
| **Budgets** | `src/budgets/budgets.controller.ts` | Budget endpoints (`/api/v1/budgets`). |
| **Budgets** | `src/budgets/budgets.service.ts` | Real-time budget consumption and progress calculation. |
| **Dashboard** | `src/dashboard/dashboard.controller.ts` | Dashboard summary route (`/api/v1/dashboard/summary`). |
| **Dashboard** | `src/dashboard/dashboard.service.ts` | Safe-to-Spend formula and monthly inflow/outflow aggregation. |
