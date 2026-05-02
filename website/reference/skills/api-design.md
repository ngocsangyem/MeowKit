---
title: "mk:api-design"
description: "REST and GraphQL API design patterns — resource naming, HTTP methods, status codes, pagination, versioning, error formats."
---

# mk:api-design

## What This Skill Does

Designs production-quality REST and GraphQL APIs following industry conventions. Produces structured endpoint specifications with consistent naming, error handling, and pagination patterns.

## When to Use

- Designing a new API from scratch
- Reviewing or standardizing an existing API
- Adding endpoints to an established API surface
- Choosing between REST and GraphQL for a specific use case
- **NOT for:** implementing endpoints (use `mk:cook`), database schema design (use `mk:database`)

## Core Capabilities

- **REST patterns:** plural nouns, kebab-case URLs, proper HTTP method semantics (GET/POST/PUT/PATCH/DELETE), status code selection, pagination (cursor-based and offset), versioning strategies, error envelope format
- **GraphQL patterns:** schema design, query/mutation/subscription structure, DataLoader for N+1 prevention, directive-based authorization, connection pagination (Relay spec)
- **Output format:** structured endpoint table with method, path, purpose, request/response shapes, error codes

## Arguments

| Flag | Effect |
|------|--------|
| `--rest` | Design REST API endpoints |
| `--graphql` | Design GraphQL schema |
| `--both` | Compare REST vs GraphQL approaches for the same domain |

## Workflow

1. **Scope** — identify resources, relationships, and operations needed
2. **Name** — apply naming conventions (plural nouns, kebab-case)
3. **Route** — define URL structure and HTTP methods
4. **Model** — design request/response shapes with types and validation
5. **Error** — apply consistent error envelope format with codes
6. **Paginate** — select pagination strategy for list endpoints
7. **Version** — apply versioning approach (URL path or header-based)
8. **Document** — produce endpoint specification table
9. **Review** — validate against conventions checklist

## Usage

```bash
/mk:api-design --rest user management endpoints
/mk:api-design --graphql e-commerce schema
/mk:api-design --both notification service
```

## Example Prompt

```
Design a REST API for a task management system with projects, tasks, and comments. Include CRUD for all resources, filtering by status/assignee, and pagination.
```

## Common Use Cases

- Greenfield API design before implementation
- API standardization across microservices
- REST-to-GraphQL migration planning
- Endpoint review for consistency

## Pro Tips

- **Always return consistent error shapes.** Use `{ error: { code, message, details } }` even for 200-level warnings.
- **Cursor-based pagination scales better than offset.** Use `before`/`after` cursors with `first`/`last` counts.
- **GraphQL DataLoader is mandatory.** Without it, every nested field triggers a separate database query (N+1 problem).

> **Canonical source:** `.claude/skills/api-design/SKILL.md`
