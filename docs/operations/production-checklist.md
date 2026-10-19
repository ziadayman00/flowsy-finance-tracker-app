# Flowsy — Production Deployment Checklist

> Complete every item before serving real user traffic.  
> Items marked `[DONE]` were verified or implemented during the Massive Version build.

---

## Environment & Secrets

- [DONE] `NODE_ENV=production` set in the deployment environment.
- [DONE] `DATABASE_URL` set in secrets manager (never in source code).
- [DONE] `JWT_ACCESS_SECRET` ≥ 32 random bytes — generated with `openssl rand -hex 32`.
- [DONE] `JWT_REFRESH_SECRET` ≥ 32 random bytes — different from access secret.
- [DONE] `JWT_ACCESS_EXPIRATION=15m` (short-lived).
- [DONE] `JWT_REFRESH_EXPIRATION=7d`.
- [DONE] `CORS_ORIGIN` set to the exact production mobile app origin (no wildcard `*` in production).
- [ ] `EXCHANGE_RATE_API_KEY` — add when a real provider is chosen.
- [ ] Push notification credentials (FCM service account JSON) — add when provider chosen.
- [ ] `PORT` set if the default 3000 conflicts.

---

## Database

- [DONE] PostgreSQL 15+ provisioned with SSL enforced.
- [DONE] Application DB user has `CONNECT`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` only — no `DROP`, `CREATE TABLE`, `SUPERUSER`.
- [DONE] All migrations applied: `pnpm prisma migrate deploy`.
- [DONE] Schema indexes verified:
  - `users(email)` — unique index for login.
  - `refresh_tokens(tokenHash)` — unique, used on every refresh.
  - `financial_accounts(userId, isArchived)` — account list query.
  - `transactions(userId, transactionDate)`, `(userId, accountId)`, `(userId, categoryId)`, `(accountId, transactionDate)`.
  - `commitments(userId, status, dueDate)`, `(paidTransactionId)`, `(userId, currency, status)`.
  - `budgets(userId, startDate, endDate)`.
  - `savings_goals(userId, isArchived)`, `(accountId)`.
- [ ] Connection pool configured (`DATABASE_URL` connection pool params or PgBouncer).
- [ ] Backup job running (see `docs/operations/backup-and-recovery.md`).
- [ ] Read replica provisioned if read load warrants it.

---

## Security

- [DONE] `helmet()` enabled — sets CSP, X-Frame-Options, X-Content-Type-Options, HSTS.
- [DONE] CORS — validated explicit allowlist, no wildcard `*` in production.
- [DONE] `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` — strips unknown fields.
- [DONE] Auth throttle — 5 req/min on `/auth/login`, `/auth/register`; 10/min on `/auth/refresh`.
- [DONE] Global throttle — 100 req/min per IP on all other endpoints.
- [DONE] JWT access tokens expire in 15 minutes.
- [DONE] Refresh token rotation — old token revoked on each refresh.
- [DONE] Passwords hashed with bcrypt (cost factor ≥ 12) — verify in `auth.service.ts`.
- [ ] HTTPS only — terminate TLS at load balancer / reverse proxy. Redirect HTTP → HTTPS.
- [ ] Enable `Strict-Transport-Security` header at the load balancer level (HSTS preloading).
- [ ] Rate limiting by user ID (not just IP) for authenticated endpoints — add if abuse is observed.
- [ ] Review Swagger docs exposure: consider disabling `SwaggerModule.setup` in production or protecting it behind HTTP Basic Auth.

---

## Observability

- [DONE] Structured logging via NestJS `Logger` — correlationId included in every request log.
- [DONE] `AllExceptionsFilter` — catches all unhandled errors, logs with stack trace, returns safe error response (no stack trace to clients).
- [DONE] `LoggingInterceptor` — logs request method, path, status, and duration.
- [DONE] `CorrelationIdMiddleware` — injects `X-Correlation-ID` header on every request.
- [DONE] `/api/v1/health` endpoint for uptime checks.
- [ ] Centralised log aggregation (e.g. CloudWatch, Datadog, Loki) — configure the logger transport.
- [ ] APM / distributed tracing (e.g. Datadog APM, OpenTelemetry) — instrument if response time SLAs require it.
- [ ] Alerts on 5xx error rate > 1% for 5 minutes.
- [ ] Alerts on p99 response time > 2s.
- [ ] Alerts if backup job fails.

---

## API & Documentation

- [DONE] `/api/v1` prefix on all routes.
- [DONE] Swagger docs at `/api/docs` — all endpoints documented with request/response schemas.
- [ ] Consider disabling Swagger in production (or gating behind Basic Auth):
  ```typescript
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api/docs', app, document);
  }
  ```
- [ ] API versioning strategy documented for future breaking changes.

---

## GDPR / Privacy

- [DONE] `GET /api/v1/users/me/export` — data portability export (password hash excluded).
- [DONE] `DELETE /api/v1/users/me` — right to erasure, cascading delete in a single transaction.
- [ ] Privacy policy published and linked from the app.
- [ ] Backup retention policy communicated to users (backups may retain data after account deletion until they expire).
- [ ] Data Processing Agreement (DPA) in place with cloud provider.
- [ ] Cookie/tracking policy (if a web dashboard is ever added).

---

## Load & Performance

- [ ] Load test with realistic concurrency (e.g. k6, Locust) before launch.
- [ ] Confirm response times under load:
  - `GET /transactions` < 200ms p95.
  - `GET /dashboard` < 300ms p95.
  - `POST /import/preview` (500 rows) < 1s p95.
- [ ] Connection pool tuning — verify `DATABASE_URL` pool max is below Postgres `max_connections`.
- [ ] Import session store: document that horizontal scaling requires Redis (see ADR-010).

---

## Deployment

- [ ] Docker image builds cleanly: `docker build -t flowsy-backend .`.
- [ ] Container runs as non-root user.
- [ ] Health check configured in `docker-compose.yml` / Kubernetes `livenessProbe`.
- [ ] Graceful shutdown: `app.enableShutdownHooks()` is set — verify in-flight requests complete before process exits.
- [ ] Zero-downtime deployment strategy (rolling update / blue-green).
- [ ] Rollback plan documented and tested.

---

## Pre-Launch Sign-off

| Area | Owner | Status |
|---|---|---|
| Security review | Engineering | ☐ |
| Backup test restore | DevOps | ☐ |
| Load test | Engineering | ☐ |
| GDPR review | Legal/DPO | ☐ |
| Mobile app integration test | Mobile team | ☐ |
| Go / no-go decision | Product + Engineering | ☐ |
