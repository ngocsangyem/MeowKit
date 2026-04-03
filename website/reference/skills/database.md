---
title: "meow:database"
description: "Database patterns: schema design, safe migrations, query optimization, and indexing strategy. PostgreSQL primary."
---

# meow:database

Reference-backed guidance for database schema design, safe migrations, query optimization, and indexing. PostgreSQL primary; most patterns transfer to MySQL and SQLite.

## What This Skill Does

`meow:database` provides structured guidance for the three most error-prone database tasks: designing schemas that won't need painful restructuring later, writing migrations that won't lock production tables or require rollbacks, and optimizing queries that are slow because of missing indexes or N+1 patterns.

The skill detects your database type from project markers, loads the appropriate reference file(s), applies patterns to your specific task, and validates the output against a checklist before delivering. Every response includes the SQL or migration code, a brief note on which patterns were applied, any risks flagged (missing rollback, potential table lock, N+1 risk), and suggested indexes if not already present.

Security constraint: SQL with string interpolation is never written. Parameterized queries only. See `security-rules.md`.

## Core Capabilities

- **Schema design** — Naming conventions, primary key strategy (UUID vs BIGINT serial), foreign key declarations with explicit ON DELETE rules, normalization, timestamp columns, anti-pattern detection (EAV, polymorphic FKs)
- **Migration safety** — Safe vs unsafe operations, zero-downtime migration patterns, separate data migrations from schema migrations, rollback (down) migrations always included
- **Query optimization** — EXPLAIN ANALYZE guidance, index type selection (B-tree, GIN, partial), N+1 detection and fix, cursor pagination for unbounded result sets
- **Database detection** — Identifies PostgreSQL, MySQL, SQLite, or MongoDB from project markers and adjusts syntax accordingly

## When to Use This

::: tip Use meow:database when...
- Designing a new schema or adding tables and columns
- Writing migration files (up + down)
- Optimizing a slow query or diagnosing an N+1
- Planning an indexing strategy
- Triggers: "database schema", "migration", "query optimization", "N+1", "slow query"
:::

::: warning Don't use meow:database when...
- You need ORM-specific query builder syntax — this skill works at SQL level; consult ORM docs for the translation
- The slowness is application-level (missing caching, business logic in loops) rather than database-level
:::

## Usage

```bash
# Schema design
/meow:database schema user accounts with roles and permissions

# Migration
/meow:database migration add soft delete to orders table

# Query optimization
/meow:database optimize "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at"

# Indexing strategy
/meow:database index strategy for orders and order_items tables
```

## Schema Design Patterns

Key patterns from `references/schema-design.md`:

**Naming** — Tables: `snake_case`, plural (`users`, `order_items`). Columns: `snake_case` (`created_at`, `user_id`). Junction tables: alphabetical order of the two tables (`order_tags`, not `tag_orders`).

**Primary keys** — UUID (`gen_random_uuid()`) for distributed systems or externally-visible IDs. `BIGINT GENERATED ALWAYS AS IDENTITY` (or `SERIAL`) for internal tables where sequential IDs are acceptable. Never expose sequential integer IDs in public APIs.

**Foreign keys** — Always declare explicitly with `ON DELETE` and `ON UPDATE` rules. No implicit FK behavior. `ON DELETE CASCADE` requires explicit approval in the plan — accidental cascades cause data loss. Prefer `ON DELETE RESTRICT` and handle deletion in application code.

