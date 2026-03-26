---
name: meow:plan-ceo-review
preamble-tier: 3
version: 1.0.0
description: |
  CEO/founder-mode plan review. Rethink the problem, find the 10-star product,
  challenge premises, expand scope when it creates a better product. Four modes:
  SCOPE EXPANSION (dream big), SELECTIVE EXPANSION (hold scope + cherry-pick
  expansions), HOLD SCOPE (maximum rigor), SCOPE REDUCTION (strip to essentials).
  Use when asked to "think bigger", "expand scope", "strategy review", "rethink this",
  or "is this ambitious enough".
  Proactively suggest when the user is questioning scope or ambition of a plan,
  or when the plan feels like it could be thinking bigger.
benefits-from: [office-hours]
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - AskUserQuestion
  - WebSearch
source: gstack
author: garrytan (gstack)
---

<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# Mega Plan Review Mode — CEO/Founder-Level Plan Review

A rigorous, multi-section plan review from a CEO/founder perspective. Challenges premises, maps failure modes, traces error paths, and ensures the plan is extraordinary — not just adequate. Operates in four modes (Expansion, Selective Expansion, Hold Scope, Reduction) with the user in full control of every scope decision.

## When to Use

- The user asks to "think bigger", "expand scope", "strategy review", or "rethink this"
- A plan feels under-ambitious or is questioning its own scope
- Before major implementation begins, to catch landmines early
- When the user wants a second opinion on plan quality and completeness

## Workflow

1. **Preamble** — Run startup checks (update, sessions, telemetry, contributor mode). See `references/preamble.md`
2. **Shared Protocols** — Follow AskUserQuestion format, Completeness Principle, Repo Ownership, Search Before Building, Contributor Mode, Completion Status, and Telemetry. See `references/shared-protocols.md`
3. **Detect Base Branch** — Determine the PR target branch via `gh pr view` or `gh repo view`. See `references/base-branch-detection.md`
4. **Pre-Review System Audit** — Run git history, diff stats, TODO scan, design doc check, handoff note check, retrospective check, frontend scope detection, taste calibration, and landscape check. See `references/pre-review-system-audit.md`
5. **Prerequisite Skill Offer** — If no design doc found, offer `/meow:office-hours` before proceeding. See `references/prerequisite-skill-offer.md`
6. **Step 0: Nuclear Scope Challenge + Mode Selection** — Premise challenge, existing code leverage, dream state mapping, implementation alternatives, mode-specific analysis, CEO plan persistence, spec review loop, temporal interrogation, and mode selection. See `references/step0-scope-and-mode.md`
7. **Review Sections 1-11** — Architecture, Error/Rescue Map, Security, Data Flow/Edge Cases, Code Quality, Tests, Performance, Observability, Deployment, Long-Term Trajectory, Design/UX. See `references/review-sections.md`
8. **Outside Voice** — Optional independent plan challenge from Codex or Claude subagent. See `references/outside-voice.md`
9. **Required Outputs** — NOT in scope, What already exists, Dream state delta, Error/Rescue Registry, Failure Modes Registry, TODOS.md updates, Scope Expansion Decisions, Diagrams, Completion Summary. See `references/required-outputs.md`
10. **Post-Review** — Handoff note cleanup, review log, review readiness dashboard, plan file review report, next steps (review chaining), and docs/designs promotion. See `references/post-review.md`

## References

- `references/preamble.md` — Preamble bash script and startup logic
- `references/shared-protocols.md` — AskUserQuestion format, Completeness Principle, Repo Ownership, Search Before Building, Contributor Mode, Completion Status Protocol, Telemetry
- `references/base-branch-detection.md` — Step 0: Detect base branch
- `references/pre-review-system-audit.md` — System audit, design doc check, handoff notes, retrospective, frontend detection, taste calibration, landscape check
- `references/prerequisite-skill-offer.md` — Office-hours prerequisite and mid-session detection
- `references/step0-scope-and-mode.md` — Premise challenge, code leverage, dream state, implementation alternatives, mode-specific analysis, CEO plan persistence, spec review loop, temporal interrogation, mode selection
- `references/philosophy-and-principles.md` — Philosophy, Prime Directives, Engineering Preferences, Cognitive Patterns, Priority Hierarchy
- `references/review-sections.md` — Sections 1-11 (Architecture through Design/UX)
- `references/outside-voice.md` — Independent plan challenge (Codex/Claude subagent)
- `references/required-outputs.md` — All required output sections and completion summary
- `references/post-review.md` — Handoff cleanup, review log, dashboard, plan file report, review chaining, docs promotion
