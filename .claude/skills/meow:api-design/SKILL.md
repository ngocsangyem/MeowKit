---
name: meow:api-design
description: "REST/GraphQL API design: resource naming, HTTP methods, status codes, pagination, versioning, error formats. Use for 'design API', 'endpoint patterns'."
version: 1.0.0
argument-hint: "[api description] [--rest | --graphql | --both]"
source: meowkit
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
---

# API Design

REST and GraphQL design patterns for building consistent, developer-friendly APIs.

## When to Activate

Activate when:
- Designing a new API or set of endpoints
- Reviewing existing endpoint structure for consistency
- User asks "design this API", "REST patterns", "how should I structure endpoints"
- Backend architecture planning phase

## Phase Anchor

**Phase: 1 (Plan)** — Produces an API design document before implementation begins.
**Handoff:** Developer agent implements the endpoints per the design document.

## Process

1. **Identify API type** — REST, GraphQL, or both. Default to REST unless user specifies otherwise.
2. **Load patterns** — Load `references/rest-patterns.md` for REST; `references/graphql-patterns.md` for GraphQL.
3. **Map resources** — Identify domain entities and their relationships.
4. **Design endpoints** — Apply naming, HTTP semantics, and status code conventions.
5. **Define error format** — Establish consistent error response structure.
6. **Plan pagination** — Choose cursor-based (preferred) or offset-based with justification.
7. **Specify versioning strategy** — URL prefix or Accept header.
8. **Document rate limiting** — Headers and throttle thresholds.
9. **Output design document** — Endpoint table + request/response examples.

## References

| File | Purpose |
|------|---------|
| `references/rest-patterns.md` | Resource naming, HTTP methods, status codes, pagination, versioning, rate limiting, error format |
| `references/graphql-patterns.md` | Schema design, queries, mutations, error handling, pagination, N+1 prevention, auth |

## Output Format

Produce an API design document with:

```
## API Design: [Domain Name]

### Resources
[Table of resources and their relationships]

### Endpoints
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET    | /v1/users | List users | Required |
| POST   | /v1/users | Create user | Required |
| ...

### Request/Response Examples
[One example per non-trivial endpoint]

### Error Format
[Standard error response structure]

### Pagination
[Strategy chosen and example response]

### Versioning
[Strategy and current version]

### Rate Limiting
[Limits and headers]
```

## Gotchas

- Resource names must be plural nouns — never verbs (`/users` not `/getUsers`)
- Nested resources only one level deep — `/users/{id}/orders` is fine; `/users/{id}/orders/{id}/items/{id}` is too deep (flatten to `/order-items`)
- Status codes must be semantically correct — 200 for updates is wrong, use 200 (full replace) or 204 (no content)
- Cursor pagination is strongly preferred over offset — offset breaks when records are inserted between pages
- Error format must be consistent across ALL endpoints — agree on structure before implementation begins
- GraphQL N+1 is mandatory to address upfront — retrofit DataLoader after the fact is painful
