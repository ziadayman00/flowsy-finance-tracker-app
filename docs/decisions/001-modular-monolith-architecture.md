# 1. Architecture: Modular Monolith

## Status
Accepted

## Context
Flowsy is a mobile-first personal finance application targeted primarily at Egyptian users. The backend needs to provide financial account management, transaction logging (income/expense/transfer), commitments, budgets, and a real-time safe-to-spend ("تقدر تصرف كام؟") calculation.

The application requires high financial correctness, atomic multi-step database transactions, rapid development velocity, clear boundaries, and low operational overhead.

## Decision
We adopt a **Modular Monolith** architecture built on NestJS and TypeScript.

Key architectural boundaries:
- Each domain capability is organized into a cohesive NestJS module (`auth`, `users`, `financial-accounts`, `categories`, `transactions`, `commitments`, `budgets`, `dashboard`, `health`).
- Business logic is concentrated in domain services; controllers strictly handle HTTP contracts, validation, status codes, and authorization.
- Persistence is handled via Prisma ORM using explicit domain repositories or focused service methods with explicit transaction management (`$transaction`).
- Cross-cutting concerns (logging, correlation IDs, exception filters, DTO validation pipes, JWT guards) live in `common/`.
- No distributed microservices, message brokers (Kafka/RabbitMQ), or distributed caches (Redis) in this stage.

## Alternatives Considered
1. **Microservices Architecture:**
   - *Rejected:* High operational and deployment complexity, distributed data consistency challenges (loss of single-database ACID guarantees required for balance calculations), and unnecessary latency overhead for Flowsy's scale.
2. **Layered "Hexagonal/Clean Architecture" with universal abstract interfaces for every service and repository:**
   - *Rejected:* Excess boilerplate that obscures straightforward business rules without providing tangible benefits for a focused modular monolith with Prisma.

## Consequences & Evolution Path
- **Benefits:** Single deployable unit, straightforward local developer experience, local ACID transactions across accounts/transactions/commitments, strict module encapsulation via NestJS module exports/imports.
- **Trade-off:** Requires discipline to prevent circular module dependencies or unauthorized direct cross-domain writes.
- **Future Evolution:** If a particular domain requires independent scaling or background processing in the future (e.g., scheduled notification engine for commitments), that module can be decoupled into a worker or service with minimal friction.
