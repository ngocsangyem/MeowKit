# REST API Patterns

Conventions for building consistent, semantically correct REST APIs.

---

## Resource Naming

- Use **plural nouns** for collections: `/users`, `/orders`, `/products`
- Use **kebab-case** for multi-word resources: `/order-items`, `/payment-methods`
- Use **nested resources** for relationships (max one level deep):
  - `/users/{id}/orders` — orders belonging to a user
  - `/orders/{id}/items` — items in an order
- **Never use verbs** in paths — use HTTP method to express action:
  - Wrong: `POST /createUser`, `GET /getOrders`
  - Right: `POST /users`, `GET /orders`
- For actions that don't map to CRUD, use a sub-resource noun:
  - `POST /orders/{id}/cancellation` — cancel an order
  - `POST /users/{id}/password-reset` — trigger password reset

---

## HTTP Methods

| Method | Semantics | Idempotent | Body |
|--------|-----------|------------|------|
| GET | Read resource(s) | Yes | No |
| POST | Create new resource | No | Yes |
| PUT | Full replace (all fields) | Yes | Yes |
| PATCH | Partial update (changed fields only) | No | Yes |
| DELETE | Remove resource | Yes | No |

**PUT vs PATCH:** PUT requires the full resource body and replaces it entirely.
PATCH accepts only changed fields. Prefer PATCH for updates — PUT forces clients to fetch first.

---

## Status Codes

| Code | Name | When to use |
|------|------|-------------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST that creates a resource. Include `Location` header with new resource URL |
| 204 | No Content | Successful DELETE or action with no response body |
| 400 | Bad Request | Client sent malformed or invalid data |
| 401 | Unauthorized | Authentication required or token invalid/expired |
| 403 | Forbidden | Authenticated but not authorized for this resource |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | State conflict — duplicate create, version mismatch, concurrent edit |
| 422 | Unprocessable Entity | Request is well-formed but fails business validation |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server failure |

**400 vs 422:** Use 400 for malformed requests (missing required field, wrong type).
Use 422 for valid requests that fail business rules (username already taken, insufficient balance).

---

## Pagination

**Prefer cursor-based pagination** over offset. Offset breaks when records are inserted or deleted between pages.

### Cursor-Based (preferred)

```json
GET /orders?limit=20&after=cursor_abc123

{
  "data": [...],
  "pagination": {
    "next_cursor": "cursor_def456",
    "has_more": true,
    "limit": 20
  }
}
```

Cursor is an opaque string (base64-encoded ID + timestamp). Never expose raw DB IDs as cursors.

### Offset-Based (acceptable for static datasets)

```json
GET /orders?page=2&per_page=20

{
  "data": [...],
  "pagination": {
    "page": 2,
    "per_page": 20,
    "total": 157,
    "total_pages": 8
  }
}
```

---

## Filtering and Sorting

Use query parameters for filtering and sorting:

```
GET /orders?status=pending&sort=-created_at&customer_id=123
```

- Filter keys match field names: `?status=active`, `?customer_id=123`
- Sort prefix: `-` for descending, no prefix for ascending: `sort=-created_at,name`
- Date ranges: `?created_after=2024-01-01&created_before=2024-12-31`

---

## Versioning

**Option A — URL prefix (recommended for most APIs):**
```
/v1/users
/v2/users
```
Explicit, easy to route, easy to deprecate. Use this unless the team has a strong reason not to.

**Option B — Accept header:**
```
Accept: application/vnd.api+json;version=2
```
Cleaner URLs but harder to test in browser and requires middleware parsing.

**Versioning rules:**
- Increment version only on breaking changes (removed fields, changed semantics)
- Additive changes (new optional fields, new endpoints) do NOT require a version bump
- Maintain previous version for minimum 6 months after deprecation notice
- Add `Deprecation` and `Sunset` headers to deprecated endpoints

---

## Rate Limiting

Return these headers on every response:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1704067200
Retry-After: 60
```

- `X-RateLimit-Limit` — max requests per window
- `X-RateLimit-Remaining` — requests left in current window
- `X-RateLimit-Reset` — Unix timestamp when window resets
- `Retry-After` — seconds until client can retry (include on 429 responses only)

---

## Error Format

Use a consistent error envelope across ALL endpoints:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "code": "INVALID_FORMAT",
        "message": "Must be a valid email address"
      },
      {
        "field": "age",
        "code": "OUT_OF_RANGE",
        "message": "Must be between 18 and 120"
      }
    ],
    "request_id": "req_abc123"
  }
}
```

- `code` — machine-readable error code (SCREAMING_SNAKE_CASE)
- `message` — human-readable description (safe to display to users)
- `details` — array of field-level errors (for validation failures)
- `request_id` — correlation ID for support/debugging (always include)

**Never expose:** stack traces, internal DB errors, file paths, or server details in error responses.
