---
name: meow:review
preamble-tier: 4
version: 1.3.1
description: |
  Multi-pass code review with adversarial analysis, scope-aware dispatch, adversarial persona passes,
  and forced-finding protocol. Supports input modes: branch diff (default),
  PR number (#123), commit hash, pending changes (--pending). Use when asked to "review this PR",
  "code review", "pre-landing review", "check my diff", or "review #123".
  Proactively suggest when the user is about to merge or land code changes.
# Adopted from ck:code-review: input mode flexibility
argument-hint: "[#PR | COMMIT | --pending]"
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - WebSearch
source: gstack
---

# Pre-Landing Code Review

Multi-pass code review with 3-layer adversarial analysis, spec compliance, and auto-fix. Uses step-file architecture for deterministic execution.

## Adversarial Review Architecture (v3 — Hybrid Persona System)

### Phase A: Base Reviewers (3 parallel layers)

1. **Blind Hunter** — Reviews ONLY the diff. No plan, no spec. Catches code smells and obvious bugs.
2. **Edge Case Hunter** — Traces every branch, boundary, null path. Finds what breaks at edges.
3. **Criteria Auditor** — Maps each plan AC to implementation. Verifies coverage.

### Phase B: Adversarial Persona Passes (post-base-review, findings-informed)

After Phase A completes, separate persona subagents receive the diff AND a summary of Phase A findings. They go deeper — not wider — challenging what base reviewers missed or understated.

1. **Security Adversary** — Attack surface, injection vectors, auth bypass, supply chain
2. **Failure Mode Analyst** — Race conditions, partial failures, cascading errors, data loss
3. **Assumption Destroyer** — Implicit assumptions, unvalidated inputs, edge cases (high-domain only)
4. **Scope Complexity Critic** — Over-engineering, YAGNI violations, scope creep (high-domain only)

### Scope Gate

Step-01 assesses diff complexity and sets `review_scope`:
- **minimal** (≤3 files, ≤50 lines, no security files, domain≠high) → Blind Hunter only, no personas
- **full** → All 3 base reviewers + personas based on domain complexity

### Forced-Finding Protocol

If total findings across all reviewers = 0, step-03 triggers ONE re-analysis with "look harder" prompt. Prevents rubber-stamp approvals.

### Workflow

```
workflow.md → step-01 → step-02 (Phase A) → step-02b (Phase B, full scope only) → step-03 → step-04
```

**Prompts:** `prompts/blind-hunter.md`, `prompts/edge-case-hunter.md`, `prompts/criteria-auditor.md`
**Personas:** `prompts/personas/security-adversary.md`, `prompts/personas/failure-mode-analyst.md`, `prompts/personas/assumption-destroyer.md`, `prompts/personas/scope-complexity-critic.md`

## Plan-First Gate

Review requires context from a plan or diff:
1. If reviewing a planned feature → read approved plan from `tasks/plans/`
2. If reviewing a PR/diff → no plan needed (diff IS the context)

Skip: PR reviews triggered by `--pending` or branch diff — plan not required.

## Workflow Integration

Operates in **Phase 4 (Review)** of MeowKit's workflow. Invoked by the `reviewer` agent. FAIL verdict prevents Phase 5 (Ship).

## Input Modes

| Input                    | Mode            | What Gets Reviewed                                             |
| ------------------------ | --------------- | -------------------------------------------------------------- |
| _(default — no args)_    | **Branch diff** | Current branch diff against base branch                        |
| `--pending`              | **Pending**     | Staged + unstaged changes via `git diff` + `git diff --cached` |
| `#123` or PR URL         | **PR**          | Full PR diff via `gh pr diff 123`                              |
| `abc1234` (7+ hex chars) | **Commit**      | Single commit diff via `git show abc1234`                      |

**Default:** If invoked with no arguments, review the current branch diff (existing behavior).

## When to Use

- User asks to "review this PR", "code review", "pre-landing review", or "check my diff"
- User is about to merge or land code changes (proactive suggestion)
- Before running `/meow:ship` to ensure quality gate passes
- **For complex changes (3+ files):** Run `/meow:scout` first to identify edge cases before review
- **After verdict:** Optionally run `/meow:elicit` for structured second-pass reasoning on findings

## Workflow (Step-File Architecture)

Execute via `workflow.md`. Each step is a separate file loaded JIT:

1. **step-01-gather-context** — Load diff, plan, ACs. **Scope gate** classifies diff as `minimal` or `full`. Domain complexity check via `meow:scale-routing`.
2. **step-02-parallel-review (Phase A)** — Dispatch reviewers based on scope. Minimal = Blind Hunter only. Full = all 3 reviewers in parallel.
3. **step-02b-persona-passes (Phase B)** — Full scope only. Dispatch adversarial persona subagents informed by Phase A findings. 2-at-a-time batching.
4. **step-03-triage** — **Forced-finding check** (zero → re-analyze once). Categorize findings as `current-change` or `incidental`. Dedup Phase A + Phase B.
5. **step-04-verdict** — 5-dimension verdict (Correctness, Maintainability, Performance, Security, Coverage) + **artifact verification** (4-level). Present for Gate 2.

For high-stakes code (payments, auth, security) or `--iterative` flag, load `references/iterative-evaluation-protocol.md` for the 3-pass structured review process.

See also reference files for supplementary checks: [preamble](references/preamble.md), [scope-drift](references/scope-drift-detection.md), [design-review](references/design-review.md), [test-coverage](references/test-coverage.md), [adversarial-review](references/adversarial-review.md), [artifact-verification](references/artifact-verification.md).

## References

| File                                                                       | Contents                                                                                                                                                                                      |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [references/preamble.md](references/preamble.md)                           | Session setup, upgrade check, telemetry, AskUserQuestion format, completeness principle, repo ownership mode, search-before-building, contributor mode, completion status, plan status footer |
| [references/scope-drift-detection.md](references/scope-drift-detection.md) | Plan file discovery, actionable item extraction, cross-reference against diff, scope creep and missing requirements detection                                                                 |
| [references/two-pass-review.md](references/two-pass-review.md)             | Two-pass checklist application (critical then informational), enum completeness, search-before-recommending                                                                                   |
| [references/design-review.md](references/design-review.md)                 | Frontend-conditional design review, design checklist application, Codex design voice                                                                                                          |
| [references/test-coverage.md](references/test-coverage.md)                 | Test framework detection, codepath tracing, user flow mapping, coverage diagram, E2E/eval decision matrix, regression rule, gap test generation                                               |
| [references/fix-first-review.md](references/fix-first-review.md)           | Finding classification (AUTO-FIX vs ASK), batch user questions, verification of claims, external PR comment resolution                                                                        |
| [references/adversarial-review.md](references/adversarial-review.md)       | Auto-scaled adversarial review (small/medium/large tiers), Codex and Claude subagent passes, cross-model synthesis                                                                            |
| [references/post-review-steps.md](references/post-review-steps.md)         | TODOS cross-reference, documentation staleness check, persist eng review result, important rules                                                                                              |
| —                                                                          | _(checklist.md and design-checklist.md removed — superseded by step-file prompts in prompts/)_                                                                                                |
| [security-checklist.md](security-checklist.md)                             | Security review checklist                                                                                                                                                                     |
| [structural-audit.md](structural-audit.md)                                 | Structural audit reference                                                                                                                                                                    |

## Verdict Output

Defined in `step-04-verdict.md`. 5-dimension framework with artifact verification:

| Dimension | PASS | WARN | FAIL |
|-----------|------|------|------|
| Correctness | No CRITICAL/MAJOR bugs | MINOR bugs only | Any CRITICAL bug |
| Maintainability | Clean, conventions followed | Style issues | Unreadable, violates architecture |
| Performance | No regressions | Potential issues flagged | Proven regression |
| Security | No security findings | MINOR security notes | Any CRITICAL security issue |
| Coverage | All ACs covered + tested | Partial AC coverage | Missing AC implementation |

**Verdict rules:**
- Any FAIL dimension → Overall FAIL → Gate 2 blocks
- All PASS → Overall PASS → Gate 2 eligible
- Mix of PASS/WARN → Overall WARN → Gate 2 eligible with acknowledgment

FAIL verdict prevents `/meow:ship` from executing (Gate 2 enforcement).

## Pre-Review Scouting (Recommended)

For changes touching 3+ files, run `/meow:scout` BEFORE starting review:
1. Scout identifies affected dependents, data flow risks, async races, state mutations
2. Scout output feeds into Step 1 (Gather Context) as additional context
3. Makes the review more targeted — reviewers check scout-flagged areas first

This is recommended, not mandatory. Small diffs (1-2 files) skip scouting.

## Post-Verdict Elicitation (Optional)

After the verdict is emitted, offer the user `/meow:elicit` for deeper analysis:

```
Review complete. Verdict: [PASS|WARN|FAIL]

Want deeper analysis? Run /meow:elicit to re-examine findings through a specific lens:
  pre-mortem | inversion | red-team | socratic | first-principles | skip
```

Elicitation output appends to the verdict file as a supplementary section.
It does NOT change the verdict — it adds depth for informed Gate 2 decisions.

**Auto-suggestion:** If verdict is WARN with security findings → suggest `red-team`.
If verdict is WARN with coverage gaps → suggest `pre-mortem`.

## Gotchas

- **Reviewing diff without full context**: Approving a change that breaks an unstated invariant → Always read the surrounding file, not just the diff hunks
- **Style nits hiding real bugs**: 10 comments about formatting, zero about the missing null check → Prioritize: security > correctness > performance > style
- **Skipping scout on large diffs**: When 5+ files changed, blind review misses cross-file interaction bugs → Run scout first
