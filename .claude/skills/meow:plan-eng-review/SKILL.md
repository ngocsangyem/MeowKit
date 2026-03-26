---
name: meow:plan-eng-review
preamble-tier: 3
version: 1.0.0
description: |
  Eng manager-mode plan review. Lock in the execution plan — architecture,
  data flow, diagrams, edge cases, test coverage, performance. Walks through
  issues interactively with opinionated recommendations. Use when asked to
  "review the architecture", "engineering review", or "lock in the plan".
  Proactively suggest when the user has a plan or design doc and is about to
  start coding — to catch architecture issues before implementation.
benefits-from: [office-hours]
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - Bash
  - WebSearch
source: gstack
author: garrytan (gstack)
---

<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# Plan Engineering Review

Thorough, interactive engineering review of a plan before implementation begins. Covers architecture, code quality, test coverage, and performance — one section at a time with opinionated recommendations and AskUserQuestion for every genuine decision. Produces ASCII coverage diagrams, failure mode analysis, and a review readiness dashboard.

## When to Use

- User asks to "review the architecture", "engineering review", or "lock in the plan"
- A plan or design doc exists and the user is about to start coding
- You want to catch architecture issues, missing tests, and scope creep before implementation

## Workflow

1. **Run preamble** — initialize session, check for upgrades, lake intro, telemetry prompt. See [preamble.md](references/preamble.md).
2. **Apply shared protocols** — AskUserQuestion format ([askuserquestion-format.md](references/askuserquestion-format.md)), completeness principle ([completeness-principle.md](references/completeness-principle.md)), repo ownership mode ([repo-ownership.md](references/repo-ownership.md)), search before building ([search-before-building.md](references/search-before-building.md)), contributor mode ([contributor-mode.md](references/contributor-mode.md)), completion status ([completion-status.md](references/completion-status.md)).
3. **Check for design doc** — look for existing design doc on this branch; offer `/meow:office-hours` if none found. See [design-doc-check.md](references/design-doc-check.md).
4. **Step 0: Scope Challenge** — challenge complexity, search for built-ins, cross-reference TODOs, check completeness and distribution. See [step0-scope-challenge.md](references/step0-scope-challenge.md).
5. **Review sections** — walk through Architecture, Code Quality, Tests (with ASCII coverage diagram), and Performance one at a time, stopping after each for AskUserQuestion. See [review-sections.md](references/review-sections.md).
6. **Follow question rules** — one issue per AskUserQuestion, labeled with NUMBER+LETTER, mapped to engineering preferences. See [question-rules.md](references/question-rules.md).
7. **Outside voice** — optionally get independent plan challenge from Codex or Claude subagent. See [outside-voice.md](references/outside-voice.md).
8. **Produce required outputs** — NOT in scope, What already exists, TODOS.md updates, diagrams, failure modes, completion summary. See [required-outputs.md](references/required-outputs.md).
9. **Log review and display dashboard** — persist review result, show readiness dashboard, update plan file, suggest next reviews. See [review-log-dashboard.md](references/review-log-dashboard.md).
10. **Apply engineering preferences and cognitive patterns** throughout all review steps. See [engineering-preferences.md](references/engineering-preferences.md).
11. **Write plan status footer** if in plan mode. See [plan-status-footer.md](references/plan-status-footer.md).
12. **Run telemetry** — log skill duration and outcome. See [telemetry.md](references/telemetry.md).

## Priority Hierarchy

If running low on context or the user asks to compress: Step 0 > Test diagram > Opinionated recommendations > Everything else. Never skip Step 0 or the test diagram.

## References

| File | Content |
|------|---------|
| [preamble.md](references/preamble.md) | Session init, upgrade check, lake intro, telemetry prompt |
| [askuserquestion-format.md](references/askuserquestion-format.md) | Standard AskUserQuestion structure (re-ground, simplify, recommend, options) |
| [completeness-principle.md](references/completeness-principle.md) | Boil the Lake — always recommend complete over shortcut |
| [repo-ownership.md](references/repo-ownership.md) | Solo vs collaborative repo mode, see-something-say-something |
| [search-before-building.md](references/search-before-building.md) | Three layers of knowledge, eureka moments |
| [contributor-mode.md](references/contributor-mode.md) | Field report filing for gstack contributors |
| [completion-status.md](references/completion-status.md) | DONE/BLOCKED/NEEDS_CONTEXT protocol and escalation |
| [telemetry.md](references/telemetry.md) | End-of-skill telemetry logging |
| [plan-status-footer.md](references/plan-status-footer.md) | GSTACK REVIEW REPORT section for plan files |
| [engineering-preferences.md](references/engineering-preferences.md) | DRY, testing, diagrams, 15 cognitive patterns |
| [design-doc-check.md](references/design-doc-check.md) | Design doc lookup and /meow:office-hours prerequisite offer |
| [step0-scope-challenge.md](references/step0-scope-challenge.md) | Scope challenge: complexity, search, TODOs, distribution |
| [review-sections.md](references/review-sections.md) | Architecture, code quality, test (with coverage diagram), performance |
| [outside-voice.md](references/outside-voice.md) | Independent plan challenge via Codex or Claude subagent |
| [question-rules.md](references/question-rules.md) | How to ask questions in plan reviews |
| [required-outputs.md](references/required-outputs.md) | NOT in scope, What exists, TODOs, failure modes, summary |
| [review-log-dashboard.md](references/review-log-dashboard.md) | Review log, readiness dashboard, plan file report, chaining |
