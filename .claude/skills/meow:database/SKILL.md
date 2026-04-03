---
name: meow:database
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

## When to Activate

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
