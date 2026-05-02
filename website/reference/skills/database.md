---
title: "mk:database"
description: "Database patterns — schema design, migrations, query optimization, indexing. PostgreSQL primary; patterns apply to MySQL and SQLite."
---

# mk:database

Reference-backed guidance for database tasks. PostgreSQL is the primary target; most patterns apply to MySQL and SQLite with minor syntax differences.

## When to use

- Designing schema or adding tables/columns
- Writing migration files (up + down)
- Optimizing slow queries or adding indexes
- Triggers: "database schema", "migration", "query optimization", "SQL", "N+1"

## Process

1. **Identify task type** — schema design, migration, or query optimization. Load the corresponding reference.
2. **Identify database type** — check project for markers (PostgreSQL, MySQL, SQLite, etc.)
3. **Apply patterns** — implement using patterns from the relevant reference
4. **Verify** — test migrations both directions, verify query performance

## References (loaded on-demand)

| Reference | When | Content |
|---|---|---|
| `schema-design.md` | New tables, relationships | Normalization, constraints, naming conventions, enums vs lookup tables |
| `migration-patterns.md` | Writing migrations | Up/down, zero-downtime, rollback strategies, safety checks |
| `query-optimization.md` | Slow queries, N+1 | Index selection, EXPLAIN analysis, batching, caching strategies |

## Phase anchor

Phase 1 (Plan) for schema design and migration planning. Phase 3 (Build) for implementation and query writing.
