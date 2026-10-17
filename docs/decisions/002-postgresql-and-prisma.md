# 2. Database & Persistence: PostgreSQL and Prisma ORM

## Status
Accepted

## Context
Flowsy requires strict relational integrity (foreign keys, cascading rules, unique ownership constraints), atomic financial operations, high-precision numeric storage for money, and automated schema migrations tracked in version control.

## Decision
We select **PostgreSQL** as the primary relational database and **Prisma ORM** as the data modeling, client, and migration engine.

Key principles:
- **Relational Integrity:** Foreign key constraints enforce user ownership across all financial accounts, categories, transactions, commitments, and budgets.
- **Migration Strategy:** Database changes are managed via `prisma migrate dev` (generating SQL migration scripts in `prisma/migrations/`) committed to Git. Production environments apply migrations using `prisma migrate deploy`.
- **Indexing:** Explicit composite indexes on `[userId, createdAt]`, `[userId, transactionDate]`, `[userId, accountId]`, and unique compound constraints on entity names/ownership prevent duplicate entries and optimize dashboard queries.
- **Transactions:** Complex financial operations (such as transfers or paying a commitment) utilize Prisma interactive transactions (`prisma.$transaction(async (tx) => ...)`) to guarantee all-or-nothing execution.

## Alternatives Considered
1. **TypeORM:**
   - *Rejected:* More cumbersome migration generation, less reliable type safety than Prisma's generated client, and historically higher risk of subtle runtime bugs in complex relation cascades.
2. **Raw SQL / Knex / Kysely:**
   - *Rejected:* Higher development overhead for standard CRUD and relational operations, though excellent for performance. Prisma offers sufficient performance and superior developer velocity with full TypeScript schema synchronization.

## Consequences & Evolution Path
- **Benefits:** Type-safe database queries synchronized directly from `schema.prisma`, automatic migration script generation, built-in Decimal support.
- **Trade-off:** Prisma client binary footprint and slight overhead on very complex joins.
- **Evolution:** For any future high-throughput analytic queries, Prisma raw queries (`prisma.$queryRaw`) can be utilized without changing ORMs.
