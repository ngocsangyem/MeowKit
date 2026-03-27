# Task Template Usage Guide

## Which template?

```
New work needed?
│
├─ Something broken? ──────────────────────► bug-fix.md
│
├─ Adding new behavior? ───────────────────► feature-implementation.md
│
├─ Same behavior, better structure? ───────► refactor.md
│
├─ Is it safe? ────────────────────────────► security-audit.md
│
└─ Team standard or decision? ─────────────► guideline.md
```

## File naming

Pattern: `YYMMDD-kebab-description.type.md`

| Example | Means |
|---------|-------|
| `260115-add-oauth-login.feature.md` | Feature started Jan 15, 2026 |
| `260203-fix-null-session-crash.bug.md` | Bug fix |
| `260310-extract-auth-service.refactor.md` | Refactor |
| `260320-audit-api-endpoints.security.md` | Security audit |

Quick create: `npx meowkit task new --type feature "Add oauth login"`

## Status flow

```
draft ──► in-progress ──► blocked ──► in-progress ──► review ──► done
                │                                                   │
                └──────────────────── cancelled ───────────────────┘
```

- **draft**: Written, not started. Waiting for Gate 1 approval.
- **in-progress**: Actively being worked on.
- **blocked**: Waiting on external dependency — record blocker in Agent State.
- **review**: Implementation done. Waiting for Gate 2 approval.
- **done**: All acceptance criteria checked, approved, shipped.

## How to write acceptance criteria

Acceptance criteria MUST be binary — pass or fail. No subjective measures.

**Bad (subjective):**
- [ ] Performance feels snappy
- [ ] Code is clean and readable
- [ ] UI looks good on mobile

**Good (binary):**
- [ ] POST /api/login returns 200 with valid JWT for correct credentials
- [ ] POST /api/login returns 401 for wrong password (tested)
- [ ] Login page renders without horizontal scroll at 375px viewport
- [ ] p95 latency < 200ms under 100 concurrent users (load test passes)

Rule: if you can't write a test for it, rewrite the criterion until you can.

## Agent State section

The Agent State section makes every task file **resumable**. A fresh agent session
with zero context can read it and continue without asking what happened.

```yaml
## Agent State
Current phase: 3 — Implementation
Last action: Wrote failing tests for login flow (tests/auth.test.ts)
Next action: Implement AuthService.login() to make tests pass
Blockers: none
Decisions made:
  - Using JWT (not sessions) — lighter, stateless, fits mobile client
  - 24hr token expiry — balances security and UX based on user research
```

Update Agent State after EVERY significant action. Treat it as a commit message for your work.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Starting Phase 3 without Gate 1 approval | Get plan approved first — no exceptions |
| Acceptance criteria say "should" or "looks good" | Rewrite as binary pass/fail |
| Agent State is empty or stale | Update it after every significant step |
| Out-of-scope work creeps in | Add to backlog, not this task |
| Marking done before criteria checked | Check every checkbox, then mark done |
