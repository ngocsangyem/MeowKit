---
title: "mk:api-design"
description: "REST/GraphQL API design patterns: resource naming, HTTP methods, status codes, pagination, versioning, rate limiting, and error formats."
---

# mk:api-design

Reference-backed API design guidance for building consistent, developer-friendly REST and GraphQL APIs.

## What This Skill Does

`mk:api-design` provides structured design guidance before implementation begins. API shape decisions — resource naming, status codes, pagination strategy, versioning — are cheap to change in a design document and expensive to change after clients exist. This skill front-loads those decisions.

It identifies your API type (REST, GraphQL, or both), maps domain entities to resources, applies naming and HTTP semantics conventions from reference files, and produces a design document that the developer agent uses as the authoritative spec during implementation. The design document includes an endpoint table, request/response examples, error format, pagination strategy, versioning approach, and rate limiting headers.

## Core Capabilities

- **REST patterns** — Resource naming, HTTP method semantics, status code correctness, cursor pagination, URL versioning, rate limiting headers, consistent error format
- **GraphQL patterns** — Schema design, query/mutation structure, error unions, Relay-style cursor pagination, DataLoader for N+1 prevention, auth directives
- **Resource mapping** — Identifies domain entities and their relationships before endpoint design
- **Error format standardization** — Establishes a consistent error response structure across all endpoints before the first line of implementation
- **Pagination strategy selection** — Cursor-based (preferred) or offset-based with explicit justification

## When to Use This

::: tip Use mk:api-design when...
- Designing a new API or adding a significant set of endpoints
- Reviewing existing endpoint structure for consistency problems
- Planning backend architecture before implementation starts
- Answering "how should I structure this endpoint?"
:::

::: warning Don't use mk:api-design when...
- You're adding a single endpoint to a well-established existing API — follow its conventions instead
- Implementation has already started — the design document is a Phase 1 artifact
:::

## Usage

```bash
# REST API design for a domain
/mk:api-design user management system

# GraphQL API design
/mk:api-design e-commerce catalog --graphql

# Design both REST and GraphQL surfaces
/mk:api-design order processing --both

# Review existing endpoint structure
/mk:api-design review src/routes/
```

## REST Patterns

Key patterns from `references/rest-patterns.md`:

**Resource naming** — Plural nouns only. `/users`, `/orders`, `/order-items`. Never verbs (`/getUsers`, `/createOrder`). Nested resources one level maximum: `/users/{id}/orders` is fine; `/users/{id}/orders/{id}/items` is too deep — flatten to `/order-items?orderId={id}`.

**HTTP methods** — `GET` reads, `POST` creates, `PUT` full replace, `PATCH` partial update, `DELETE` removes. Method semantics must match the operation — do not use `POST` for updates.

**Status codes** — `200` for successful reads and full updates, `201` for creation (include `Location` header), `204` for deletes with no response body, `400` for client validation errors, `401` for missing auth, `403` for insufficient permissions, `404` for not found, `409` for conflicts, `422` for semantic validation errors, `429` for rate limit exceeded.

**Pagination** — Cursor-based is the default. Offset breaks when records are inserted between pages. Use `?cursor=<token>&limit=20`; return `nextCursor` in the response. Offset (`?page=N&perPage=20`) only when the client needs random page access with justification.

**Versioning** — URL prefix: `/v1/users`. Increment major version on breaking changes. Never remove a version without a deprecation period.

**Rate limiting** — Return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers on all responses. Return `429` when exceeded.

**Error format** — Consistent structure across ALL endpoints:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

## GraphQL Patterns

Key patterns from `references/graphql-patterns.md`:

**Schema design** — Types use PascalCase, fields use camelCase. Every type has an `id: ID!` field. Nullable vs non-null is a contract — think before making a field required.

**Queries and mutations** — Queries are read-only (no side effects). Mutations return the mutated type, not just a success flag. Mutation names are verb-first: `createUser`, `updateOrder`, `deleteItem`.

**Error handling** — Use error union types over throwing GraphQL errors for expected failures: `union CreateUserResult = User | ValidationError | DuplicateEmailError`. Reserve GraphQL-level errors for unexpected failures.

**Pagination** — Relay cursor pagination: `edges { node { ... } cursor }` + `pageInfo { hasNextPage endCursor }`. Consistent across all list fields.

**N+1 prevention** — DataLoader is mandatory, not optional. Every field resolver that fetches related data must batch via DataLoader. Retrofit is painful — design this in from the start.

**Auth directives** — Use `@auth` directives on the schema rather than per-resolver guards. Centralized, auditable.

## Gotchas

- **POST vs PUT confusion**: `POST /users` creates a new user (server assigns ID). `PUT /users/{id}` fully replaces. Using `POST` for updates is a common mistake that breaks HTTP caching and idempotency semantics.
- **200 vs 201 on creation**: Returning `200` for a `POST` that created a resource is incorrect. Use `201` and include a `Location: /v1/users/{newId}` header.
- **Offset pagination at scale**: Offset queries get slower as the offset grows (`OFFSET 10000` on a large table scans 10,000 rows to discard them). Default to cursor pagination; only use offset with explicit justification.
- **GraphQL N+1**: Fetching `users { orders { ... } }` without DataLoader fires one query per user. This must be addressed at design time — retrofitting DataLoader after resolvers are written is painful.
- **Inconsistent error format**: Agreeing on the error structure after 10 endpoints are built means refactoring all of them. Define the error format first, before writing the first endpoint.

## Related

- [`mk:plan-creator`](/reference/skills/plan-creator) — Creates the plan that the API design document feeds into
- [`mk:database`](/reference/skills/database) — Schema design that backs the API resources
- [`mk:build-fix`](/reference/skills/build-fix) — Fixes build errors during API implementation
