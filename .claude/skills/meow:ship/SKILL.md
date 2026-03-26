---
name: meow:ship
preamble-tier: 4
version: 1.1.0
description: |
  Ship workflow: detect + merge base branch, run tests, review diff, bump VERSION, update CHANGELOG, commit, push, create PR. Use when asked to "ship", "deploy", "push to main", "create a PR", or "merge and push".
  Proactively suggest when the user says code is ready or asks about deploying.
  Supports official (→ main) and beta (→ dev/develop) ship modes with auto-detection.
# Adopted from ck:ship: argument flags for ship modes and pipeline control
argument-hint: "[official|beta] [--skip-tests] [--dry-run]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - WebSearch
source: gstack/claudekit-engineer
---

# Ship: Fully Automated Ship Workflow

Non-interactive, fully automated workflow. The user said `/meow:ship` — run straight through and output the PR URL at the end. Only stop for blocking issues (merge conflicts, in-branch test failures, ASK review items, coverage gates, plan gaps). Never stop for uncommitted changes, version bumps (auto-pick MICRO/PATCH), CHANGELOG, commit messages, or auto-fixable review findings.

## Workflow Integration

Operates in **Phase 5 (Ship)** of MeowKit's workflow. Invoked by the `shipper` agent after Gate 2 approval.

## Arguments

| Flag           | Effect                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| `official`     | Ship to default branch (main/master). Full pipeline with all steps.                                           |
| `beta`         | Ship to dev/beta branch. Skip adversarial review. Beta prerelease version suffix.                             |
| (none)         | Auto-detect: `feature/*` `hotfix/*` `bugfix/*` → official, `dev/*` `beta/*` → beta, unclear → AskUserQuestion |
| `--skip-tests` | Skip test step (use when tests already passed in this session)                                                |
| `--dry-run`    | Show what each step would do without executing. Stop after pre-flight.                                        |

## When to Use

Use when the user says "ship", "deploy", "push to main", "create a PR", or "merge and push". Proactively suggest when code is described as ready or deployment is discussed.

## Workflow

1. **Preamble** — Run MeowKit session init, handle upgrades, telemetry, lake intro. See `references/preamble.md`
2. **Detect base branch + Pre-flight** — Detect PR target branch (official → main, beta → dev), verify on feature branch, check review readiness dashboard. If `--dry-run`: output plan and stop. See `references/pre-flight.md`
3. **Distribution pipeline check** — Verify release pipeline exists for new standalone artifacts. See `references/distribution-pipeline.md`
4. **Merge base branch + Test bootstrap** — Fetch/merge base branch, bootstrap test framework if missing. See `references/merge-and-test-bootstrap.md`
5. **Run tests** — Execute test suites, triage failures (in-branch vs pre-existing). Skip if `--skip-tests`. See `references/test-execution.md`
6. **Eval suites** — Run evals if prompt-related files changed. See `references/eval-suites.md`
7. **Test coverage audit** — Trace code paths, generate coverage diagram, write missing tests. See `references/test-coverage-audit.md`
8. **Plan completion audit + verification** — Cross-reference plan items against diff, run /qa-only verification. See `references/plan-completion-audit.md`
9. **Pre-landing review** — Structural review, design review, PR comment resolution. See `references/pre-landing-review.md`
10. **Adversarial review** — Auto-scaled cross-model adversarial challenge. Skip for `beta` mode. See `references/adversarial-review.md`
11. **Version bump + CHANGELOG + TODOS** — Auto-bump VERSION (beta: use prerelease suffix e.g. 1.2.4-beta.1), generate CHANGELOG entry, update TODOS.md. See `references/version-changelog-todos.md`
12. **Link issues + Commit + Push + PR + Docs** — Find/create related GitHub issues, bisectable commits, verification gate, push, create PR (or edit existing), sync docs, persist metrics. See `references/commit-push-pr.md`
13. **Important rules** — Hard constraints that apply across all steps. See `references/rules.md`

After completion, run telemetry (see `references/preamble.md` — Telemetry section).

## Output Format

After pipeline completes, output this summary:

```
✓ Pre-flight: branch {branch}, {N} commits, +{ins}/-{del} lines (mode: {official|beta})
✓ Issues: linked {#N, #M} | created {#X}
✓ Merged: origin/{target} (up to date | N commits merged)
✓ Tests: {N} passed, {M} failed | skipped
✓ Coverage: {N}% ({pass|gate})
✓ Review: {N} critical, {M} informational
✓ Adversarial: {pass|skipped} ({tier})
✓ Version: {old} → {new}
✓ Changelog: updated
✓ Committed: {conventional commit message}
✓ Pushed: origin/{branch}
✓ PR: {URL} (linked: {#issues})
```

## When to Stop (blocking)

- On target branch already → abort
- Merge conflicts that can't be auto-resolved → stop, show conflicts
- Test failures (in-branch) → stop, show failures
- Critical review issues → AskUserQuestion per issue
- Coverage below gate → stop
- Plan gaps detected → stop

## When NOT to Stop

- Uncommitted changes → always include
- Patch version bump → auto-decide
- Changelog content → auto-generate
- Commit message → auto-compose
- No version file → skip version step silently
- No changelog file → skip changelog step silently
- Pre-existing test failures (not in-branch) → note in PR, don't block

## References

- `references/preamble.md` — Session init, AskUserQuestion format, Completeness Principle, Repo Ownership, Search Before Building, Contributor Mode, Completion Status Protocol, Telemetry, Plan Status Footer
- `references/pre-flight.md` — Base branch detection (Step 0), pre-flight checks (Step 1), Review Readiness Dashboard
- `references/distribution-pipeline.md` — Distribution pipeline check (Step 1.5)
- `references/merge-and-test-bootstrap.md` — Merge base branch (Step 2), test framework bootstrap (Step 2.5)
- `references/test-execution.md` — Run tests (Step 3), Test Failure Ownership Triage
- `references/eval-suites.md` — Eval suites for prompt-related changes (Step 3.25)
- `references/test-coverage-audit.md` — Coverage audit, diagram, test generation (Step 3.4)
- `references/plan-completion-audit.md` — Plan completion audit (Step 3.45), plan verification via /qa-only (Step 3.47)
- `references/pre-landing-review.md` — Pre-landing review (Step 3.5), design review, PR comment resolution (Step 3.75)
- `references/adversarial-review.md` — Auto-scaled adversarial review (Step 3.8)
- `references/version-changelog-todos.md` — Version bump (Step 4), CHANGELOG (Step 5), TODOS.md (Step 5.5)
- `references/commit-push-pr.md` — Issue linking, commit (Step 6), verification gate (Step 6.5), push (Step 7), PR creation/edit (Step 8), document-release (Step 8.5), ship metrics (Step 8.75)
- `references/rules.md` — Important rules and constraints
