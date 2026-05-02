---
title: "mk:problem-solving"
description: "Use when stuck on approach (not debugging). Strategic unsticking via 7 non-default techniques: simplification cascades, collision-zone thinking, meta-pattern recognition, inversion, scale game, first principles, via negativa."
---

# mk:problem-solving

## What This Skill Does

Provides seven non-default thinking techniques for when you are stuck on approach -- not when something is broken. Each technique targets a specific failure mode of default thinking: complexity spiraling, innovation block, reinventing wheels, forced assumptions, scale uncertainty, "impossible" claims, and bloat. The skill helps match your specific stuck-symptom to the right technique and applies it systematically with documentation of what worked and what did not.

## When to Use

Use this skill when you are stuck on **approach** (design, architecture, problem framing). Match your symptom to the right technique:

| Stuck Symptom | Technique |
|---------------|-----------|
| Same concept implemented 5+ ways, growing special cases | **Simplification Cascades** |
| Conventional solutions inadequate, need breakthrough | **Collision-Zone Thinking** |
| Same issue across domains, reinventing wheels | **Meta-Pattern Recognition** |
| Solution feels forced, "must be done this way" | **Inversion Exercise** |
| "Should scale fine" -- no idea where limits are | **Scale Game** |
| Told it's "impossible" / reasoning by analogy | **First Principles** |
| Bloated system, remove > add, simplify by subtraction | **Via Negativa** |
| Unsure which technique applies | **Dispatch flowchart** (`when-stuck.md`) |

**NOT this skill if:**
- Something is broken / needs a fix -- use `mk:fix` or `mk:sequential-thinking`
- You want open solution exploration before any plan exists -- use `mk:brainstorming`
- You want to re-examine an existing output or verdict -- use `mk:elicit`
- You need evidence-based root cause diagnosis -- use `mk:sequential-thinking`
- Trivial fix (typo, rename, single-file change with obvious cause)

## Core Capabilities

- **Seven techniques** each targeting a distinct stuck-symptom with a defined "win shape"
- **One-at-a-time discipline:** Apply one technique, finish or discard, before adding another
- **Combination support:** If one pass fails, up to two techniques can be combined (with documented rationale)
- **Dispatch flowchart:** `when-stuck.md` helps match symptoms to techniques when self-diagnosis is unclear
- **Null-result logging:** Failed technique attempts are documented and useful for future sessions
- **Rerouting:** If the block is really about evidence/cause, routes to `mk:sequential-thinking`; if it's a multi-perspective trade-off, routes to `mk:party`

## The Seven Techniques

### 1. Simplification Cascades
Find one insight that eliminates multiple components. **Win shape:** 10x (things deleted), not 10% (things optimized). Red flag: "Just need to add one more case..." repeating forever.

### 2. Collision-Zone Thinking
Force unrelated domains together. "What if we treated X like Y?" **Win shape:** Emergent properties from metaphor (e.g., services like circuits -> circuit breakers). Red flag: "I've tried everything in this domain."

### 3. Meta-Pattern Recognition
Pattern in 3+ domains -> likely universal. Extract, abstract, reuse. **Win shape:** Caching (CPU/DB/HTTP/DNS/CDN/LLM) collapses to one abstract concept. Red flag: "This problem is unique" -- it probably isn't.

### 4. Inversion Exercise
Flip the core assumption. "What if the opposite were true?" **Win shape:** Valid inversion reveals context-dependence (strategic slowness -> debounce, rate-limit). Red flag: "There's only one way to do this."

### 5. Scale Game
Test at extremes (1000x bigger/smaller). **Win shape:** Production readiness validated before production. Red flag: "Should scale fine" without evidence.

### 6. First Principles
Strip to fundamental truths. Rebuild from verified basics. **Win shape:** SpaceX-style 10x cost reduction by questioning "because that's the industry price." Red flag: Everyone accepts a constraint without evidence.

### 7. Via Negativa
Improve by removing, not adding. Subtraction is more robust than addition. **Win shape:** Remove retry wrapper -> surfaces real intermittent bug -> obvious fix. Red flag: "Adding X to fix the problem caused by adding Y."

## Workflow

```
user stuck on approach
   |-> match symptom -> apply ONE technique -> resolved (done)
   |-> not resolved -> try a combination (see below)
   |-> actually stuck on cause -> route to mk:sequential-thinking
   |-> actually a multi-perspective trade-off -> route to mk:party
```

### Combination Pairings (only if one pass fails)

- **Simplification + Meta-Pattern** -- find pattern across domains, then collapse all instances
- **Collision + Inversion** -- force the metaphor, then invert its assumptions
- **Scale + Via Negativa** -- extremes reveal what to cut
- **First Principles + Inversion** -- rebuild from zero, then flip the rebuild

## Usage

```bash
/mk:problem-solving   # Describe your stuck-ness; skill matches symptom to technique
```

## Example Prompt

> "Our notification system has 12 different codepaths for sending the same type of alert -- email, SMS, push, in-app, Slack, Teams, webhook... and every time we add a channel we fork more code. /mk:problem-solving"

The skill matches this to **Simplification Cascades**: maps the common pattern (format message -> route to channel -> deliver), finds the one abstraction that eliminates the 12 forked codepaths, and reduces the system to a single pipeline with channel adapters.

## Common Use Cases

- **Refactoring complex conditional logic:** Too many if/else branches or special cases
- **Scaling architecture:** Uncertainty about whether current design handles 10x or 100x growth
- **Challenging "impossible" constraints:** When everyone assumes something can't be done
- **Simplification:** Systems that grew organically and need reduction, not addition
- **Cross-domain innovation:** Bringing insights from one domain (finance, gaming, physics) to another

## Pro Tips

- **One technique at a time** -- stacking hides which one actually helped
- **Log null results** -- knowing a technique didn't work is valuable; it rules out approaches
- **Don't force a technique** -- if the symptom doesn't clearly match, use the dispatch flowchart
- **The line between problem-solving and debugging is important** -- if your code produces wrong output, you're debugging, not stuck on approach
- **Metaphors break eventually** (collision-zone) -- document where they break, don't hide it
- **Invalid inversions exist** -- "trust all user input" is a security hole, not a context-dependent inversion
- **Scale-game requires concrete numbers** -- thinking about 1000x without estimating is theater, not analysis

> **Canonical source:** `.claude/skills/problem-solving/SKILL.md`
