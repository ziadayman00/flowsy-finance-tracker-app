# Flowsy — Backup & Recovery Runbook

> This document describes the backup strategy, verification procedures, and
> recovery steps for the Flowsy backend PostgreSQL database.  
> **Review and test these procedures before going live.**

---

## 1. Backup Strategy

### 1.1 PostgreSQL logical backups (`pg_dump`)

| Frequency | Retention | Target |
|---|---|---|
| Daily (02:00 UTC) | 30 days | Object storage (e.g. S3-compatible bucket) |
| Weekly (Sun 03:00 UTC) | 12 weeks | Same bucket, separate prefix |
| Monthly (1st of month) | 12 months | Same bucket, `cold/` prefix |

**Command**:
```bash
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  "$DATABASE_URL" \
  --file="flowsy-$(date -u +%Y%m%d-%H%M%S).dump"
```

Upload to object storage immediately after creation. Delete the local copy.

### 1.2 WAL archiving / Point-in-Time Recovery (PITR)

If using a managed Postgres service (AWS RDS, Supabase, Render, Neon):
- Enable automated backups with at least 7-day retention.
- Enable WAL archiving for PITR to any point within the retention window.

For self-hosted Postgres:
- Configure `wal_level = replica` and `archive_mode = on`.
- Ship WAL segments to the same object storage bucket under a `wal/` prefix.
- Use `pgBackRest` or `wal-g` to manage WAL shipping and PITR.

### 1.3 Backup encryption

All backup files must be encrypted at rest:
- Object storage: enable server-side encryption (AES-256 minimum).
- If exporting backup files outside the cloud account: encrypt with GPG before transfer.
  ```bash
  gpg --symmetric --cipher-algo AES256 flowsy-backup.dump
  ```

---

## 2. Backup Verification

**Backups that have never been tested are not backups.**

Test restore monthly in a separate environment:

```bash
# 1. Spin up a clean Postgres instance (Docker or a dev DB)
docker run -d --name flowsy-restore-test \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_DB=flowsy_restore \
  -p 5433:5432 postgres:16

# 2. Restore the backup
pg_restore \
  --host=localhost --port=5433 \
  --username=postgres --dbname=flowsy_restore \
  --no-owner --no-acl \
  flowsy-backup.dump

# 3. Run sanity checks
psql -h localhost -p 5433 -U postgres -d flowsy_restore -c "SELECT COUNT(*) FROM users;"
psql -h localhost -p 5433 -U postgres -d flowsy_restore -c "SELECT COUNT(*) FROM transactions;"
psql -h localhost -p 5433 -U postgres -d flowsy_restore -c "SELECT MAX(created_at) FROM transactions;"

# 4. Run Prisma migrations to verify schema is current
DATABASE_URL="postgresql://postgres:testpass@localhost:5433/flowsy_restore" \
  pnpm prisma migrate status

# 5. Clean up
docker stop flowsy-restore-test && docker rm flowsy-restore-test
```

---

## 3. Recovery Procedures

### 3.1 Full restore (data loss scenario)

> Estimated RTO: 30–90 minutes depending on database size and network.

```bash
# 1. Stop the application (prevent new writes during restore)
# Bring down the NestJS process / stop the container / scale to 0 replicas.

# 2. Create a new empty database
createdb -h $PG_HOST -U $PG_USER flowsy_production_restored

# 3. Restore from the most recent daily backup
pg_restore \
  --host=$PG_HOST --username=$PG_USER \
  --dbname=flowsy_production_restored \
  --no-owner --no-acl \
  flowsy-YYYYMMDD-HHMMSS.dump

# 4. Apply any Prisma migrations that ran after the backup
DATABASE_URL="postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST/flowsy_production_restored" \
  pnpm prisma migrate deploy

# 5. Point the application at the restored database
# Update DATABASE_URL in the environment / secrets manager.

# 6. Run smoke tests
curl https://api.flowsy.app/api/v1/health

# 7. Restore application traffic
```

### 3.2 Point-in-time recovery (PITR)

> Use when you need to recover to a specific moment before a bad event.

```bash
# With pgBackRest:
pgbackrest --stanza=flowsy \
  --type=time \
  --target="2026-10-19 14:30:00 UTC" \
  restore

# With wal-g:
wal-g backup-fetch $PGDATA LATEST
wal-g wal-fetch ...
# Then use recovery.conf / postgresql.conf recovery_target_time
```

Refer to your WAL archiving tool's documentation for exact steps.

### 3.3 Single-table restore (accidental delete)

```bash
# 1. Restore a full backup to a temporary database (see 3.1)
# 2. Export only the affected table from the temporary database
pg_dump \
  --table=transactions \
  --data-only \
  --format=plain \
  "$TEMP_DATABASE_URL" \
  > transactions-recovery.sql

# 3. Review the SQL before applying it to production
# 4. Apply with appropriate WHERE clauses to avoid overwriting good data
psql "$DATABASE_URL" < transactions-recovery.sql
```

---

## 4. Backup Checklist (pre-launch)

- [ ] Daily backup job configured and tested end-to-end.
- [ ] Backup files landing in object storage — verified by listing the bucket.
- [ ] Object storage versioning and lifecycle rules configured (auto-delete old backups).
- [ ] Backup encryption enabled at rest.
- [ ] Test restore completed successfully at least once.
- [ ] On-call engineer knows how to run a restore.
- [ ] Recovery time objective (RTO) and recovery point objective (RPO) documented and accepted by the business.
- [ ] Alert configured if daily backup job fails (e.g. PagerDuty, Slack).

---

## 5. GDPR Data Deletion

When a user exercises the right to erasure (`DELETE /api/v1/users/me`):
- All user data is deleted atomically within a Prisma transaction (see `UsersService.deleteAccount`).
- Backup copies of that user's data will persist until the backup retention window expires.
- If a user requests immediate erasure from backups, a full restore + selective deletion procedure (section 3.3) must be performed. Document this process in your privacy policy as applicable under your jurisdiction.
