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

1. **Initialize** — run preamble, apply shared protocols, check for design doc (offer `/meow:office-hours` if none). See [preamble.md](references/preamble.md), [design-doc-check.md](references/design-doc-check.md)
2. **Scope challenge** — challenge complexity, search for built-ins, check TODOs, verify completeness. See [step0-scope-challenge.md](references/step0-scope-challenge.md)
3. **Review** — walk through Architecture, Code Quality, Tests (with coverage diagram), Performance. One issue per AskUserQuestion. Optional outside voice. See [review-sections.md](references/review-sections.md), [question-rules.md](references/question-rules.md), [outside-voice.md](references/outside-voice.md)
4. **Output** — required outputs (NOT in scope, TODOs, diagrams, failure modes), log review, show dashboard, update plan file, run telemetry. See [required-outputs.md](references/required-outputs.md), [review-log-dashboard.md](references/review-log-dashboard.md)

## Priority Hierarchy

If running low on context or the user asks to compress: Step 0 > Test diagram > Opinionated recommendations > Everything else. Never skip Step 0 or the test diagram.

## References

| File                                                                | Content                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [preamble.md](references/preamble.md)                               | Session init, upgrade check, lake intro, telemetry prompt                    |
| [askuserquestion-format.md](references/askuserquestion-format.md)   | Standard AskUserQuestion structure (re-ground, simplify, recommend, options) |
| [completeness-principle.md](references/completeness-principle.md)   | Boil the Lake — always recommend complete over shortcut                      |
| [repo-ownership.md](references/repo-ownership.md)                   | Solo vs collaborative repo mode, see-something-say-something                 |
| [search-before-building.md](references/search-before-building.md)   | Three layers of knowledge, eureka moments                                    |
| [contributor-mode.md](references/contributor-mode.md)               | Field report filing for MeowKit contributors                                 |
| [completion-status.md](references/completion-status.md)             | DONE/BLOCKED/NEEDS_CONTEXT protocol and escalation                           |
| [telemetry.md](references/telemetry.md)                             | End-of-skill telemetry logging                                               |
| [plan-status-footer.md](references/plan-status-footer.md)           | MEOWKIT REVIEW REPORT section for plan files                                 |
| [engineering-preferences.md](references/engineering-preferences.md) | DRY, testing, diagrams, 15 cognitive patterns                                |
| [design-doc-check.md](references/design-doc-check.md)               | Design doc lookup and /meow:office-hours prerequisite offer                  |
| [step0-scope-challenge.md](references/step0-scope-challenge.md)     | Scope challenge: complexity, search, TODOs, distribution                     |
| [review-sections.md](references/review-sections.md)                 | Architecture, code quality, test (with coverage diagram), performance        |
| [outside-voice.md](references/outside-voice.md)                     | Independent plan challenge via Codex or Claude subagent                      |
| [question-rules.md](references/question-rules.md)                   | How to ask questions in plan reviews                                         |
| [required-outputs.md](references/required-outputs.md)               | NOT in scope, What exists, TODOs, failure modes, summary                     |
| [review-log-dashboard.md](references/review-log-dashboard.md)       | Review log, readiness dashboard, plan file report, chaining                  |

## Gotchas

- **Bikeshedding on naming while missing architecture issues**: Spending review time on variable names instead of data flow → Review architecture and security FIRST; style issues last
- **Not checking backward compatibility**: Approving a plan that breaks existing API consumers → Always check: does this change any public interface?

## Final Step — Handoff and Stop

After engineering review is complete and all findings are written, print this EXACT block:

```
 /meow:cook [plan file path]
```

**STOP after printing this block.**
Do NOT begin Phase 2.
Do NOT write tests or implementation code.
Human decides when to proceed.

<!-- GATE 1 HARD STOP — Engineering Review
     Human decides when to run /meow:cook [plan path].
     Agent does not auto-proceed to Phase 2. -->
