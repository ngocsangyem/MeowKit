---
title: "mk:qa"
description: "Systematically QA test a web application and fix bugs found. Runs QA testing, then iteratively fixes bugs in source code, committing each fix atomically and re-verifying."
---

# mk:qa

## What This Skill Does

A combined QA engineer and bug-fix engineer that tests web applications like a real user -- clicking every element, filling every form, checking every state. When bugs are found, it fixes them in source code with atomic commits and re-verifies. Produces a structured report with before/after health scores, fix evidence, and a ship-readiness summary.

## When to Use

- User says "qa", "QA", "test this site", "find bugs", "test and fix", or "fix what's broken"
- A feature is ready for testing or user asks "does this work?"
- After shipping code on a feature branch that needs verification
- When on a feature branch with no URL, automatically enters **diff-aware mode** -- analyzes branch diff to identify affected pages/routes and tests them directly
- **NOT** for one-off browser commands (single click, screenshot) -- use `mk:agent-browser` instead
- **NOT** for spec-driven manual QA with E2E code generation -- use `mk:qa-manual`

## Core Capabilities

- **Three tier system:** Quick (critical/high only), Standard (+ medium), Exhaustive (+ cosmetic)
- **Four operational modes:** Diff-aware (auto on feature branch), Full (default with URL), Quick (30s smoke test), Regression (compare against baseline)
- **Health score rubric:** Weighted scoring across 8 categories (Console, Links, Visual, Functional, UX, Performance, Content, Accessibility)
- **Atomic fix commits:** One commit per bug fix with `fix(qa): ISSUE-NNN -- description` format
- **Regression test generation:** After each verified fix, generates a regression test that fails without the fix
- **Self-regulation:** WTF-likelihood heuristic stops runaway fixing (hard cap at 50 fixes)
- **TODOS.md integration:** Adds deferred bugs as TODOs and annotates fixed ones
- **Multi-framework awareness:** Detects Next.js, Rails, WordPress, SPA and tailors testing approach
- **Before/after evidence:** Screenshots pairs and `snapshot -D` for every fix and finding

## Arguments

| Argument | Effect |
|----------|--------|
| _(no args on feature branch)_ | Diff-aware mode -- auto-detect affected pages from branch diff |
| `URL` | Target URL for full QA testing |
| `--quick` | Quick tier -- 30-second smoke test (homepage + top 5 nav targets) |
| `--exhaustive` | Exhaustive tier -- includes cosmetic/low severity issues |
| `--regression <baseline.json>` | Regression mode -- compare against previous baseline |
| `"Focus on billing page"` | Scope QA to a specific area |

## Workflow

The skill follows an 11-phase pipeline:

1. **Initialize** -- Detect base branch, parse parameters (URL, tier, mode, scope, auth), verify clean working tree, find browse binary
2. **Authenticate** (if needed) -- Login, cookie import, 2FA, CAPTCHA handling. Never stores credentials
3. **Orient** -- Launch browser, screenshot landing page, map navigation links, check console errors, detect framework
4. **Explore** -- Visit pages systematically with per-page checklist (visual scan, interactive elements, forms, navigation, states, console, responsiveness)
5. **Document** -- Capture evidence immediately (screenshots, `snapshot -D`) for each issue found
6. **Wrap Up** -- Compute initial health score, write Top 3 issues, save baseline.json
7. **Triage** -- Sort by severity, filter by tier, mark unfixable issues as deferred
8. **Fix Loop** -- For each fixable issue: locate source (Grep/Glob), apply minimal fix, atomic commit, re-test with evidence, classify (verified/best-effort/reverted), generate regression test
9. **Final QA** -- Re-run QA on all affected pages, compute final health score, warn if regressed
10. **Report** -- Write structured report to `.claude/memory/qa-reports/` with health score delta, fix status per issue, PR summary
11. **TODOS.md Update** -- Add deferred bugs, annotate fixed bugs

## Usage

```bash
/mk:qa                              # Diff-aware mode (on feature branch, no URL)
/mk:qa https://myapp.com            # Full QA on target URL
/mk:qa --quick                      # Quick smoke test
/mk:qa https://myapp.com --exhaustive   # Exhaustive tier
/mk:qa --regression baseline.json   # Compare against previous run
```

## Example Prompt

> "I just finished the checkout flow refactor on this branch. /mk:qa"

The skill enters diff-aware mode: analyzes the branch diff to find affected pages (`checkout.tsx`, `CartSummary.tsx`), auto-detects the running local app on port 3000, tests the checkout page end-to-end, captures evidence, computes health score, fixes any bugs found, and reports results.

## Common Use Cases

- **Pre-PR verification:** Run diff-aware QA before opening a pull request to catch regressions introduced by the branch
- **Release readiness:** Run exhaustive QA before a major release to catch cosmetic and edge-case issues
- **Smoke testing:** Quick tier after a hotfix deployment to verify critical paths still work
- **Regression tracking:** Compare against baseline to track quality trends over time
- **Bug bash:** Focused QA on a specific feature area with `"Focus on billing page"`

## Pro Tips

- **Always commit or stash first** -- the skill requires a clean working tree so each fix gets its own atomic commit
- **Use diff-aware mode** on feature branches -- it automatically scopes testing to what changed, much faster than full mode
- **Run before `mk:review`** -- QA finds runtime bugs that static review misses; the two complement each other
- **Check `.claude/memory/qa-reports/`** for historical reports and baselines for regression comparisons
- **The health score weights functional (20%) highest** -- prioritize functional bugs during triage
- **Set up test framework first** -- if the project has no tests, the skill offers to bootstrap one before generating regression tests

> **Canonical source:** `.claude/skills/qa/SKILL.md`
