# Example: Bug Ticket Intake

Walkthrough of mk:intake processing a real bug ticket end-to-end.

---

## Input Ticket

```
Title: Users get logged out after 24 hours
Type: Bug
Priority: P2
Reporter: QA team

Description:
Multiple users report being unexpectedly logged out approximately 24 hours
after logging in. Happens on both web and mobile. No error message shown —
they are silently redirected to the login page.

Attachment: screenshot-logout-redirect.png
```

---

## Step-by-Step Processing

### Step 1: Receive
Fetched via GitHub Issues: `gh issue view 847 --json title,body,labels`

### Step 2: Sanitize
No injection patterns detected. Content treated as DATA.

### Step 3: Process media
`screenshot-logout-redirect.png` → Claude Read tool (FFmpeg unavailable).
Design Context: Login page redirect. No error message visible. URL shows `/login?expired=true`.

### Step 4: Classify product area
mk:scale-routing signals: "logged out", "auth", "session", "token"
Result: `{domain: auth_session, level: high, workflow: enhanced, model_tier_override: COMPLEX}`

### Step 5: Evaluate completeness

| Dimension | Score | Note |
|-----------|-------|------|
| Goal/Problem | 20/20 | Clear: unexpected logout after 24h |
| Acceptance Criteria | 0/20 | **Missing** — no pass/fail criteria stated |
| Scope | 10/15 | Scope described but out-of-scope not explicit |
| Steps to Reproduce | 0/15 | **Missing** — no exact repro steps |
| Technical Constraints | 10/10 | "No error message" implies silent behavior must stay |
| Priority/Severity | 10/10 | P2 with user impact stated |
| Dependencies | 5/10 | Mentions web + mobile but no ticket links |
| Design/Visual | 5/10 | Screenshot present but incomplete context |

**Score: 60/100 — Needs minor clarification**

Missing:
- Acceptance Criteria: need binary pass/fail (e.g., "Users remain logged in for 7 days unless they log out")
- Steps to Reproduce: need exact repro (log in → wait 24h → observe) with expected vs actual

### Step 6: Scan codebase (mk:scout)
Related files found:
- `src/auth/token-refresh.service.ts` — handles JWT refresh logic
- `src/middleware/auth.guard.ts` — validates session on each request
- `src/config/session.config.ts` — `SESSION_TTL = 86400` (24 hours — matches symptom)

### Step 7: Root cause analysis (mk:investigate)
Method: 5 Whys (single failure mode, medium complexity)

1. Why logged out after 24h? → Session token expires
2. Why does token expire at 24h? → `SESSION_TTL = 86400` seconds
3. Why no refresh? → Token refresh only triggers on user navigation events
4. Why not background refresh? → Background refresh not implemented
5. Root cause: **Token refresh is event-driven (navigation-only), not time-based. Idle users never trigger a refresh before expiry.**

### Step 8: Technical assessment
- Affected: `token-refresh.service.ts:45` (refresh trigger logic)
- Test gap: No test for idle-user token refresh scenario
- Complexity: low — add background refresh interval, no schema changes

---

## Output

```markdown
## Intake Analysis — GH-847

**Type:** Bug | **Source:** GitHub Issues

### Product Area: auth_session (confidence: HIGH)
Routing: high → enhanced → COMPLEX

### Completeness: 60/100 (Needs clarification)
Missing:
- Acceptance Criteria: define expected session duration (e.g., "7 days of inactivity")
- Steps to Reproduce: log in → leave idle 24h → confirm redirect to /login

### Design Context
- 1 attachment analyzed
- States visible: login redirect page, URL param `expired=true`

### Technical Considerations
- Affected files: src/auth/token-refresh.service.ts:45, src/config/session.config.ts
- Test coverage: gap — no idle-session refresh test
- Complexity: low
- Breaking change risk: none (internal refresh logic only)

### Root Cause
Method: 5 Whys
Token refresh is event-driven (navigation-only). Idle users never trigger refresh before 24h expiry.

### Suggested Breakdown
1. Add background refresh interval in token-refresh.service.ts (refresh at TTL − 5min)
2. Add idle-session integration test
3. Update session.config.ts TTL to align with product decision on desired session length

### Suggested PIC
- Auth team lead (domain owner, 3 open auth tickets)
```

**Handoff:** `mk:fix` (bug ticket, complexity: low)
