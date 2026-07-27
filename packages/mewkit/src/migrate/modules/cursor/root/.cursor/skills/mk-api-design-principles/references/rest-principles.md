# REST Contract Principles

HTTP-specific detail for an HTTP-shaped contract. Everything here is a default that yields
to the contract already shipped by the repository. Compatibility, deprecation, and the
consumer-proof rule live in `SKILL.md` and apply to every style.

## Contents

- [Discover before naming](#discover-before-naming)
- [Resource naming](#resource-naming)
- [Method semantics](#method-semantics)
- [Status semantics](#status-semantics)
- [Pagination](#pagination)
- [Filtering and sorting](#filtering-and-sorting)
- [Error envelope](#error-envelope)
- [What not to prescribe](#what-not-to-prescribe)

## Discover before naming

Read the existing endpoints, the error envelope, the pagination shape, and the contract
tests first. A new endpoint that disagrees with its neighbours is a defect even when it
follows every rule below.

## Resource naming

- Collections read as nouns. Plural is the common default; keep whatever the API already uses.
- Multi-word segments use one casing convention consistently — pick the one already present.
- Express the action with the method, not the path. `POST /users` rather than `POST /createUser`.
- A non-CRUD action that has no natural method is modelled as a sub-resource noun
  (`POST /orders/{id}/cancellation`), not as a verb segment.
- Nest one level to express ownership (`/users/{id}/orders`). Flatten when the child is
  independently addressable.

## Method semantics

| Method | Semantics | Idempotent | Body |
|---|---|---|---|
| GET | Read | Yes | No |
| POST | Create or non-idempotent action | No | Yes |
| PUT | Full replace | Yes | Yes |
| PATCH | Partial update | No | Yes |
| DELETE | Remove | Yes | No |

PUT replaces the whole representation; PATCH sends only what changed. Choose per operation —
an API that already standardised on one does not need the other introduced.

Idempotency matters when a client may retry a non-idempotent operation. Add an idempotency
mechanism when retries are real (payments, external callbacks), not on every POST.

## Status semantics

| Code | Use for |
|---|---|
| 200 | Successful read or update returning a body |
| 201 | Created a resource; identify the new resource in the response |
| 204 | Success with no body |
| 400 | Malformed or structurally invalid request |
| 401 | Authentication missing or invalid |
| 403 | Authenticated but not permitted |
| 404 | Resource absent — also the correct answer when existence itself is privileged |
| 409 | State conflict: duplicate create, version mismatch, concurrent edit |
| 422 | Well-formed request that fails a business rule |
| 429 | Client exceeded a limit the API actually enforces |
| 5xx | Server-side failure the client cannot correct |

400 vs 422 is a contract decision, not a universal law: some APIs use 400 for both. Match
the discovered convention and apply it uniformly.

Changing the status returned for an existing case is a breaking change.

## Pagination

Two shapes, chosen from the collection's behavior:

- **Cursor** — large, ordered, concurrently written collections. Pages stay stable while
  rows are inserted or deleted. The cursor is opaque to the client.
- **Offset** — small, bounded, or administrative collections where page numbers are part of
  the user-facing model.

State the parameter names, the response envelope, and whether a total count is available.
A total count on a large table is a query cost — confirm it with `mk:database` before
promising it. Do not invent a default or maximum page size; read it from the repository.

## Filtering and sorting

Query parameters carry filters and sort order. Keep filter keys aligned with the field names
already exposed by the contract, and document which fields are filterable — an undocumented
filter surface becomes an accidental contract.

## Error envelope

One envelope for the whole contract. A typical shape carries a machine-readable code, a
human-readable message safe to display, optional field-level detail for validation failures,
and a correlation identifier.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "email", "code": "INVALID_FORMAT", "message": "Must be a valid email address" }],
    "request_id": "req_abc123"
  }
}
```

Adopt the discovered envelope if one exists. Never expose a stack trace, driver error, file
path, or internal host detail in an error body.

## What not to prescribe

Do not state any of the following as a universal requirement. Each is a project decision
that must come from the repository or the user:

- A versioning mechanism, or that versioning is needed at all.
- A rate limit, its headers, or a retry-after value.
- A CORS policy, cache-control policy, or health-check path.
- A specification-document format, or that one must exist.
- A hypermedia style.
- A default page size or maximum page size.
