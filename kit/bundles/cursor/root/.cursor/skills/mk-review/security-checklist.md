# Skill: Per-Platform Security Audit Checklist

**Purpose:** Provide a concrete, checkable security audit list for each supported platform. Use during code review and pre-ship validation.

## When to Use

Invoke this skill during:

- Code review (Dimension 4 of structural audit)
- Pre-ship security scan
- Any time security-sensitive code is modified (auth, payments, data access)

---

## NestJS Security Checklist

### 1. Controller Guards

- [ ] All controllers use `@UseGuards()` with appropriate guard(s)
- [ ] Public endpoints are explicitly marked (e.g., `@Public()` decorator), not accidentally unguarded
- [ ] Role-based guards are applied where needed (`@Roles('admin')`)

### 2. DTO Validation

- [ ] All DTOs have `class-validator` decorators on every field
- [ ] `ValidationPipe` is applied globally or per-endpoint
- [ ] No endpoints accept raw `body` without a DTO

### 3. SQL Injection Prevention

- [ ] No raw SQL with string interpolation (`\`SELECT \* FROM ${table}\``)
- [ ] All queries use parameterized queries or ORM methods
- [ ] Any raw query usage is justified and reviewed

### 4. Environment Variable Safety

- [ ] Environment variables accessed through `ConfigService`, not `process.env` directly
- [ ] No env vars with default values that could be insecure in production
- [ ] `.env`, `.env.local`, `.env.development`, `.env.production` or any important .env files are in `.gitignore`

### 5. Service Role Key Protection

- [ ] Supabase service role key is NOT used outside the admin module
- [ ] Service role key is never exposed to client-side code
- [ ] Anon key is used for client-facing operations

### 6. Rate Limiting

- [ ] Rate limiting is configured on all public endpoints
- [ ] Auth endpoints (login, signup, password reset) have stricter limits
- [ ] Rate limit responses include appropriate headers

---

## Vue 3 Security Checklist

### 1. XSS Prevention

- [ ] No `v-html` with user-provided content
- [ ] If `v-html` is used, content is sanitized (DOMPurify or equivalent)
- [ ] Dynamic attribute bindings are safe (no unsanitized URLs in `:href`)

### 2. Token Storage

- [ ] Auth tokens stored in httpOnly cookies or in-memory (NOT localStorage)
- [ ] Refresh token rotation is implemented
- [ ] Tokens are cleared on logout

### 3. Route Guards

- [ ] Authenticated pages have route guards (`beforeEnter` or global guard)
- [ ] Guard checks token validity, not just existence
- [ ] Unauthorized access redirects to login

### 4. Client Bundle Safety

- [ ] No API keys, secrets, or credentials in client-side code
- [ ] No server URLs that should be internal-only
- [ ] Environment variables prefixed correctly (e.g., `VITE_` for Vite)

### 5. CSP Headers

- [ ] Content Security Policy headers are configured
- [ ] `unsafe-inline` and `unsafe-eval` are avoided where possible
- [ ] Script sources are explicitly whitelisted

---

## Swift / iOS Security Checklist

### 1. Sensitive Data Storage

- [ ] Passwords, tokens, and keys stored in Keychain (NOT `UserDefaults`)
- [ ] Keychain access level is appropriate (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`)
- [ ] No sensitive data in plain text files or plist

### 2. Certificate Pinning

- [ ] Certificate pinning is enabled for API communication
- [ ] Pinning is against the public key (not the certificate itself, for rotation)
- [ ] Fallback behavior is secure (fail closed, not open)

### 3. URL Handling

- [ ] No hardcoded production URLs in source code
- [ ] URLs are configured per environment (debug/staging/production)
- [ ] Deep link handlers validate input

### 4. Biometric Authentication

- [ ] Biometric auth (Face ID/Touch ID) is used for sensitive operations
- [ ] Fallback to passcode is handled securely
- [ ] Biometric prompt context string is user-friendly

### 5. Data at Rest

- [ ] Local databases are encrypted (SQLCipher or equivalent)
- [ ] Cached data is cleared on logout
- [ ] No sensitive data in app screenshots (use `UIApplication` background snapshot protection)

---

## Supabase Security Checklist

### 1. Row Level Security (RLS)

- [ ] RLS is enabled on ALL user-facing tables
- [ ] No tables have RLS disabled unless they contain only public data
- [ ] Default deny — tables with RLS enabled but no policies deny all access

### 2. RLS Policy Testing

- [ ] Each RLS policy has a corresponding test
- [ ] Tests verify: correct user CAN access their data
- [ ] Tests verify: incorrect user CANNOT access others' data
- [ ] Tests verify: unauthenticated users are blocked

### 3. Key Usage

- [ ] Anon key is used for client-side operations
- [ ] Service role key is NEVER used client-side
- [ ] Service role key is only used in server-side admin operations

### 4. Migration Safety

- [ ] Migrations are reviewed for data loss (DROP TABLE, DROP COLUMN)
- [ ] Destructive migrations have a rollback plan
- [ ] Migration order is deterministic

### 5. Cascade Safety

- [ ] No `CASCADE DELETE` without explicit approval and documentation
- [ ] Foreign key relationships are reviewed for unintended cascading effects
- [ ] Soft delete is preferred over hard delete for user-facing data

---

## How to Use This Checklist

1. Identify which platforms the current change affects.
2. Run through EVERY item on the relevant checklist(s).
3. Mark each item as checked or flagged.
4. Any unchecked item is a FAIL for the Security dimension in the structural audit.
5. Document findings in the audit verdict file.
