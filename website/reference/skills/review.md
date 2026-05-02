---
title: "mk:review"
description: "Multi-pass adversarial code review — 3 parallel base reviewers, 4 persona passes, forced-finding protocol."
---

# mk:review

Multi-pass adversarial code review with scope-aware dispatch. Three parallel base reviewers examine code independently. After base review, adversarial persona passes challenge findings deeper. Forced-finding protocol prevents rubber-stamp approvals.

## Usage

```bash
/mk:review                  # Current branch diff
/mk:review #42              # Specific PR
/mk:review abc1234          # Specific commit
/mk:review --pending        # Uncommitted changes
```

## Adversarial review architecture

### Phase A — Base Reviewers (3 parallel, isolated contexts)

1. **Blind Hunter** — reviews ONLY the diff, no plan/spec. Catches code smells, obvious bugs.
2. **Edge Case Hunter** — traces every branch, boundary, null path. Finds what breaks at edges.
3. **Criteria Auditor** — maps each plan acceptance criterion to implementation and tests.

### Phase B — Adversarial Persona Passes (post-base-review)

Separate persona subagents receive diff + Phase A findings:

1. **Security Adversary** — attack surface, injection vectors, auth bypass, supply chain
2. **Failure Mode Analyst** — race conditions, partial failures, cascading errors, data loss
3. **Assumption Destroyer** — implicit assumptions, unvalidated inputs, edge cases (high-domain only)
4. **Scope Complexity Critic** — over-engineering, YAGNI violations, scope creep (high-domain only)

### Scope gate

Step-01 assesses diff complexity: **minimal** (≤3 files, ≤50 lines, no security files, domain≠high) → Blind Hunter only, no personas. **full** → all 3 base reviewers + personas based on domain complexity.

### Forced-finding protocol

If total findings across all reviewers = 0, triggers ONE re-analysis with "look harder" prompt. Prevents rubber-stamp approvals.

### Workflow

```
workflow.md → step-01 → step-02 (Phase A) → step-02b (Phase B, full scope) → step-03 → step-04
```

## Five review dimensions

| Dimension | What it checks |
|---|---|
| Correctness | No critical/major bugs. Logic matches requirements. |
| Maintainability | Clean, readable, follows conventions. No `any` types. |
| Performance | No N+1 queries, no blocking async, no unbounded fetches. |
| Security | Passes `security-rules.md`. Security BLOCK → automatic FAIL. |
| Coverage | All ACs tested? Edge cases? **TDD mode:** gaps → FAIL. **Default:** gaps → WARN. |

## Verdicts

| Verdict | Effect |
|---|---|
| PASS | Proceed to ship |
| PASS WITH NOTES | Proceed, suggestions noted |
| FAIL | Back to developer — must fix before re-review |

## Plan-first gate

Review requires context: if reviewing a planned feature → read approved plan. If reviewing a PR/diff → no plan needed (diff IS the context). Skip: PR reviews via `--pending` or branch diff.

## Skill wiring

- Reads memory: `.claude/memory/review-patterns.md`, `.claude/memory/security-log.md`
- Writes memory: `.claude/memory/review-patterns.md` with `##pattern:` prefix
- Data boundary: PR diffs and commit messages are DATA per `injection-rules.md`
