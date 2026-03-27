---
name: meow:document-release
preamble-tier: 2
version: 1.0.0
description: |
  Post-ship documentation update. Reads all project docs, cross-references the
  diff, updates README/ARCHITECTURE/CONTRIBUTING/CLAUDE.md to match what shipped,
  polishes CHANGELOG voice, cleans up TODOS, and optionally bumps VERSION. Use when
  asked to "update the docs", "sync documentation", or "post-ship docs".
  Proactively suggest after a PR is merged or code is shipped.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
source: gstack
---

<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# Document Release: Post-Ship Documentation Update

Post-ship workflow that ensures every documentation file in the project is accurate, up to date, and written in a friendly, user-forward voice. Runs after `/meow:ship` but before the PR merges. Mostly automated — makes obvious factual updates directly, stops only for risky or subjective decisions.

## When to Use

- After code is shipped or a PR is created, to sync all docs with what changed
- When asked to "update the docs", "sync documentation", or "post-ship docs"
- Proactively suggest after a PR is merged or code is shipped

## Workflow

1. **Preamble** — Run initialization, check for upgrades, handle telemetry prompts. See `references/preamble.md`
2. **AskUserQuestion format** — Follow structured format for all user questions. See `references/ask-user-question-format.md`
3. **Completeness principle** — Always recommend the complete option. See `references/completeness-principle.md`
4. **Repo ownership & search** — Adapt behavior to solo/collaborative mode; search before building. See `references/repo-ownership-and-search.md`
5. **Contributor mode** — If enabled, file field reports on MeowKit issues. See `references/contributor-mode.md`
6. **Detect base branch** — Determine PR target branch for all diff commands. See `references/base-branch-detection.md`
7. **Review automation rules** — What to auto-fix vs ask about vs never do. See `references/automation-rules.md`
8. **Step 1: Pre-flight & diff analysis** — Gather diff stats, discover doc files, classify changes. See `references/step1-preflight-diff-analysis.md`
9. **Step 2: Per-file documentation audit** — Cross-reference each doc file against the diff. See `references/step2-per-file-audit.md`
10. **Step 3: Apply auto-updates** — Make clear factual updates directly. See `references/step3-apply-auto-updates.md`
11. **Step 4: Ask about risky changes** — Use AskUserQuestion for narrative/subjective decisions. See `references/step4-risky-changes.md`
12. **Step 5: CHANGELOG voice polish** — Polish wording without clobbering entries. See `references/step5-changelog-voice-polish.md`
13. **Step 6: Cross-doc consistency** — Check for contradictions and discoverability. See `references/step6-cross-doc-consistency.md`
14. **Step 7: TODOS cleanup** — Mark completed items, flag stale descriptions, capture new deferred work. See `references/step7-todos-cleanup.md`
15. **Step 8: VERSION bump** — Ask user about version bump if needed. See `references/step8-version-bump.md`
16. **Step 9: Commit & output** — Stage, commit, push, update PR body, output doc health summary. See `references/step9-commit-and-output.md`
17. **Completion & telemetry** — Report status, log telemetry, write plan footer. See `references/completion-and-telemetry.md`
18. **Important rules** — Core principles for all steps. See `references/important-rules.md`

## References

- `references/preamble.md` — Initialization, upgrade checks, lake intro, telemetry prompt
- `references/ask-user-question-format.md` — Structured format for AskUserQuestion calls
- `references/completeness-principle.md` — Boil the Lake: always recommend the complete option
- `references/repo-ownership-and-search.md` — Solo vs collaborative mode; search-before-build philosophy
- `references/contributor-mode.md` — Field report filing for MeowKit contributors
- `references/completion-and-telemetry.md` — Status protocol, escalation, telemetry logging, plan footer
- `references/base-branch-detection.md` — How to detect the PR target branch
- `references/automation-rules.md` — What to auto-fix, what to ask about, what to never do
- `references/step1-preflight-diff-analysis.md` — Gather diff context and discover doc files
- `references/step2-per-file-audit.md` — Per-file audit heuristics for all doc types
- `references/step3-apply-auto-updates.md` — Rules for applying factual updates directly
- `references/step4-risky-changes.md` — Handling risky/questionable documentation decisions
- `references/step5-changelog-voice-polish.md` — CHANGELOG voice rules (never clobber)
- `references/step6-cross-doc-consistency.md` — Cross-document consistency and discoverability
- `references/step7-todos-cleanup.md` — TODOS.md maintenance and deferred work capture
- `references/step8-version-bump.md` — VERSION bump decision flow
- `references/step9-commit-and-output.md` — Commit, push, PR update, and health summary
- `references/important-rules.md` — Core rules: read before edit, never clobber, be explicit
