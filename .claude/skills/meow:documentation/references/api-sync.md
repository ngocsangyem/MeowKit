# Skill: API Documentation Sync

**Purpose:** Keep API documentation synchronized with the NestJS controller implementations by scanning decorators and generating/updating documentation automatically.

## When to Use

Invoke this skill when:
- A new API endpoint is added
- An existing endpoint's signature changes (parameters, body, response)
- Guards or rate limiting are added/removed from an endpoint
- During the living-docs update step of the ship pipeline

---

## Steps

### Step 1: Scan NestJS Controllers

For each controller file, extract the following from decorators:

**Route Information:**
- `@Controller('path')` — base path
- `@Get('path')`, `@Post('path')`, `@Put('path')`, `@Patch('path')`, `@Delete('path')` — endpoint method and sub-path

**Parameter Information:**
- `@Param('name')` — URL parameters
- `@Query('name')` — query string parameters
- `@Body()` — request body (reference the DTO class)
- `@Headers('name')` — required headers

**Response Information:**
- Return type of the handler method
- `@HttpCode(status)` — custom status code
- Response DTO if different from return type

**Auth/Security:**
- `@UseGuards(GuardName)` — which guards are applied
- `@Public()` — if the endpoint is public
- `@Roles('role')` — required roles

**Rate Limiting:**
- `@Throttle()` or equivalent rate limit decorators

### Step 2: Extract DTO Schemas

For each DTO referenced in endpoints:

1. Read the DTO class file.
2. Extract field names, types, and validation decorators.
3. Map to a schema:

```
CreateFeatureDto:
  - name: string (required, non-empty)
  - description: string (optional, max 500 chars)
  - priority: number (optional, min 0, max 10)
```

### Step 3: Generate/Update API Documentation

For each endpoint, produce a documentation entry:

```markdown
### POST /api/features

**Description:** Create a new feature.

**Auth Required:** Yes (Bearer token)
**Required Role:** admin
**Rate Limit:** 10 requests/minute

**Parameters:**
| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| — | — | — | — | — |

**Request Body:** `CreateFeatureDto`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| name | string | Yes | Non-empty |
| description | string | No | Max 500 chars |
| priority | number | No | 0-10 |

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "priority": 0,
  "createdAt": "ISO-8601"
}
```

**Error Responses:**
| Status | Description |
|--------|-------------|
| 400 | Validation failed |
| 401 | Unauthorized |
| 403 | Forbidden (insufficient role) |
| 429 | Rate limit exceeded |
```

### Step 4: Diff Against Existing Docs

1. If API docs already exist, compare the generated documentation with the existing one.
2. Identify: new endpoints, removed endpoints, changed endpoints.
3. Update only the changed sections (following living-docs principles).
4. Flag removed endpoints with a deprecation notice rather than deleting immediately.

### Step 5: Organize Documentation

Structure the API documentation by module/resource:

```
docs/api/
  index.md          # Overview, base URL, auth info
  features.md       # /api/features endpoints
  users.md          # /api/users endpoints
  auth.md           # /api/auth endpoints
```

---

## Validation Checklist

- [ ] Every controller endpoint has a corresponding doc entry
- [ ] Every DTO field is documented with type and validation rules
- [ ] Auth requirements are documented for every endpoint
- [ ] Rate limits are documented where configured
- [ ] Response schemas match actual return types
- [ ] Error responses are listed
- [ ] No orphaned doc entries for removed endpoints (mark as deprecated instead)

## Anti-Patterns

- **Manual-only docs** — docs should be generated from code, not written from memory
- **Outdated examples** — response examples must match current DTOs
- **Missing error docs** — always document what can go wrong, not just the happy path
