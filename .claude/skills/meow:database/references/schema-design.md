# Schema Design Reference

Patterns for designing relational database schemas. PostgreSQL primary; most rules apply to MySQL and SQLite.

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Table names | snake_case, plural | `users`, `order_items`, `audit_logs` |
| Column names | snake_case | `created_at`, `user_id`, `first_name` |
| Join/pivot tables | singular, alphabetical order | `user_role`, `product_tag` |
| Indexes | `idx_{table}_{columns}` | `idx_users_email`, `idx_orders_created_at` |
| Foreign keys | `fk_{table}_{referenced_table}` | `fk_orders_users` |
| Primary keys | always `id` | `id UUID` or `id BIGSERIAL` |

## Primary Keys

**UUID (preferred for distributed systems):**
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

**BIGSERIAL (preferred for single-node, high-insert tables):**
```sql
id BIGSERIAL PRIMARY KEY
```

**When to use UUID:** Cross-service references, public-facing IDs, sharded databases.
**When to use BIGSERIAL:** Internal tables, high-insert workloads, when join performance is critical.
**Never use:** Composite primary keys as the main PK (use a surrogate `id` + unique constraint on the natural key).

## Standard Columns (Include on Every Table)

```sql
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

For audit trails (who made the change):
```sql
created_by  UUID REFERENCES users(id),
updated_by  UUID REFERENCES users(id)
```

For soft delete (never physically remove rows):
```sql
deleted_at  TIMESTAMPTZ  -- NULL = active, NOT NULL = deleted
```

## Foreign Keys

ALWAYS declare foreign keys explicitly. NEVER rely on application-level enforcement alone.

```sql
-- Declare with explicit cascade behavior
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
category_id UUID REFERENCES categories(id) ON DELETE SET NULL
```

**Cascade rules:**
- `ON DELETE CASCADE` — delete child when parent deleted (use carefully — requires plan approval per security-rules.md)
- `ON DELETE SET NULL` — set FK to NULL (column must be nullable)
- `ON DELETE RESTRICT` — block parent delete if children exist (safest default)
- `ON DELETE NO ACTION` — same as RESTRICT, checked at end of transaction

## Normalization

**Default: 3NF (Third Normal Form)**
- Every non-key column depends on the whole primary key, nothing else
- No repeating groups, no transitive dependencies

**When to denormalize:**
- Measured performance problem with documented query analysis
- Read-heavy reporting tables (materialized views preferred over denorm)
- Cache tables explicitly labeled as `*_cache` or `*_snapshot`

NEVER denormalize speculatively (YAGNI).

## Common Patterns

### Polymorphic Relationships (with discriminator)
```sql
-- Table for multiple resource types
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body        TEXT NOT NULL,
  resource_type VARCHAR(50) NOT NULL,  -- 'post', 'video', 'product'
  resource_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_comments_resource ON comments(resource_type, resource_id);
```

### Enum Columns
```sql
-- PostgreSQL enum type
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
-- Or use VARCHAR with CHECK constraint (easier to alter)
status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'))
```

### Tags / Many-to-Many
```sql
CREATE TABLE product_tag (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
```

## Anti-Patterns

| Anti-Pattern | Problem | Alternative |
|-------------|---------|-------------|
| EAV (entity-attribute-value) | Impossible to query efficiently, no type safety | Proper columns or JSONB for truly dynamic attributes |
| Polymorphic FK without discriminator | Cannot enforce FK constraints | Add `resource_type` column + partial indexes |
| Storing CSV in a column | Cannot query individual values | Normalize to a junction table |
| `NOT NULL DEFAULT ''` on strings | Empty string is not NULL — causes subtle bugs | Use `NULL` for absence of value |
| `updated_at` managed in application | Inconsistent when bulk updates happen | Use DB trigger or `DEFAULT NOW()` + trigger |
