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

1. **Initialize** — run preamble, detect base branch, run pre-review system audit (git history, diff stats, TODOs, design docs). See `references/preamble.md`, `references/base-branch-detection.md`, `references/pre-review-system-audit.md`
2. **Scope challenge** — nuclear scope challenge + mode selection (Expansion/Selective/Hold/Reduction), premise challenge, dream state mapping. See `references/step0-scope-and-mode.md`, `references/prerequisite-skill-offer.md`
3. **Review** — sections 1-11 (Architecture → Design/UX), optional outside voice from subagent. See `references/review-sections.md`, `references/outside-voice.md`
4. **Output** — required deliverables (NOT in scope, Dream state delta, Error/Rescue Registry, TODOs, diagrams), post-review handoff. See `references/required-outputs.md`, `references/post-review.md`

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

## Gotchas

- **Scope expansion beyond available resources**: "10-star thinking" produces a plan that would take 6 months → Always anchor expansion ideas to current sprint capacity
- **Missing deadlines chasing ambition**: Perfecting the plan instead of shipping MVP → Set a time-box for review; output "ship as-is" or "one targeted improvement"
