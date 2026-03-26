---
title: security
description: "Security audit specialist that issues BLOCK verdicts to halt the pipeline for critical vulnerabilities."
---

# security

Security audit specialist that issues BLOCK verdicts to halt the pipeline for critical vulnerabilities.

## Overview

The security agent is the only agent that can halt the entire pipeline. It runs at Phase 2 (pre-implementation audit on plan/architecture) and Phase 4 (pre-ship audit on implementation). It auto-activates on any change touching auth, payments, user data, or API endpoints. Its BLOCK verdict cannot be overridden by other agents — only the security agent can clear it after re-audit.

## Quick Reference

### Quality & Review

| Finding severity | Action |
|-----------------|--------|
| **CRITICAL** | Pipeline halts (BLOCK verdict). Must remediate and re-audit. |
| **HIGH** | Must fix before shipping. |
| **MEDIUM** | Should fix. |
| **LOW** | Advisory only. |

### Platform-Specific Rules

| Platform | Key checks |
|----------|-----------|
| **NestJS** | Auth guards on all endpoints, class-validator for input, parameterized queries, rate limiting |
| **Vue** | No `v-html` with user input (XSS), CSRF tokens, no localStorage for auth tokens |
| **Swift** | Keychain for credentials, certificate pinning, biometric auth, ATS compliance |
| **Supabase** | RLS on all tables, service key never on client, secure edge functions |

### Auto-Activation Triggers

The security agent automatically inserts itself when changes touch: authentication, payments, user data, API endpoints, encryption, or credential management.

## How to Use

```bash
# Usually auto-activated by orchestrator
# For explicit security audit:
/meow:audit                # full security audit
/meow:cso                  # CSO-mode deep audit
/meow:cso comprehensive    # comprehensive scan
```

## Under the Hood

### Handoff Example

**BLOCK scenario:**
```
Security (Phase 4 audit):
  CRITICAL: Hardcoded API key found in src/config.ts:42
  CRITICAL: SQL query uses string interpolation in src/api/users.ts:18
  Verdict: BLOCK

  → Pipeline halted
  → Developer must remediate both CRITICAL findings
  → Security re-audits after fixes
  → Only security agent can clear the BLOCK
```

**PASS scenario:**
```
Security (Phase 4 audit):
  MEDIUM: Consider rate limiting on /api/auth/login
  LOW: Missing CORS origin restriction (development only)
  Verdict: PASS (no CRITICAL findings)

  → Pipeline continues to reviewer
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| BLOCK verdict on seemingly safe code | Pattern match may be catching test fixtures | Security agent should distinguish test vs production code |
| Auto-activation on non-security change | File touches auth-adjacent code | Accept — security errs on the side of caution |
| BLOCK can't be cleared | Only security agent can clear after re-audit | Fix findings, then request re-audit |
| Missing platform rules | Project uses unlisted framework | Security falls back to generic OWASP checks |
