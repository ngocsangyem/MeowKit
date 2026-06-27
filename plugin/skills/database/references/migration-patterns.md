# Migration Patterns Reference

Safe migration practices for production databases. PostgreSQL primary; principles apply broadly.

## Contents

- [File Naming](#file-naming)
- [Structure: Always Up + Down](#structure-always-up-down)
- [Safe vs Unsafe Operations](#safe-vs-unsafe-operations)
  - [Safe (no table lock, online):](#safe-no-table-lock-online)
  - [Unsafe (locks table — requires maintenance window or 2-phase approach):](#unsafe-locks-table-requires-maintenance-window-or-2-phase-approach)
- [Zero-Downtime Patterns](#zero-downtime-patterns)
  - [Add column (safe in PostgreSQL 11+)](#add-column-safe-in-postgresql-11)
  - [Drop column (2-phase approach)](#drop-column-2-phase-approach)
  - [Rename column (3-phase approach)](#rename-column-3-phase-approach)
  - [Add non-null column](#add-non-null-column)
  - [Create index without locking](#create-index-without-locking)
- [Data Migrations](#data-migrations)
  - [Batched data migration pattern](#batched-data-migration-pattern)
- [Testing Migrations](#testing-migrations)
- [Anti-Patterns](#anti-patterns)


## File Naming

ALWAYS use timestamp-based names. NEVER reorder or renumber migrations after creation.

```
20240115_143000_add_users_table.sql
20240116_091500_add_email_index_to_users.sql
```

Framework conventions:
- Sequelize: `YYYYMMDDHHMMSS-description.js`
- Flyway: `V20240115143000__description.sql`
- Alembic: `{revision_id}_description.py`
- Prisma: auto-generated timestamp

## Structure: Always Up + Down

EVERY migration must have a rollback path.

```sql
-- up.sql
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- down.sql
ALTER TABLE users DROP COLUMN phone;
```

If a rollback is genuinely destructive (data loss), document it explicitly:
```sql
-- down.sql
-- WARNING: This rollback drops the phone column and all data in it.
-- Ensure data is backed up before rolling back.
ALTER TABLE users DROP COLUMN phone;
```

## Safe vs Unsafe Operations

### Safe (no table lock, online):
- `ADD COLUMN` with nullable or default value
- `CREATE INDEX CONCURRENTLY` (PostgreSQL)
- `ADD CONSTRAINT` (check constraint on new column)
- `DROP INDEX CONCURRENTLY`

### Unsafe (locks table — requires maintenance window or 2-phase approach):
- `DROP COLUMN`
- `ALTER COLUMN` type change
- `ADD COLUMN NOT NULL` without default (locks in older PostgreSQL < 11)
- `ADD CONSTRAINT FOREIGN KEY` (without `NOT VALID` trick)
- `RENAME TABLE` or `RENAME COLUMN`

## Zero-Downtime Patterns

### Add column (safe in PostgreSQL 11+)
```sql
-- Single migration, no lock
ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL;
```

### Drop column (2-phase approach)
**Phase 1:** Stop reading/writing the column in application code. Deploy.
**Phase 2 (separate migration):** Drop the column.
```sql
-- Phase 2 migration (after code is deployed and verified)
ALTER TABLE users DROP COLUMN phone;
```

### Rename column (3-phase approach)
**Phase 1:** Add new column, backfill, write to both.
**Phase 2:** Stop reading old column. Deploy.
**Phase 3:** Drop old column.

### Add non-null column
```sql
-- Step 1: Add nullable
ALTER TABLE users ADD COLUMN status VARCHAR(20);
-- Step 2: Backfill in batches (see batching below)
UPDATE users SET status = 'active' WHERE status IS NULL;
-- Step 3: Add NOT NULL constraint (after backfill complete)
ALTER TABLE users ALTER COLUMN status SET NOT NULL;
```

### Create index without locking
```sql
-- PostgreSQL: CONCURRENTLY avoids full table lock
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
-- Note: cannot run inside a transaction block
```

## Data Migrations

NEVER mix data migrations with schema migrations in the same file.
WHY: Schema migrations run at deploy time; data migrations may need to run on large tables with
batching, progress tracking, and retry logic.

```sql
-- BAD: schema + data in one migration
ALTER TABLE orders ADD COLUMN total_cents INTEGER;
UPDATE orders SET total_cents = total * 100;  -- full table scan, lock risk

-- GOOD: separate files
-- 20240115_add_total_cents_to_orders.sql  <- schema only
-- 20240116_backfill_total_cents.sql       <- data only, with batching
```

### Batched data migration pattern
```sql
-- Process 1000 rows at a time to avoid long locks
DO $$
DECLARE
  batch_size INT := 1000;
  processed  INT := 0;
BEGIN
  LOOP
    UPDATE orders
    SET total_cents = total * 100
    WHERE total_cents IS NULL
    LIMIT batch_size;

    GET DIAGNOSTICS processed = ROW_COUNT;
    EXIT WHEN processed = 0;
    PERFORM pg_sleep(0.01);  -- brief pause between batches
  END LOOP;
END $$;
```

## Testing Migrations

Before deploying to production:
1. Run migration on a production-sized dataset (staging with prod data snapshot)
2. Measure duration — anything over 1 second on large tables needs zero-downtime approach
3. Verify rollback works: run down migration, verify schema matches pre-migration state
4. Check `EXPLAIN ANALYZE` on queries that touch the migrated table

## Anti-Patterns

| Anti-Pattern | Risk | Fix |
|-------------|------|-----|
| `DROP TABLE` without backup | Permanent data loss | Backup first, soft-delete pattern, or explicit human approval |
| `UPDATE` without `WHERE` | Full table modification | Always add `WHERE` or document intentional full-table update |
| Schema + data in one migration | Lock risk on large tables | Separate files, batch data migration |
| Reordering migration files | Breaks migration history | Timestamp names, never reorder |
| Migration in a transaction with DDL | PostgreSQL DDL is transactional — OK, but `CONCURRENTLY` cannot be in a txn | Use `CONCURRENTLY` outside transactions |