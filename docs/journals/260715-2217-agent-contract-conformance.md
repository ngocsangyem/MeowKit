---
date: 2026-07-15
plan: 260715-1614-agent-contract-correctness-routing-reconciliation-and-conformance
status: completed-phases-5-7
---

# Agent Contract Conformance: Phases 5–7

## Context

Completed the plan's session-state, brand-neutrality, and selective authoring-quality phases. The goal was to make agent-facing contracts match live behavior without changing the user-declined runtime layout.

## What happened

- Documented the real session-state split: root `session-state/` is the canonical runtime location, while `.claude/session-state/` remains the TDD-sentinel exception.
- Made brand prose generic and added a checked allowlist format: exact `.claude/` paths, no globs, and an adjacent reason for every exception. The generated plugin projection remains aligned.
- Corrected the four evidence-backed authoring items: canonical JSON decision input, stale planner text, analyst trigger ownership, and an explicit deploy-applicability contract (`deployed`, `PR-only`, or `not-applicable`) for shipping summaries. Gate 5 stayed at zero.

## Verification

Changed-files lint passed 9/9. Typecheck, lint, agent conformance, plugin validation, and canonical parity passed. Full `npm test` migration failures remain unrelated; therefore the plan-level validation gate is still `in_progress` solely pending those migration failures.

## Decision and impact

Preserved runtime behavior and documented it truthfully rather than migrating state paths. Brand exceptions are now narrow and mechanically reviewable, while the ship outcome is explicit even for repositories without a deploy step.

## Next

Resolve the outstanding full-test migration failures, then rerun plan-level validation before closing the plan.

AgentWiki publishing skipped: AgentWiki CLI is unavailable in this environment.
