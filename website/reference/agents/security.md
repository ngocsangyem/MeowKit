---
title: security
description: Security audit specialist — runs checks at Phase 2 and Phase 4, issues BLOCK verdicts that halt the pipeline for critical vulnerabilities.
---

# security

The security agent is your last line of defense against shipping vulnerabilities. It audits both the plan (before code is written) and the implementation (before code ships), with the authority to halt the entire pipeline when it finds critical issues. No other agent can override a security BLOCK.

## Cognitive Framing

> *"Security is not a feature — it is a constraint. The security agent ensures vulnerabilities are caught before they reach production."*

The security agent operates at Phase 2 (pre-implementation audit) and Phase 4 (review audit). It auto-activates on any change touching auth, payments, user data, API endpoints, or encryption. Its BLOCK verdict is the strongest enforcement mechanism in MeowKit — once issued, the pipeline halts until the finding is resolved and a re-audit passes.

## Key Facts

| | |
|---|---|
| **Type** | Core |
| **Phase** | 2 (pre-implementation), 4 (review) |
| **Auto-activates** | Auth, payment, user data, API, or encryption changes |
| **Owns** | `.claude/rules/security-rules.md` |
| **Never does** | Write code, issue PASS with CRITICAL findings, allow other agents to override BLOCK, downgrade ambiguous findings to LOW |

## When to Use

- When a task **touches authentication, payments, user data, or encryption** — the security agent activates automatically.
- During **Phase 2** to audit the plan and architecture for security design flaws before code is written.
- During **Phase 4** to audit the implementation for vulnerabilities before code ships.
- When **reviewing skills that fetch external content** or process untrusted data — triggers a rule-by-rule injection review.

## Key Capabilities

- **Dual-phase auditing** — reviews both the design (Phase 2) and the implementation (Phase 4) to catch security issues at both stages.
- **Platform-specific rules** — applies targeted security checks for NestJS (auth guards, input validation, parameterized queries), Vue (XSS prevention, CSRF tokens, secure token storage), Swift (Keychain, certificate pinning, ATS compliance), and Supabase (RLS, service key isolation, auth policies).
- **Finding classification** — categorizes findings by severity: CRITICAL (blocks pipeline), HIGH (must fix before ship), MEDIUM (should fix), LOW (advisory).
- **BLOCK verdicts** — issues pipeline-halting verdicts with clear explanations and remediation steps. Only the security agent can clear a BLOCK after re-audit.
- **Injection review** — performs rule-by-rule PASS/WARN/FAIL audits against all 10 rules in `injection-rules.md` for skills handling external content. Any FAIL on rules R1–R10 blocks merge with no exceptions.

## Behavioral Checklist

- [x] Runs security audit at both Phase 2 (plan) and Phase 4 (implementation)
- [x] Applies platform-specific security rules based on the project's tech stack
- [x] Classifies findings by severity (CRITICAL, HIGH, MEDIUM, LOW)
- [x] Issues BLOCK verdicts for critical vulnerabilities with remediation steps
- [x] Never issues PASS when any CRITICAL finding exists
- [x] Never downgrades ambiguous findings to avoid blocking the pipeline
- [x] Performs rule-by-rule injection review for skills handling external content
- [x] Requires re-audit before pipeline can resume after BLOCK

## Common Use Cases

| Scenario | What the security agent does |
|---|---|
| Adding JWT authentication | Audits token storage approach, validates against platform rules, checks for hardcoded secrets |
| Payment integration | CRITICAL-level audit of data handling, encryption, and API security. BLOCK if any vulnerability found |
| New API endpoint | Checks for input validation, rate limiting, CORS configuration, parameterized queries |
| Skill that fetches external URLs | Performs 10-rule injection review covering data boundaries, encoding obfuscation, context flooding |
| Vue component with user input | Checks for XSS prevention (no `v-html` with user input), CSRF tokens, CSP headers |

## Pro Tips

### Treat Ambiguity as Risk

When a finding is unclear — you cannot determine whether it is truly vulnerable — the security agent classifies it as MEDIUM and flags for human review. It never downgrades to LOW to avoid blocking. This "fail safe" approach means you might occasionally investigate false positives, but you will never ship a vulnerability that was spotted and then dismissed.

### Combine Security with Architecture Reviews

For changes involving both new architecture and security-sensitive code (like an auth system redesign), the security agent and architect work in parallel. The architect evaluates structural tradeoffs while the security agent audits for vulnerabilities — each respects the other's domain but the security BLOCK verdict always takes precedence.

## Key Takeaway

The security agent exists to prevent the most costly engineering outcome: shipping a security vulnerability. Its BLOCK verdict is deliberately the strongest enforcement in the pipeline because the cost of a missed vulnerability is always higher than the cost of a delayed ship.

## Related Agents

- **[orchestrator](/reference/agents/orchestrator)** — inserts the security agent at Phase 2 and Phase 4 for security-sensitive changes
- **[architect](/reference/agents/architect)** — coordinates on security-related architectural decisions; respects BLOCK verdicts
- **[reviewer](/reference/agents/reviewer)** — security BLOCK automatically fails the Security dimension of the review
- **[developer](/reference/agents/developer)** — implements remediation when BLOCK is issued
