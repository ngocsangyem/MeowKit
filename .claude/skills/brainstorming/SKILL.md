---
name: mk:brainstorming
preamble-tier: 3
version: 2.0.0
description: |
  Use when exploring technical solutions, comparing approaches, or generating
  alternatives for a validated problem. Triggers on "brainstorm solutions",
  "explore approaches", "compare options", "trade-off analysis", "how should
  we build". Do NOT use for product validation ("is this worth building?" →
  use mk:office-hours instead). Do NOT use when a plan already exists
  (→ use mk:plan-ceo-review instead).
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - WebSearch
source: claudekit-engineer
---

# Brainstorming

Explore technical solutions with structured ideation, scoring, and plan-creator handoff.

**Differentiator:** office-hours = "should we build this?", brainstorming = "how should we build this?"

## When to Use

- Multiple architecturally-distinct approaches exist for a known requirement
- Trade-off analysis between candidate solutions is needed
- Novel problem with no obvious pattern in the codebase
- Pre-mortem / failure-mode exploration before committing to a design
- Constraint-rich problem (budget, time, stack) where the solution space is narrow

**NOT this skill if:** you are stuck on a specific existing approach with forced assumptions — use `mk:problem-solving`. **NOT this skill if:** you want to deepen an existing verdict or plan — use `mk:elicit`.

## When NOT to Use

| Situation                                             | Use instead                      |
| ----------------------------------------------------- | -------------------------------- |
| "Is this worth building?" — product validation        | `mk:office-hours`              |
| Plan already exists, want to challenge scope          | `mk:plan-ceo-review`           |
| Bug investigation / root cause                        | `mk:investigate`               |
| Implementation detail (which library, which API call) | `mk:docs-finder` + just decide |

## Plan-First Gate

Brainstorming precedes planning — it produces input FOR plans.
Always skips Gate 1 (same as `mk:investigate` and `mk:office-hours`).

## Arguments

- `--depth quick` — 3-8 ideas, no scoring (default)
- `--depth deep` — scored ideas + top 3 + optional plan-creator handoff
- `--technique [name]` — force a specific technique (default: auto-select)

## Process (outcome-oriented; not a script)

The skill is done when:

1. **Problem is confirmed** — the user has explicitly agreed on what is being solved and the binding constraint. Use `AskUserQuestion` if needed, capped at 3 questions per batch (see Discovery Protocol).
2. **Scope is right-sized** — if the request bundles 3+ independently-shippable concerns (heuristic: would each be its own GitHub issue or PR?), the user has agreed to either decompose into sub-projects or pick one to brainstorm now. Do not proceed on a bundled request.
3. **A technique is selected** — match problem type to one file in `references/techniques/`. When multiple match, prefer in this order: `multi-alternative` → `first-principles` → `reverse` → `constraint-mapping` → `scamper` → `analogical-thinking` → `perspective-shift`.
   - "How to build X" → `multi-alternative.md`
   - Novel problem, no existing pattern → `first-principles.md`
   - Debugging / preventing failures → `reverse.md`
   - Many constraints, narrow space → `constraint-mapping.md`
   - Improving / iterating an existing thing → `scamper.md`
   - Cross-domain transfer → `analogical-thinking.md`
   - Stakeholder / persona angles → `perspective-shift.md`
4. **Ideas are generated, then evaluated separately** — cap at 8 ideas per run. Do not score or compare while generating; the full set must exist before any ranking.
5. **Anti-bias pivot is applied once** — after idea #4 (midpoint), pause and ask: "what orthogonal category have I not touched yet?" Generate the rest from that angle. One pivot per session.
6. **Output uses the right template** —
   - `--depth quick` → `assets/output-ideas.md`
   - `--depth deep` → `assets/output-scored.md` (score via `references/scoring-criteria.md`)
7. **Handoff is offered** (`--depth deep` only) — ask: "Create plan from top idea?" If yes → invoke `mk:plan-creator` with `{ idea, problem, constraints, scores, rationale }`.

**Behavioral hard rule (not hook-enforced — see `gate-rules.md` for actual gates):** brainstorming MUST NOT write code, create files outside `plans/reports/`, or invoke implementation skills. Output is _ideas_, never _code_.

## Idea Format Template

Capture every idea with this shape — not bare table rows:

```
[#N] [Mnemonic Title]
  Concept: [2-3 sentence mechanism — what it is and how it works]
  Novelty: [What makes this non-obvious; why a senior eng wouldn't dismiss it]
```

The Novelty line is mandatory. If you cannot write one, the idea is a duplicate of a more obvious option — drop it and try another orthogonal angle.

## Anti-Rationalization

When tempted to skip discovery, scope, or the pivot — read `references/anti-rationalization.md`. It catalogs the common excuses and their counter-arguments.

## Discovery Protocol

Use `AskUserQuestion` to clarify, but cap at **3 questions per batch**. Avoid question fatigue.

Good clarifying questions target:

- The actual constraint that bounds the solution (budget, latency, team size, deadline)
- The success criteria (what does "good" look like once we ship?)
- What the user has already ruled out and why

Bad clarifying questions:

- Asking the user to design the solution ("would you prefer X or Y?")
- Asking for information already in the request
- Asking 5+ questions before generating any ideas

## Gotchas (top 3)

- **Premature solutioning** — jumping to "how" before confirming "what". Force problem restatement first.
- **Anchoring on first idea** — generate ALL ideas before evaluating any. Score in a separate pass.
- **Context flooding** — max 8 ideas per run. If the problem needs more, run multiple focused sessions on sub-problems.

Full list: `references/gotchas.md`
Edge cases (where the obvious approach is wrong): `references/edge-cases.md`

## Workflow Integration

Phase 1 (Plan) — pre-planning. Runs after problem validation, before plan creation.

```
mk:office-hours (validate)
  ↓
mk:brainstorming (explore)
  ↓
mk:plan-creator (plan)
```

## Handoff Protocol

On completion:

- Output saved to `plans/reports/`
- If `--depth deep` and user opts in: invoke `mk:plan-creator` with `{ idea, problem, constraints, scores, rationale }`
- `plan-creator` receives this as pre-research input and may skip its own discovery step
