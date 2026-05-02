---
title: "mk:database"
description: "Database patterns — schema design, safe migrations, query optimization, and indexing. PostgreSQL primary; patterns apply to MySQL and SQLite."
---

# mk:database — Database Toolkit

## What This Skill Does

Provides reference-backed guidance for the full database development lifecycle: schema design with naming conventions and normalization, zero-downtime migrations with rollback paths, and query optimization with indexing and N+1 prevention. PostgreSQL is the primary target; most patterns apply to MySQL and SQLite with minor syntax differences.

## When to Use

- Designing a new schema or adding tables/columns
- Writing migration files (up + down with rollback)
- Optimizing slow queries or adding indexes
- **Triggers:** "database schema", "migration", "query optimization", "indexing", "SQL", "N+1"

## Arguments

`[schema|migration|query|optimize] [description]`

Example: `mk:database schema user profiles with avatar support`

## Example Prompt

```
Design a schema for a multi-tenant blogging platform with users, posts, comments, and tags. Create migration files with up and down rollbacks for adding a `published_at` timestamp column. Optimize the post listing query — it currently runs an N+1 on the comments count.
```

## Core Capabilities

### Schema Design (`references/schema-design.md`)

**Naming:** Tables: snake_case, plural (`users`, `order_items`). Columns: snake_case (`created_at`, `user_id`). Join tables: singular, alphabetical (`user_role`). Indexes: `idx_{table}_{columns}`. Foreign keys: `fk_{table}_{referenced_table}`.

**Primary keys:** UUID (`gen_random_uuid()`) for distributed systems, cross-service refs, public IDs. BIGSERIAL for single-node, high-insert, internal tables. Never composite PKs as main PK.

**Standard columns on every table:** `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Optionally: `created_by`, `updated_by` (audit), `deleted_at` (soft delete).

**Foreign keys:** Always declared explicitly with cascade behavior (`ON DELETE CASCADE / SET NULL / RESTRICT / NO ACTION`). `RESTRICT` is safest default.

**Normalization:** Default 3NF. Only denormalize with measured performance problem and documented query analysis. Never denormalize speculatively (YAGNI).

**Schema checklist:**
- [ ] All tables use snake_case plural naming
- [ ] Primary key declared (UUID or BIGSERIAL)
- [ ] Foreign keys with explicit ON DELETE/ON UPDATE rules
- [ ] `created_at` and `updated_at` timestamps present
- [ ] No EAV (entity-attribute-value) anti-pattern

### Safe Migrations (`references/migration-patterns.md`)

Every migration must have **up + down** (apply + rollback). If destructive, document with WARNING.

**Safe operations (no table lock):** `ADD COLUMN` nullable, `CREATE INDEX CONCURRENTLY`, `ADD CONSTRAINT` on new column, `DROP INDEX CONCURRENTLY`.

**Unsafe (requires 2-phase):** `DROP COLUMN` (stop reading in app, deploy, then drop), `RENAME COLUMN` (add new + backfill + stop reading old + drop old), `ADD COLUMN NOT NULL` (add nullable, backfill batches, then SET NOT NULL).

**Critical rule:** Never mix schema and data migrations in one file. Schema runs at deploy; data may need batching and retry.

**Migration checklist:**
- [ ] Both up (apply) and down (rollback) provided
- [ ] No table-locking operations in production migration
- [ ] Data migrations separated from schema migrations
- [ ] Filename is timestamp-based

### Query Optimization (`references/query-optimization.md`)

**Always measure first:** Run `EXPLAIN (ANALYZE, BUFFERS)` before and after optimization.

**Indexing:** B-tree for equality/range/sort/prefix. Composite for multi-column (equality first, range/sort last). Partial for subsets (`WHERE deleted_at IS NULL`). GIN for arrays/JSONB/full-text. Don't index: low-cardinality columns, write-heavy tables, unused columns.

**N+1 prevention:** Never query inside a loop. Use JOINs, subqueries, or batch loading.

**Pagination:** Cursor-based for tables >10k rows. Offset pagination scans all skipped rows.

**Query checklist:**
- [ ] No N+1 (no queries inside loops)
- [ ] EXPLAIN ANALYZE recommended for complex queries
- [ ] Indexes proposed where needed
- [ ] No `SELECT *` in production queries
- [ ] `LIMIT` present on unbounded queries

## Security Constraint

**NEVER write SQL with string interpolation or template literals. Parameterized queries only.**
