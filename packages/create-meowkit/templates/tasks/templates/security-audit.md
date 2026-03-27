---
title: "Security Audit: [SCOPE]"
type: security-audit
status: draft
phase: 1
priority: high
effort: large
created: YYYY-MM-DD
branch: audit/kebab-scope
agent: security
---

# Security Audit: [SCOPE]

<!-- Agent fills: Security agent owns this file. All findings go in the Findings table. -->

## Goal

<!-- One sentence. What attack surface or property is being verified? -->
[After this audit, we have confirmed that SCOPE is protected against THREAT CLASS with no open SEVERITY findings.]

## Threat Model

- **Assets at risk:** [e.g., user credentials, payment data, session tokens]
- **Likely attackers:** [e.g., authenticated users, unauthenticated external, insider]
- **Attack vectors in scope:** [e.g., SQL injection, XSS, IDOR, broken auth]
- **Out of scope threats:** [e.g., physical access, supply chain — note why excluded]

## Audit Scope

<!-- Explicit file paths. No ambiguous "the auth system" — list actual files. -->

Files to audit:
- `src/[file-1]`
- `src/[file-2]`
- `src/[module]/`

Excluded (document reason):
- `src/[excluded-file]` — [reason, e.g., no user input reaches this module]

## Security Checklist

### Input Validation
- [ ] All user inputs validated before use
- [ ] No direct SQL string interpolation — parameterized queries only
- [ ] File upload paths sanitized (no path traversal)
- [ ] Request body size limits enforced

### Authentication & Authorization
- [ ] All protected routes have auth guards
- [ ] JWT secrets not hardcoded — loaded from env
- [ ] Tokens stored in httpOnly cookies, not localStorage
- [ ] Role checks enforced server-side, not client-side only

### Data Exposure
- [ ] No sensitive fields in API responses (passwords, full card numbers)
- [ ] Row Level Security enabled on all user-scoped tables (Supabase/PostgreSQL)
- [ ] Error messages do not leak stack traces or internal paths to clients

### Secrets & Config
- [ ] No API keys, tokens, or passwords in source code
- [ ] No secrets in git history (check with `git log -S "keyword"`)
- [ ] `.env` in `.gitignore`

### Platform-Specific (check applicable)
- [ ] **Node/TS:** No `process.env` direct access outside ConfigService
- [ ] **Vue:** No `v-html` with user content
- [ ] **Swift:** Keychain for secrets, not UserDefaults; cert validation enabled
- [ ] **PostgreSQL:** CASCADE DELETE requires explicit plan approval

## Findings

<!-- Agent fills: Add a row for every finding. No findings = one row marked "none". -->

| # | Severity | Finding | File | Line | Status |
|---|----------|---------|------|------|--------|
| 1 | BLOCK / WARN / INFO | [Description] | `src/file.ts` | 42 | open |

**Severity definitions:**
- **BLOCK** — Must fix before Gate 2. Active vulnerability or direct security rule violation.
- **WARN** — Should fix. Risk present but mitigated or low-probability.
- **INFO** — Observation. No immediate risk. Log for future hardening.

## Remediation Plan

<!-- Agent fills: One entry per BLOCK finding. WARN findings may be batched. -->

### Finding #[N] — [Short description]

- **Root cause:** [Why this vulnerability exists]
- **Fix:** [Specific code change needed]
- **Verify:** [How to confirm fix is complete]
- **Owner:** [agent or team responsible]

## Acceptance Criteria

- [ ] Zero BLOCK findings remain open
- [ ] All WARN findings acknowledged by human (each explicitly accepted or scheduled)
- [ ] All INFO findings logged in `.claude/memory/security-log.md`
- [ ] Security checklist fully completed (every item checked)
- [ ] Re-audit of fixed BLOCK items passes

## Related

- Security rules: `.claude/rules/security-rules.md`
- Security log: `.claude/memory/security-log.md`
- Injection rules: `.claude/rules/injection-rules.md`

## Agent State

<!-- Agent fills after every significant action. Keep current. -->
Current phase: 1 — Planning
Last action: Audit task file created
Next action: Begin checklist pass on scoped files, populate Findings table
Blockers: none
Decisions made: none yet
