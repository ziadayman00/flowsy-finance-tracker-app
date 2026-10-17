# Flowsy Backend API 🚀

<p align="center">
  <img src="./logo.png" width="120" alt="Flowsy Logo" />
</p>

Production-minded backend for **Flowsy**, a mobile-first personal finance application tailored primarily for Egyptian users.

Flowsy empowers everyday users to take control of their finances without requiring accounting expertise. Its core differentiator is **"تقدر تصرف كام؟" (Safe-to-Spend)** — a reliable, real-time estimate of spendable funds that prevents overspending by factoring in upcoming commitments, recurring bills, and loan installments.

---

## 🏛️ Architecture & Core Principles

The Flowsy backend is architected as a **Modular Monolith** using **NestJS**, **PostgreSQL 17**, and **Prisma ORM**.

- **Correctness Before Convenience:** Monetary amounts use exact `Decimal(14, 2)` arithmetic (via `decimal.js`). Floating-point arithmetic is strictly banned.
- **Atomic Financial Transactions:** Account balance adjustments and transaction creation/deletion are encapsulated inside PostgreSQL ACID transactions (`prisma.$transaction`).
- **Zero Double-Counting:** Paying an obligation atomically creates an expense transaction, marks the commitment `PAID`, and excludes it from future safe-to-spend deductions.
- **Security Baseline:** Passwords hashed with **Argon2id**, JWT access tokens (15m), and long-lived rotated refresh tokens (7d) with automatic replay attack mitigation.
- **Observability:** Centralized exception filter (`AllExceptionsFilter`), request correlation IDs (`x-correlation-id`), and sanitized HTTP duration logging.

---

## 🗄️ Database Schema & Entities

The domain model contains 7 primary entities in PostgreSQL:

