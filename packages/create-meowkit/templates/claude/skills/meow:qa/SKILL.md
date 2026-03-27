---
name: meow:qa
preamble-tier: 4
version: 2.0.0
description: |
  Systematically QA test a web application and fix bugs found. Runs QA testing,
  then iteratively fixes bugs in source code, committing each fix atomically and
  re-verifying. Use when asked to "qa", "QA", "test this site", "find bugs",
  "test and fix", or "fix what's broken".
  Proactively suggest when the user says a feature is ready for testing
  or asks "does this work?". Three tiers: Quick (critical/high only),
  Standard (+ medium), Exhaustive (+ cosmetic). Produces before/after health scores,
  fix evidence, and a ship-readiness summary. For report-only mode, use /qa-only.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - WebSearch
source: gstack
---

<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /qa: Test → Fix → Verify

You are a QA engineer AND a bug-fix engineer. Test web applications like a real user — click everything, fill every form, check every state. When you find bugs, fix them in source code with atomic commits, then re-verify. Produce a structured report with before/after evidence.

## When to Use

- User says "qa", "QA", "test this site", "find bugs", "test and fix", or "fix what's broken"
- A feature is ready for testing or user asks "does this work?"
- After shipping code on a branch that needs verification
- When on a feature branch with no URL, automatically enters diff-aware mode

## Workflow

1. **Preamble** — Run shared preamble, handle upgrades/telemetry prompts. See `references/preamble.md`
2. **Detect base branch** — Determine PR target branch for diff commands. See `references/setup.md`
3. **Setup** — Parse parameters (URL, tier, mode, scope, auth), check clean working tree, find browse binary, bootstrap test framework if needed. See `references/setup.md`
4. **Select mode** — Diff-aware (feature branch, no URL), Full (URL provided), Quick, or Regression. See `references/modes.md`
5. **Phase 1: Initialize** — Find browse binary, create output dirs, start timer. See `references/workflow-phases.md`
6. **Phase 2: Authenticate** — Handle login, cookies, 2FA, CAPTCHA if needed. See `references/workflow-phases.md`
7. **Phase 3: Orient** — Map the application: screenshot, links, console errors, detect framework. See `references/workflow-phases.md`
8. **Phase 4: Explore** — Visit pages systematically using the per-page checklist. See `references/workflow-phases.md` and `references/issue-taxonomy.md`
9. **Phase 5: Document** — Capture evidence (screenshots, snapshot -D) for each issue immediately. See `references/workflow-phases.md`
10. **Phase 6: Wrap Up** — Compute health score, write top 3 issues, save baseline. See `references/workflow-phases.md` and `references/health-score.md`
11. **Phase 7: Triage** — Sort issues by severity, filter by tier (Quick/Standard/Exhaustive). See `references/workflow-phases.md`
12. **Phase 8: Fix Loop** — For each fixable issue: locate source, minimal fix, atomic commit, re-test, classify, write regression test, self-regulate via WTF-likelihood. See `references/workflow-phases.md`
13. **Phase 9: Final QA** — Re-run QA on affected pages, compute final health score, warn on regression. See `references/workflow-phases.md`
14. **Phase 10: Report** — Write report (local + project-scoped), include fix status, health score delta, PR summary. See `references/workflow-phases.md`
15. **Phase 11: TODOS.md Update** — Add deferred bugs, annotate fixed bugs. See `references/workflow-phases.md`
16. **Telemetry** — Log skill outcome and duration. See `references/preamble.md`

## References

- `references/preamble.md` — Preamble, AskUserQuestion format, Completeness Principle, Repo Ownership, Search Before Building, Contributor Mode, Completion Status, Telemetry, Plan Status Footer
- `references/setup.md` — Base branch detection, parameters, clean tree check, browse binary, test framework bootstrap, output directories, test plan context
- `references/modes.md` — Diff-aware, Full, Quick, Regression mode details
- `references/workflow-phases.md` — Phases 1-11 with full implementation details (authenticate, orient, explore, document, wrap up, triage, fix loop, final QA, report, TODOS)
- `references/health-score.md` — Health score rubric with category weights and scoring formulas
- `references/framework-guidance.md` — Framework-specific testing tips (Next.js, Rails, WordPress, SPA)
- `references/issue-taxonomy.md` — Severity levels, issue categories, per-page exploration checklist
- `references/rules.md` — All QA rules (evidence, credentials, screenshots, working tree, commits, self-regulation) and output structure

## Gotchas

- **Testing only happy path**: All tests pass but edge cases crash in production → Include at least one error scenario, one empty state, and one boundary condition per feature
- **Not testing with realistic data volumes**: Works with 3 items, crashes with 3000 → Test with representative data sizes; flag performance degradation
