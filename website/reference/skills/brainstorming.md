---
title: "meow:brainstorming"
description: "Structured technical ideation with discovery, scope assessment, anti-bias pivot, scoring, and plan-creator handoff."
---

# meow:brainstorming

Structured technical ideation with discovery, scope assessment, anti-bias pivot, scoring, and plan-creator handoff.

::: tip Updated in v2.4.3
Skill bumped to internal v2.0.0. Patterns extracted from BMAD-METHOD, ClaudeKit, and the everything-claude-code structural template. Adds 3 techniques (analogical-thinking, scamper, perspective-shift), an anti-rationalization reference, an edge-cases reference, a discovery protocol (3-question cap), a scope-assessment step (3+ concerns → decompose), and a single mid-session anti-bias pivot at idea #4.
:::

## What This Skill Does

`meow:brainstorming` explores technical solutions for validated problems. Given a problem description, it confirms the problem and binding constraint, optionally decomposes a multi-concern request, selects an ideation technique from a tiebreaker-ordered list, generates up to 8 structured ideas with one mid-session anti-bias pivot, optionally scores them, and can hand the top idea off to `meow:plan-creator` for implementation planning.

Key differentiator from `meow:office-hours`: office-hours asks "should we build this?", brainstorming asks "how should we build this?"

## Core Capabilities

- **7 ideation techniques** — multi-alternative (default), first-principles, reverse, constraint-mapping, scamper, analogical-thinking, perspective-shift
- **Discovery protocol** — `AskUserQuestion` capped at 3 questions per batch; targets the binding constraint, success criteria, and ruled-out options
- **Scope assessment** — 3+ independently-shippable concerns → user decomposes before brainstorming proceeds
- **Anti-bias pivot** — one orthogonal-category pivot at idea #4, mirroring BMAD's ~10% pivot frequency at the 8-idea scale
- **Idea Format Template** — every idea carries a mandatory `Novelty` line; if you can't write one, the idea is dropped as a duplicate
- **Depth control** — `--depth quick` (ideas only) or `--depth deep` (scored + handoff-ready)
- **Structured scoring** — feasibility (×3), impact (×3), simplicity (×2), novelty (×1) with weighted totals; conservative-drift, empty-intersection, and tie-break risk callouts
- **Plan-creator handoff** — top idea flows directly into plan creation with `{ idea, problem, constraints, scores, rationale }` as pre-research context
- **Behavioral hard rule** — no code, no files outside `plans/reports/`, no implementation skill invocation (not hook-enforced — see `gate-rules.md`)

## When to Use This

::: tip Use meow:brainstorming when...
- You have a validated problem and need technical solutions
- You want to compare 2-3 architectural approaches with trade-offs
- You need structured idea generation (not freeform chat)
- You want scored recommendations before committing to a plan
:::

::: warning Don't use meow:brainstorming when...
- Problem isn't validated yet → use [`meow:office-hours`](/reference/skills/office-hours)
- You already have a plan → use [`meow:plan-ceo-review`](/reference/skills/plan-ceo-review)
- You need to debug/investigate → use [`meow:investigate`](/reference/skills/investigate)
- It's an implementation detail (which library, which API call) → use [`meow:docs-finder`](/reference/skills/docs-finder) and just decide
:::

## Usage

```bash
# Quick brainstorm (default — 3-8 ideas, no scoring)
/meow:brainstorming how should we handle real-time notifications

# Deep brainstorm (scored ideas + top 3 recommendations + plan handoff offer)
/meow:brainstorming how to handle file uploads --depth deep

# Force a specific technique
/meow:brainstorming prevent auth failures --technique reverse
```

## Techniques

When multiple match, the SKILL.md tiebreaker order is: `multi-alternative` → `first-principles` → `reverse` → `constraint-mapping` → `scamper` → `analogical-thinking` → `perspective-shift`.

| Technique | When to use |
|-----------|-------------|
| multi-alternative | Default — "how to build X", multiple architecturally-distinct approaches |
| first-principles | Novel problem, no existing patterns |
| reverse | "How could this fail?" — debugging / prevention mindset |
| constraint-mapping | Many constraints, narrow solution space |
| scamper | Improving / iterating an existing thing (NOT greenfield) |
| analogical-thinking | Cross-domain transfer ("how do other industries solve this?") |
| perspective-shift | Stakeholder / persona angles (on-call SRE, security, future-you, end user) |

## Quick Workflow

```
Problem → Confirm + Binding Constraint → Scope Check (decompose if 3+ concerns)
  → Select Technique (tiebreaker chain) → Generate Ideas #1-#3
  → Anti-Bias Pivot at #4 (orthogonal category) → Generate Ideas #4-#8
  → Score (if --depth deep) → Top 3 Recommendations
  → Plan Handoff (optional, --depth deep only)
```

## Output Templates

Both depth modes now include audit-trail fields: Discovery Trace (questions asked + summarized answers), Scope Decision checkbox, Technique Selection rationale, and an explicit anti-bias pivot record.

| Template | Used by |
|----------|---------|
| `assets/output-ideas.md` | `--depth quick` |
| `assets/output-scored.md` | `--depth deep` (adds scoring matrix + risk callouts) |
| `assets/output-action-plan.md` | Plan handoff (`--depth deep` opt-in) |

## Reference Files (progressive disclosure)

| File | Loaded when |
|------|-------------|
| `references/techniques/*.md` | Step 3 — one file per technique, loaded only on selection |
| `references/scoring-criteria.md` | `--depth deep` only |
| `references/anti-rationalization.md` | When tempted to skip discovery, scope, or the pivot |
| `references/edge-cases.md` | When the obvious approach is wrong (8 documented cases) |
| `references/gotchas.md` | Always — top 3 inlined in SKILL.md, full list referenced |

::: info Skill Details
**Phase:** 1 (pre-planning) — always skips Gate 1
**Used by:** planner, brainstormer agents
**Allowed tools:** Read, Grep, Glob, AskUserQuestion, WebSearch — no Bash, no Write outside `plans/reports/`
:::

## Gotchas (top 3)

- **Premature solutioning** — jumping to "how" before confirming "what". Force problem restatement first via `AskUserQuestion`.
- **Anchoring on first idea** — generate ALL ideas before evaluating any. Score in a separate pass, not interleaved with generation.
- **Context flooding** — max 8 ideas per run. If the problem needs more, run multiple focused sessions on sub-problems.

Full list (12 gotchas including scope-explosion, question-fatigue, technique-mismatch, semantic-clustering, user-pre-decided, empty-intersection): see `references/gotchas.md`. Edge cases where the obvious approach is wrong: see `references/edge-cases.md`.

## Related

- [`meow:office-hours`](/reference/skills/office-hours) — Product validation BEFORE brainstorming
- [`meow:plan-creator`](/reference/skills/plan-creator) — Creates plan FROM brainstorming output
- [`meow:plan-ceo-review`](/reference/skills/plan-ceo-review) — Reviews existing plans
- [`meow:investigate`](/reference/skills/investigate) — Bug investigation / root cause (not brainstorming)