- `users`: Core account profile, preferred currency (`EGP`), and timezone (`Africa/Cairo`).
- `refresh_tokens`: Cryptographic tokens stored as SHA-256 hashes with session family invalidation.
- `financial_accounts`: Liquid accounts (`CASH`, `BANK`, `MOBILE_WALLET`) and protected savings (`SAVINGS`).
- `categories`: Dual-layer taxonomy: 15 system defaults (`userId: null`) + custom user categories (`userId: user.id`).
- `transactions`: Immutable financial history (`INCOME`, `EXPENSE`, `TRANSFER`).
- `commitments`: Future obligations (rent, utilities, installments) with recurrence engines (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`).
- `budgets`: Discretionary category limits with real-time spend progress aggregation.

---

## 🚀 Quickstart & Setup

### Prerequisites
- **Node.js:** v20.x LTS or higher
- **Package Manager:** `pnpm` (recommended) or `npm`
- **Database:** PostgreSQL 17

### 1. Clone & Install Dependencies
```bash
# Install dependencies using pnpm
pnpm install

# Or using npm
npm install
```

### 2. Environment Configuration
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` matches your PostgreSQL credentials:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/flowsy?schema=public"
JWT_ACCESS_SECRET="flowsy_super_secret_access_jwt_key_min_32_chars!"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_SECRET="flowsy_super_secret_refresh_jwt_key_min_32_chars!"
JWT_REFRESH_EXPIRATION="7d"
CORS_ORIGIN="*"
DEFAULT_CURRENCY="EGP"
DEFAULT_TIMEZONE="Africa/Cairo"
```

### 3. Database Migrations & Seeding
```bash
# Apply migrations to the database
pnpm run prisma:migrate:deploy

# Seed initial system categories and demo user
pnpm run prisma:seed
```

Demo user credentials:
- **Email:** `demo@flowsy.app`
- **Password:** `Password123!`

### 4. Run Application
```bash
# Development mode with hot-reload
pnpm run start:dev

# Production build & run
pnpm run build
pnpm run start:prod
```
The server will start at `http://localhost:3000/api/v1`.
Interactive Swagger API documentation is available at: `http://localhost:3000/api/docs`.

---

## 🧪 Testing Suite

The codebase has complete unit test and end-to-end integration test coverage:

```bash
# Run all unit tests (Health, Auth, Accounts, Categories, Transactions, Commitments, Budgets, Dashboard)
pnpm run test

# Run End-to-End integration tests against real PostgreSQL database
pnpm run test:e2e

# Run test coverage report
pnpm run test:cov
```

---

## 📡 API Endpoints Overview

All endpoints are versioned under `/api/v1`. Private endpoints require `Authorization: Bearer <accessToken>`.

### Authentication (`/api/v1/auth`)
- `POST /register` — Register new user and auto-create initial Cash account.
- `POST /login` — Authenticate credentials with Argon2id and issue rotated tokens.
- `POST /refresh` — Rotate refresh token and issue new token pair.
- `POST /logout` — Revoke active refresh token / session.
- `GET /me` — Retrieve authenticated user profile.

### Accounts (`/api/v1/accounts`)
- `GET /` — List active accounts (`includeArchived=true` query supported).
- `POST /` — Create account (`CASH`, `BANK`, `SAVINGS`, `MOBILE_WALLET`).
- `GET /:id` — Get account details.
- `PATCH /:id` — Update name, type, or archive status.
- `DELETE /:id` — Delete unused account (accounts with transactions must be archived).

### Categories (`/api/v1/categories`)
- `GET /` — List system defaults and user custom categories.
- `POST /` — Create custom category.
- `PATCH /:id` — Update custom category (system categories are immutable).
- `DELETE /:id` — Delete unused custom category.

### Transactions (`/api/v1/transactions`)
- `GET /` — Filterable and paginated transaction history (`type`, `accountId`, `categoryId`, `startDate`, `endDate`).
- `POST /` — Record `INCOME`, `EXPENSE`, or `TRANSFER` with atomic balance updates.
- `GET /:id` — Get transaction details.
- `PATCH /:id` — Update transaction note, date, or amount with atomic balance delta adjustments.
- `DELETE /:id` — Delete transaction with atomic financial balance reversal.

### Commitments (`/api/v1/commitments`)
- `GET /` — List commitments (`status` filter supported).
- `POST /` — Create upcoming commitment with optional recurrence.
- `GET /:id` — Get commitment details.
- `PATCH /:id` — Update commitment details.
- `DELETE /:id` — Delete commitment.
- `POST /:id/pay` — **Pay commitment workflow**: atomically logs expense, decrements account balance, marks status `PAID`, and schedules the next recurrence.

### Budgets (`/api/v1/budgets`)
- `GET /` — List budgets with live spent amounts and progress percentage.
- `POST /` — Create budget for a category and date range.
- `GET /:id` — Get budget details and progress.
- `PATCH /:id` — Update budget.
- `DELETE /:id` — Delete budget.

### Dashboard (`/api/v1/dashboard`)
- `GET /summary` — Retrieve consolidated dashboard:
  - **Safe-to-Spend ("تقدر تصرف كام؟")**
  - Total liquid funds vs. protected savings
  - Outstanding pending/overdue commitments
  - Deficit indicators (`isDeficit`, `deficitAmount`)
  - Monthly inflow vs. outflow (`income`, `expenses`, `netSavings`)

---

## 🐳 Docker Deployment

For environments with Docker and Docker Compose installed:
```bash
docker compose up -d --build
```
This spins up PostgreSQL 17 with an automated health check and builds the production Node 20 runner container.

---

## 📋 Architectural Decisions (ADRs)

Detailed records of engineering choices are documented in `docs/decisions/`:
- `001-modular-monolith-architecture.md`
- `002-postgresql-and-prisma.md`
- `003-monetary-representation.md`
- `004-authentication-and-token-lifecycle.md`
- `005-transaction-lifecycle-and-reversal.md`
- `006-safe-to-spend-calculation.md`
- `007-currency-and-timezone-policy.md`
