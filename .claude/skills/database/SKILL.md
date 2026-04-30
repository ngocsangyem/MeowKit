---
name: mk:database
description: "Database patterns: schema design, migrations, query optimization, indexing. PostgreSQL primary. Use for 'database schema', 'migration', 'SQL optimization'."
version: 1.0.0
argument-hint: "[schema|migration|query|optimize] [description]"
source: meowkit
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Glob
---

# Database — Schema, Migrations, Query Optimization

Provides reference-backed guidance for database design tasks. PostgreSQL is the primary
target; most patterns apply to MySQL and SQLite with minor syntax differences.

## When to Use

- Designing a new schema or adding tables/columns
- Writing migration files (up + down)
- Optimizing slow queries
- Adding indexes
- Triggers: "database schema", "migration", "query optimization", "indexing", "SQL", "N+1"

## Phase Anchor

**Phase: 1 (Plan)** for schema design and migration planning
**Phase: 3 (Build)** for implementation and query writing
**Handoff:** Developer implements, reviewer validates per `references/migration-patterns.md` safety checklist

## Process

### Step 1: Identify Task Type

Determine which task is being requested:

| Task | Load Reference |
|------|---------------|
| Schema design (new tables, relationships) | `references/schema-design.md` |
| Migration (up/down, rollback, zero-downtime) | `references/migration-patterns.md` |
| Query writing or optimization | `references/query-optimization.md` |
| Multiple tasks | Load all relevant references |

### Step 2: Identify Database Type

Check the project for database markers:

| Marker | Database |
|--------|----------|
| `postgres://` or `postgresql://` in env/config | PostgreSQL |
| `mysql://` or `mysql2` package | MySQL |
| `sqlite3` package or `.sqlite` file | SQLite |
| `mongodb://` or `mongoose` | MongoDB |

If PostgreSQL or unknown → use PostgreSQL syntax (most complete).
If MySQL/SQLite → note any syntax differences in the response.
MongoDB → schema-design and query-optimization references apply conceptually; migrations differ.

### Step 3: Apply Patterns

Load the relevant reference file(s) and apply the patterns to the specific task.

Always validate the output against these checks:

**Schema checklist:**
- [ ] All tables use snake_case plural naming
- [ ] Primary key declared (UUID or BIGINT serial)
- [ ] Foreign keys declared with explicit ON DELETE/ON UPDATE rules
- [ ] `created_at` and `updated_at` timestamps present
- [ ] No EAV (entity-attribute-value) anti-pattern

**Migration checklist:**
- [ ] Both up (apply) and down (rollback) provided
- [ ] No table-locking operations in production migration (see migration-patterns.md)
- [ ] Data migrations separated from schema migrations
- [ ] Filename is timestamp-based

**Query checklist:**
- [ ] No N+1 (no queries inside loops)
- [ ] EXPLAIN ANALYZE recommended for complex queries
- [ ] Indexes proposed where needed
- [ ] No `SELECT *` in production queries
- [ ] `LIMIT` present on unbounded queries

### Step 4: Deliver

Return:
1. The SQL/migration code
2. Which patterns were applied (brief reference)
3. Any risks flagged (missing rollback, potential lock, N+1 risk)
4. Suggested indexes if not already present

## Security Constraint

NEVER write SQL with string interpolation or template literals — parameterized queries only.
See `security-rules.md` — SQL injection is a blocked pattern.

```sql
-- BLOCKED: string interpolation
WHERE id = ${userId}

-- CORRECT: parameterized
WHERE id = $1   -- PostgreSQL
WHERE id = ?    -- MySQL/SQLite
```

## Reference Files

- `references/schema-design.md` — naming, normalization, common patterns, anti-patterns
- `references/migration-patterns.md` — safe migrations, zero-downtime, rollback
- `references/query-optimization.md` — indexing, N+1, EXPLAIN, pagination

## Gotchas

- **Adding a NOT NULL column without a default locks the table on Postgres < 12** — `ALTER TABLE users ADD COLUMN verified BOOLEAN NOT NULL` acquires an exclusive lock for the full backfill; add the column as nullable first, backfill in batches, then add the NOT NULL constraint with `ALTER TABLE ... SET NOT NULL` (uses constraint scan, not rewrite, on PG 12+).
- **`CREATE INDEX` without `CONCURRENTLY` blocks all writes** — a standard index build holds `ShareLock`; on a table with high write throughput this causes queue buildup in `pg_stat_activity`; always use `CREATE INDEX CONCURRENTLY` in production, noting it cannot run inside a transaction block.
- **`CASCADE DELETE` on a foreign key silently removes child rows across migrations** — if a parent row is deleted during a data migration, all FK-cascaded children are gone with no error; audit every FK with `ON DELETE CASCADE` before batch-deleting seed or test data in production.
- **`EXPLAIN ANALYZE` executes the query; `EXPLAIN` does not** — running `EXPLAIN ANALYZE DELETE FROM ...` will delete rows; always wrap in a transaction and rollback, or use `EXPLAIN (ANALYZE, BUFFERS)` only on SELECT queries unless you understand the side effect.
- **Connection pool exhaustion shows as intermittent timeouts, not pool errors** — when all pool slots are taken, new queries wait silently until `pool_timeout` fires; the symptom looks like a slow query but `pg_stat_activity` shows dozens of `idle in transaction` connections from callers that forgot to release; always release connections in a `finally` block.
- **Transaction isolation default (`READ COMMITTED`) allows non-repeatable reads** — two SELECTs in the same transaction can return different rows if another transaction commits between them; use `REPEATABLE READ` or `SERIALIZABLE` for financial or inventory operations where consistency across reads matters.
