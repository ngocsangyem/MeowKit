---
title: Review Code
description: Multi-pass adversarial code review with /mk:review — 5 dimensions, parallel reviewers, and structured verdicts.
---

# Review Code

`/mk:review` runs a multi-pass adversarial code review. Three parallel reviewers examine your code independently, then findings are triaged into a single verdict. It's both a Phase 4 pipeline step and a standalone command.

## Quick start

```bash
# Review current branch diff
/mk:review

# Review a specific PR
/mk:review #42

# Review uncommitted changes
/mk:review --pending
```

## The 5 review dimensions

| Dimension | What it checks |
|-----------|---------------|
| Architecture fit | Matches existing patterns? Respects ADRs? Accidental complexity? |
| Type safety | No `any` types? No unsafe casts? Proper generics? |
| Test coverage | Edge cases covered? Testing behavior, not implementation? |
| Security | Passes `security-rules.md` checklist? Hardcoded secrets? |
| Performance | No N+1 queries? No blocking async? No unbounded fetches? |

## How parallel review works

Three reviewers run simultaneously to prevent anchoring bias:

1. **Blind Hunter** — zero context review. Sees only the diff, not the plan or codebase.
2. **Edge Case Hunter** — boundary conditions. What happens on empty input, max values, null?
3. **Criteria Auditor** — acceptance criteria. Does the code satisfy every criterion in the plan?

Findings from all three are triaged into a single verdict.

## Verdicts

| Verdict | Meaning | What happens |
|---------|---------|-------------|
| PASS | No blocking issues | Proceed to ship |
| PASS WITH NOTES | Non-blocking suggestions | Proceed to ship, suggestions noted |
| FAIL | Critical findings | Back to developer, must fix before re-review |

A FAIL on any single dimension blocks shipping (Gate 2). There is no averaging.

## Optional: deeper review

```bash
# Lightweight browser check after review (~$1)
/mk:cook "feature" --verify

# Full evaluator with rubric grading (~$2-5)
/mk:cook "feature" --strict
```

`--verify` checks that pages load and have no console errors. `--strict` runs the full evaluator — it clicks through the app, grades against rubrics, and produces a scored verdict. Use `--strict` for security-critical or payment-related features.

## Optional: post-verdict elicitation

After the verdict, `/mk:elicit` pushes deeper on WARN dimensions using 8 structured methods (pre-mortem, red team, Socratic questioning, etc.). Invoke it explicitly:

```bash
/mk:elicit
```

## Don't use /mk:review for

- **Bug investigation** → use `/mk:fix`
- **Security-only audit** → use `/mk:cso`
- **Architecture decisions** → use `/mk:party`

## Next steps

- [Ship safely](/guides/ship-safely) — the deployment pipeline
- [Build a feature](/guides/build-a-feature) — the full workflow with review
- [Gates & security](/core-concepts/gates) — how Gate 2 enforces review
