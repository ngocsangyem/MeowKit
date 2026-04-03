# Query Optimization Reference

Patterns for writing efficient queries and diagnosing slow ones. PostgreSQL primary.

## First: Measure Before Optimizing

ALWAYS run `EXPLAIN ANALYZE` before and after any optimization.
Never assume a query is slow — measure it.

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT u.*, o.total
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.created_at > NOW() - INTERVAL '30 days';
```

Key metrics to read:
- `Seq Scan` on large tables → missing index
- `cost=X..Y` — estimated cost; `actual time=X..Y` — real time
- `rows=X` estimate vs `actual rows=Y` — large gap means stale statistics (`ANALYZE` the table)
- `Buffers: hit=X read=Y` — high `read` means disk I/O (cold cache or missing index)

## Indexing Strategy

### B-tree (default) — use for:
- Equality: `WHERE id = $1`
- Range: `WHERE created_at BETWEEN $1 AND $2`
- Sorting: `ORDER BY created_at DESC`
- Prefix matching: `WHERE name LIKE 'prefix%'` (not `'%suffix'`)

```sql
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);
CREATE INDEX CONCURRENTLY idx_orders_created_at ON orders(created_at DESC);
```

### Composite index — use for frequent multi-column queries:
```sql
-- Query: WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY idx_orders_user_status_created
  ON orders(user_id, status, created_at DESC);
-- Column order matters: equality columns first, range/sort columns last
```

### Partial index — use when querying a subset:
```sql
-- Only index active users (deleted_at IS NULL)
CREATE INDEX CONCURRENTLY idx_users_email_active
  ON users(email)
  WHERE deleted_at IS NULL;
```

### GIN index — use for arrays, JSONB, full-text search:
```sql
-- JSONB containment queries
CREATE INDEX CONCURRENTLY idx_products_metadata ON products USING GIN(metadata);

-- Full-text search
CREATE INDEX CONCURRENTLY idx_posts_search ON posts USING GIN(to_tsvector('english', body));
```

### When NOT to index:
- Low-cardinality columns (boolean, small enums) — table scan is often faster
- Write-heavy tables — indexes slow down INSERT/UPDATE/DELETE
- Columns never used in WHERE, JOIN, or ORDER BY

## N+1 Prevention

N+1 is querying in a loop — the most common performance killer.

```typescript
// BAD: N+1 — 1 query for users + N queries for orders
const users = await db.query('SELECT * FROM users');
for (const user of users) {
  user.orders = await db.query('SELECT * FROM orders WHERE user_id = $1', [user.id]);
}

// GOOD: JOIN in one query
const result = await db.query(`
  SELECT u.*, json_agg(o.*) AS orders
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  GROUP BY u.id
`);
```

Or use subquery:
```sql
SELECT u.*,
  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
FROM users u;
```

## Pagination

### Offset pagination (simple, but slow on large tables):
```sql
-- Scans all skipped rows — O(offset) cost
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 10000;
```

### Cursor-based pagination (preferred for large tables):
```sql
-- Only reads rows after the cursor — O(1) regardless of page depth
SELECT * FROM orders
WHERE created_at < $1  -- cursor: last seen created_at
ORDER BY created_at DESC
LIMIT 20;
```

Use cursor pagination for any table expected to grow beyond ~10k rows.

## Common Query Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| `SELECT *` | Fetches unused columns, breaks column-order assumptions | Select only needed columns |
| No `LIMIT` on list queries | Full table scan with unbounded result | Add `LIMIT` and document if intentional |
| Function on indexed column | `WHERE LOWER(email) = $1` bypasses index | Use functional index or store lowercase |
| `OR` across different columns | Cannot use composite index efficiently | Consider `UNION ALL` of two indexed queries |
| `NOT IN (subquery)` | Slow and NULL-unsafe | Use `NOT EXISTS` or `LEFT JOIN ... WHERE IS NULL` |
| Implicit type cast | `WHERE id = '123'` when id is INT | Match types exactly to use index |

## Connection Pooling

ALWAYS use a connection pool. Never open a new connection per request.

- **Application-level:** PgBouncer (transaction mode for serverless, session mode for stateful)
- **Library-level:** `pg-pool` (Node.js), SQLAlchemy pool (Python), database/sql (Go)
- **Pool sizing rule of thumb:** `pool_size = (num_cores * 2) + effective_spindle_count`

Signs of pool exhaustion: `too many clients`, `connection refused`, long queue wait times.

## Statistics and Cache

```sql
-- Update planner statistics (run if EXPLAIN estimates are far off)
ANALYZE users;
ANALYZE orders;

-- Check table/index cache hit rate (should be >99% for hot tables)
SELECT relname, heap_blks_hit::float / NULLIF(heap_blks_hit + heap_blks_read, 0) AS cache_ratio
FROM pg_statio_user_tables
ORDER BY heap_blks_read DESC;
```
