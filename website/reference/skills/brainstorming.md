---
title: "mk:brainstorming"
description: "mk:brainstorming"
---

## What This Skill Does
Explores technical solutions with structured ideation, scoring, and plan-creator handoff. Generates 3-8 ideas using one of 7 purpose-built techniques, applies anti-bias pivots, and scores ideas on feasibility/impact/simplicity/novelty when in deep mode. Produces structured reports -- never code.

**Differentiator:** `mk:office-hours` = "should we build this?" (product validation). `mk:brainstorming` = "how should we build this?" (technical approach). `mk:plan-ceo-review` = plan already exists, want to challenge scope.

## When to Use
- Multiple architecturally-distinct approaches exist for a known requirement
- Trade-off analysis between candidate solutions is needed
- Novel problem with no obvious pattern in the codebase
- Pre-mortem / failure-mode exploration before committing to a design
- Constraint-rich problem (budget, time, stack) where the solution space is narrow

**NOT this skill if:**
| Situation | Use instead |
|-----------|-------------|
| "Is this worth building?" -- product validation | `mk:office-hours` |
| Plan already exists, want to challenge scope | `mk:plan-ceo-review` |
| Bug investigation / root cause | `mk:investigate` |
| Implementation detail (which library, which API call) | `mk:docs-finder` + just decide |
| Stuck on a specific approach with forced assumptions | `mk:problem-solving` |
| Want to deepen existing verdict or plan | `mk:elicit` |

## Core Capabilities
1. **Problem Confirmation:** Confirms what is being solved and the binding constraint before generating ideas. Uses AskUserQuestion capped at 3 per batch
2. **Scope Decomposition:** If request bundles 3+ independently-shippable concerns, decomposes into sub-projects before brainstorming
3. **7 Purpose-Built Techniques** (auto-selected, or forced via `--technique`):
   - `multi-alternative` -- "how to build X", generates architecturally distinct approaches with mechanism/trade-off/risk table
   - `first-principles` -- novel problems with no existing patterns, rebuilds from fundamental constraints
   - `reverse` -- debugging/prevention mindset, inverts problem to generate failure modes then prevention mechanisms
   - `constraint-mapping` -- narrow solution space, classifies constraints as HARD vs SOFT, finds intersection
   - `scamper` -- improving existing things, walks 7 lenses (Substitute/Combine/Adapt/Modify/Put/Eliminate/Reverse)
   - `analogical-thinking` -- cross-domain transfer, extracts mechanisms from non-software domains
   - `perspective-shift` -- walks candidate solutions through stakeholder perspectives (SRE, Security, New Hire, PM, End User)
4. **Anti-Bias Pivot:** After idea #4, pauses and asks "what orthogonal category have I not touched yet?" Forces one pivot per session to break semantic clustering
5. **Idea Format:** Every idea must include Concept (2-3 sentence mechanism), Novelty (what makes it non-obvious -- mandatory, or idea is dropped), and Category
6. **Scoring** (`--depth deep` only): 4 criteria weighted -- Feasibility (3x), Impact (3x), Simplicity (2x), Novelty (1x). Max 45. Anti-bias rules: score ALL before comparing, flag when all top picks are conservative
7. **Output Templates:** Three structured reports -- `output-ideas.md` (quick, 3-8 ideas, no scoring), `output-scored.md` (deep, scored with top 3 recommendations), `output-action-plan.md` (handoff context for plan-creator)
8. **Anti-Rationalization:** Built-in catalog of common excuses to skip the process, with counter-arguments. Covers skip-the-process, skip-decomposition, skip-discovery, and skip-anti-bias-pivot rationalizations
9. **Edge Case Handling:** 8 documented edge cases (pre-decided user, novel problem that's actually standard, conflicting constraints, score ties, conservative drift, etc.) with specific response patterns

## Arguments
- `--depth quick` -- 3-8 ideas, qualitative picks, no scoring (default)
- `--depth deep` -- scored ideas + top 3 + optional plan-creator handoff
- `--technique [name]` -- force a specific technique (default: auto-select via problem-type matching with precedence: multi-alternative -> first-principles -> reverse -> constraint-mapping -> scamper -> analogical-thinking -> perspective-shift)

## Workflow
The skill is done when:
1. Problem is confirmed -- user explicitly agrees on what is being solved and the binding constraint
2. Scope is right-sized -- multi-concern requests are decomposed
3. A technique is selected -- matched to problem type via precedence order
4. Ideas are generated (capped at 8) -- no scoring during generation. Anti-bias pivot applied at midpoint
5. Ideas are evaluated -- scoring in separate pass (deep mode) or qualitative picks (quick mode)
6. Output uses correct template -- quick vs scored vs handoff
7. Handoff is offered (deep mode only) -- ask "Create plan from top idea?" If yes, invoke `mk:plan-creator`

**HARD RULE:** Brainstorming MUST NOT write code, create files outside `plans/reports/`, or invoke implementation skills.

## Usage
```
/mk:brainstorming                     -> quick mode, auto-selected technique
/mk:brainstorming --depth deep        -> scored mode with handoff
/mk:brainstorming --technique scamper -> force SCAMPER technique
```

## Example Prompt
"We need to handle real-time notifications in our app. What approach should we take?"

The skill will: confirm the binding constraint (latency requirements? scale?), auto-select `multi-alternative.md`, generate 3-8 architecturally distinct approaches (WebSocket, SSE, polling, queue-based), apply anti-bias pivot at idea #4, evaluate qualitatively (quick) or with weighted scoring (deep), and offer to hand off the top idea to `mk:plan-creator`.

## Common Use Cases
- Choosing between WebSocket, SSE, polling, or queue-based architectures
- Designing a caching strategy with multiple constraints
- Exploring database choices for a startup with budget, skill, and scaling constraints
- Failure-mode exploration for auth system design
- Evaluating approaches for handling bursty API traffic

## Pro Tips
- The Novelty line is mandatory -- if you cannot write one, the idea is a duplicate and should be dropped
- Cap discovery at 3 questions per batch -- question fatigue kills ideation momentum
- If all 3-8 ideas cluster in 1-2 categories, the anti-bias pivot failed -- flag it and consider a focused session
- Max 8 ideas per run -- if the problem needs more, decompose into sub-problems and run multiple sessions
- The anti-rationalization catalog is worth reading -- it names the excuses you'll catch yourself making
- When using `constraint-mapping` and the intersection is empty, do NOT fabricate a solution -- report back to the user
- For the `reverse` technique: the prevention mechanisms ARE the solution ideas