**Timestamps** — Every table gets `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Add a trigger or ORM hook to keep `updated_at` current. Use `TIMESTAMPTZ` (timezone-aware), never `TIMESTAMP`.

**Anti-patterns to avoid** — EAV (entity-attribute-value) tables (`id, entity_id, key, value`) — they destroy query performance and type safety. Polymorphic foreign keys (`commentable_type`, `commentable_id`) — use separate junction tables instead. `SELECT *` in production queries — always name columns explicitly.

## Migration Safety

Key patterns from `references/migration-patterns.md`:

**Safe operations** (no table lock, run any time): `CREATE TABLE`, `ADD COLUMN` with a default, `CREATE INDEX CONCURRENTLY`, `ADD CONSTRAINT` (not-valid + validate separately).

**Unsafe operations** (acquire lock, require careful planning): `DROP COLUMN`, `ALTER COLUMN TYPE`, `ADD COLUMN NOT NULL` without a default, `ADD CONSTRAINT` (validated immediately). These require a zero-downtime migration pattern.

**Zero-downtime pattern for adding NOT NULL column:**
1. Migration 1: `ADD COLUMN col TYPE DEFAULT value` (nullable, with default)
2. Deploy: application writes to new column
3. Migration 2: Backfill existing rows in batches
4. Migration 3: `ALTER COLUMN col SET NOT NULL` (after all rows populated)

**Every migration must include a rollback** (`down` migration). A migration without a rollback is an incident waiting to happen. Data migrations (backfills) must be separate files from schema migrations — they run at different times and have different rollback strategies.

**Filename format**: timestamp-based, e.g., `20260403142200_add_soft_delete_to_orders.sql`. This ensures migrations run in creation order regardless of branch merge order.

## Query Optimization

Key patterns from `references/query-optimization.md`:

**EXPLAIN ANALYZE first** — Never optimize a query without reading its execution plan. `EXPLAIN (ANALYZE, BUFFERS) SELECT ...` shows actual row counts, timing, and buffer usage. Surprises live in the diff between estimated and actual rows.

**Index types** — B-tree (default) for equality and range queries. GIN for `jsonb`, arrays, and full-text search. Partial index (`WHERE deleted_at IS NULL`) to index only the rows queries actually touch. `CREATE INDEX CONCURRENTLY` in production to avoid table lock.

**N+1 detection and fix** — N+1 is fetching related records inside a loop: `orders.forEach(o => db.query('SELECT * FROM items WHERE order_id = $1', [o.id]))`. Fix: one query with `JOIN` or `WHERE order_id = ANY($1)` using the full ID array. In ORMs, use eager loading (`include`/`preload`/`with`).

**Pagination** — `LIMIT`/`OFFSET` gets slower as offset grows (the database scans and discards offset rows). Cursor pagination: `WHERE created_at < $cursor ORDER BY created_at DESC LIMIT 20`. Fast at any page depth. Use offset only when random page access is required.

**No `SELECT *` in production** — Name every column. `SELECT *` fetches columns you don't need, breaks when schema changes, and prevents index-only scans.

## Gotchas

- **DROP COLUMN without a 2-phase migration**: Dropping a column while application code still references it causes immediate errors. Phase 1: remove all code references and deploy. Phase 2: drop the column in a migration.
- **Missing indexes on foreign keys**: PostgreSQL does not automatically index foreign key columns (unlike MySQL). Every `user_id`, `order_id`, etc. column needs an explicit `CREATE INDEX`. Unindexed FKs cause sequential scans on joins.
- **N+1 in ORMs**: ORMs make N+1 invisible — the loop looks like a single `.orders` property access. Always check the query log during development. One page load generating 200 queries is N+1, not "acceptable ORM behavior".
- **OFFSET pagination at scale**: `SELECT ... OFFSET 10000 LIMIT 20` scans 10,020 rows to return 20. At large offsets, this is slower than a full table scan. Default to cursor pagination for any list that may grow large.
- **CASCADE DELETE without approval**: `ON DELETE CASCADE` in a migration that wasn't explicitly planned can silently delete thousands of rows when a parent record is removed. This is a blocked pattern per `security-rules.md` — requires explicit plan approval.

## Related

- [`meow:api-design`](/reference/skills/api-design) — API design that exposes the schema as resources
- [`meow:build-fix`](/reference/skills/build-fix) — Fixes build errors during database layer implementation
